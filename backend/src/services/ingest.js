import OpenAI from 'openai';
import pg from 'pg';
import pdf from 'pdf-parse';
import * as xlsx from 'xlsx';

// Initialize OpenAI client using the environment API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize PostgreSQL connection pool
const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

/**
 * Text Chunking Strategy limit
 * Splits large string blocks into manageable chunks suitable for the embedding model.
 * A size of 1000 characters with a 150-character (15%) overlap helps preserve semantic continuity
 * across boundaries so that context isn't violently severed between sentences.
 * 
 * @param {string} text - The raw text to process
 * @param {number} chunkSize - Approximate character length per chunk (e.g., 1000)
 * @param {number} overlap - Overlap size in characters (e.g., 150)
 * @returns {string[]} Array of overlapping text chunks
 */
function chunkText(text, chunkSize = 1000, overlap = 150) {
    if (!text) return [];
    
    // Normalize and clean up excessive whitespace/newlines
    const cleanText = text.replace(/\\s+/g, ' ').trim();
    const chunks = [];
    let i = 0;

    while (i < cleanText.length) {
        let end = i + chunkSize;
        
        // Optimize: Prevent breaking chunks abruptly in the middle of a word.
        // We look ahead for a natural break (a space) up to 50 characters further.
        if (end < cleanText.length) {
            const nextSpace = cleanText.indexOf(' ', end);
            if (nextSpace !== -1 && nextSpace - end < 50) { 
                end = nextSpace;
            }
        }
        
        chunks.push(cleanText.slice(i, end));
        // Advance pointer, reserving 'overlap' for the next chunk
        i = end - overlap; 
    }
    
    return chunks;
}

/**
 * Extraction Engine for Files
 * Evaluates mime types and reads structured text using specialized libraries.
 * Generates an LLM-friendly textual representation.
 * 
 * @param {Buffer} buffer - The raw binary file stream
 * @param {string} mimeType - File mime type
 * @param {string} filename - Original name
 * @returns {Promise<string>} Parsed plain text (or markdown table formatted struct)
 */
