import { NextResponse } from 'next/server';
import { embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import pg from 'pg';
import pdf from 'pdf-parse';
import * as xlsx from 'xlsx';

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function chunkText(text, chunkSize = 1000, overlap = 150) {
    if (!text) return [];
    
    const cleanText = text.replace(/\\s+/g, ' ').trim();
    const chunks = [];
    let i = 0;

    while (i < cleanText.length) {
        let end = i + chunkSize;
        
        if (end < cleanText.length) {
            const nextSpace = cleanText.indexOf(' ', end);
            if (nextSpace !== -1 && nextSpace - end < 50) { 
                end = nextSpace;
            }
        }
        
        chunks.push(cleanText.slice(i, end));
        i = end - overlap; 
    }
    
    return chunks;
}

async function extractTextFromFile(buffer, mimeType, filename) {
    if (mimeType === 'application/pdf') {
        const pdfData = await pdf(buffer);
        return pdfData.text;
    } 
    
    if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        mimeType === 'application/vnd.ms-excel' ||
        filename.endsWith('.xlsx')
    ) {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        let combinedString = '';

        for (const sheetName of workbook.SheetNames) {
            combinedString += `\n\n### Sheet: ${sheetName}\n\n`;
            const worksheet = workbook.Sheets[sheetName];
            
            const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            if (jsonData.length === 0) continue;
            
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i].map(cell => String(cell || '').replace(/\|/g, '\\|').trim());
                combinedString += `| ${row.join(' | ')} |\n`;
                
                if (i === 0) {
                    const separator = row.map(() => '---');
                    combinedString += `| ${separator.join(' | ')} |\n`;
                }
            }
        }
        return combinedString.trim();
    } 
    
    if (mimeType === 'text/plain' || filename.endsWith('.txt')) {
        return buffer.toString('utf-8');
    }

    throw new Error(`Unsupported file type ingestion attempted: ${mimeType} (${filename})`);
}

async function generateEmbeddingWithRetry(textChunk, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { embedding } = await embed({
                model: googleAI.textEmbeddingModel('gemini-embedding-001'),
                value: textChunk,
            });
            return embedding;
            
        } catch (error) {
            if (error?.status === 429 && attempt < maxRetries) {
                const waitMs = attempt * 2500;
                await new Promise(resolve => setTimeout(resolve, waitMs));
            } else {
                throw error;
            }
        }
    }
}

// --- Vercel Route Config ---
export const maxDuration = 10; // Strict limit for Vercel Hobby

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const uploadedBy = null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;
    const filename = file.name;

    const rawText = await extractTextFromFile(buffer, mimeType, filename);
    const chunks = chunkText(rawText, 1000, 150);

    if (chunks.length === 0) {
        throw new Error("Document contained no extractable textual data.");
    }

    // Hobby Tier Safety Check: 10s is very short for embedding many chunks.
    // If a document has more than 50 chunks, it will almost certainly time out.
    if (chunks.length > 50) {
        return NextResponse.json({ 
            error: 'Document too large for Vercel Hobby tier.', 
            details: `This document has ${chunks.length} chunks. The limit for single-pass ingestion on the free tier is ~50 chunks to avoid timeouts.`
        }, { status: 413 });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); 

        const docRes = await client.query(
            `INSERT INTO documents (title, file_type, uploaded_by) 
             VALUES ($1, $2, $3) RETURNING id`,
            [filename, mimeType, uploadedBy]
        );
        const documentId = docRes.rows[0].id;

        // Process in parallel batches of 5 to speed up ingestion while staying within 10s
        const BATCH_SIZE = 5;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const embeddingPromises = batch.map((chunk, index) => 
                generateEmbeddingWithRetry(chunk).then(embedding => ({
                    content: chunk,
                    embedding,
                    chunkIndex: i + index
                }))
            );

            const results = await Promise.all(embeddingPromises);

            // Sequential DB inserts to maintain transaction integrity
            for (const res of results) {
                await client.query(
                    `INSERT INTO document_embeddings (document_id, content, embedding, chunk_index)
                     VALUES ($1, $2, $3::vector, $4)`,
                    [documentId, res.content, JSON.stringify(res.embedding), res.chunkIndex]
                );
            }
        }

        await client.query('COMMIT'); 
        return NextResponse.json({ message: 'File ingested successfully', documentId });

    } catch (error) {
        await client.query('ROLLBACK'); 
        throw error;
    } finally {
        client.release(); 
    }

  } catch (error) {
    console.error('[Upload Error]', error);
    return NextResponse.json({ error: 'Failed to process document', details: error.message }, { status: 500 });
  }
}
