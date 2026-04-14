import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pg from 'pg';
import pdf from 'pdf-parse';
import * as xlsx from 'xlsx';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
            const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
            const result = await model.embedContent(textChunk);
            return result.embedding.values;
            
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

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const uploadedBy = formData.get('userId') || 'admin';

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

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); 

        const docRes = await client.query(
            `INSERT INTO documents (title, file_type, uploaded_by) 
             VALUES ($1, $2, $3) RETURNING id`,
            [filename, mimeType, uploadedBy]
        );
        const documentId = docRes.rows[0].id;
        
        for (let i = 0; i < chunks.length; i++) {
            const chunkContent = chunks[i];
            const embedding = await generateEmbeddingWithRetry(chunkContent);

            await client.query(
                `INSERT INTO document_embeddings (document_id, content, embedding, chunk_index)
                 VALUES ($1, $2, $3::vector, $4)`,
                [documentId, chunkContent, JSON.stringify(embedding), i]
            );
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
    console.error(error);
    return NextResponse.json({ error: 'Failed to process document', details: error.message }, { status: 500 });
  }
}