async function extractTextFromFile(buffer, mimeType, filename) {
    // 1. PDF Parsing
    if (mimeType === 'application/pdf') {
        const pdfData = await pdf(buffer);
        return pdfData.text;
    } 
    
    // 2. Excel Parsing (XLSX, XLS) - LLM logic specifically tuned for spreadsheets
    if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        mimeType === 'application/vnd.ms-excel' ||
        filename.endsWith('.xlsx')
    ) {
        // Read buffer to workbook
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        let combinedString = '';

        // Iterate over sheets and convert rows to a readable markdown table structure.
        // LLMs comprehend Markdown tabular layouts much better than raw CSV streams.
        for (const sheetName of workbook.SheetNames) {
            combinedString += \`\\n\\n### Sheet: \${sheetName}\\n\\n\`;
            const worksheet = workbook.Sheets[sheetName];
            
            // Extract raw array of arrays
            const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            if (jsonData.length === 0) continue;
            
            // Construct markdown tables
            for (let i = 0; i < jsonData.length; i++) {
                // Ensure every cell is a string and escape pipes which break markdown formatting
                const row = jsonData[i].map(cell => String(cell || '').replace(/\\|/g, '\\\\|').trim());
                combinedString += \`| \${row.join(' | ')} |\\n\`;
                
                // Print Markdown header separator on the first row
                if (i === 0) {
                    const separator = row.map(() => '---');
                    combinedString += \`| \${separator.join(' | ')} |\\n\`;
                }
            }
        }
        return combinedString.trim();
    } 
    
    // 3. Plain Text Parsing
    if (mimeType === 'text/plain' || filename.endsWith('.txt')) {
        return buffer.toString('utf-8');
    }

    throw new Error(\`Unsupported file type ingestion attempted: \${mimeType} (\${filename})\`);
}

/**
 * Robust Wrapper for OpenAI Embeddings with Exponential Backoff
 * Designed to gracefully handle OpenAI '429 Rate Limit' errors on massive document ingests.
 */
async function generateEmbeddingWithRetry(textChunk, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const embeddingRes = await openai.embeddings.create({
                model: 'text-embedding-3-large',
                input: textChunk,
                dimensions: 3072 // Set dimensions explicitly for deterministic vector space
            });
            return embeddingRes.data[0].embedding;
            
        } catch (error) {
            // Check specifically for Rate Limit (HTTP 429) errors
            if (error?.status === 429 && attempt < maxRetries) {
                const waitMs = attempt * 2500; // Exponential-ish fallback (2.5s, 5s, etc.)
                console.warn(\`⚠️ OpenAI API rate limited. Retrying \${attempt}/\${maxRetries} after \${waitMs}ms...\`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
            } else {
                // Not a rate limit issue, or we ran out of retries
                console.error('❌ Failed generating embedding:', error.message);
                throw error;
            }
        }
    }
}

/**
 * Main RAG Ingestion Pipeline
 * Workflow: Parse File -> Text Chunking -> Open AI Embeddings -> ACID Transaction DB Commit
 *
 * @param {Buffer} buffer - Raw file
 * @param {string} filename 
 * @param {string} mimeType 
 * @param {string} uploadedBy 
 * @returns {Promise<number>} Returns the ID of the new document entry
 */
export async function processDocument(buffer, filename, mimeType, uploadedBy) {
    console.log(\`[Ingest] Extracting text for: \${filename}\`);
    const rawText = await extractTextFromFile(buffer, mimeType, filename);
    
    console.log(\`[Ingest] Applying chunking strategy for: \${filename}\`);
    const chunks = chunkText(rawText, 1000, 150);

    if (chunks.length === 0) {
        throw new Error("Ingestion failure: Document contained no extractable textual data.");
    }

    // Connect a dedicated pg client for a transactional (ACID) execution scope
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Insert Core Document Metadata
        const docRes = await client.query(
            \`INSERT INTO documents (title, file_type, uploaded_by) 
             VALUES ($1, $2, $3) RETURNING id\`,
            [filename, mimeType, uploadedBy]
        );
        const documentId = docRes.rows[0].id;

        // 2. Iterate, Embed, and Store each Chunk sequentially 
        // Sequential limits burst load on API limits vs mapping Promise.all
        console.log(\`[Ingest] Generating OpenAI API embeddings for \${chunks.length} total blocks...\`);
        
        for (let i = 0; i < chunks.length; i++) {
            const chunkContent = chunks[i];
            
            // Execute the embedding request wrapper
            const embedding = await generateEmbeddingWithRetry(chunkContent);

            // 3. Persist the vector representation
            await client.query(
                \`INSERT INTO document_embeddings (document_id, content, embedding, chunk_index)
                 VALUES ($1, $2, $3::vector, $4)\`,
                [documentId, chunkContent, JSON.stringify(embedding), i]
            );
        }

        await client.query('COMMIT'); // Commit if flawless
        console.log(\`✅ [Ingest] Successfully finalized Vector Insertion for: \${filename} [\${documentId}]\`);
        return documentId;

    } catch (error) {
        await client.query('ROLLBACK'); // Cancel partial writes to avoid data corruption
        console.error(\`❌ [Ingest] Critical pipeline failure, reverting transaction for: \${filename}\`, error);
        throw error;
    } finally {
        client.release(); // Relinquish pool connection
    }
}

/**
 * Announcement Pipeline
 * Smaller pipeline simply processing and vectorizing single-string announcements block
 */
export async function processAnnouncement(title, content, postedBy) {
    const fullText = \`ANNOUNCEMENT: \${title}\\n\\n\${content}\`;
    
    // Attempt standard embed
    const embedding = await generateEmbeddingWithRetry(fullText);

    // Single Insert
    const res = await pool.query(
        \`INSERT INTO announcements (title, content, posted_by, embedding)
         VALUES ($1, $2, $3, $4::vector) RETURNING id\`,
        [title, content, postedBy, JSON.stringify(embedding)]
    );

    return res.rows[0].id;
}
