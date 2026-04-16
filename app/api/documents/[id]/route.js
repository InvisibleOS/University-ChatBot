import { NextResponse } from 'next/server';
import pg from 'pg';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export async function GET(req, { params }) {
    if (!process.env.DATABASE_URL) {
        return NextResponse.json({ 
            error: 'Database configuration missing',
            details: 'DATABASE_URL is not set.'
        }, { status: 500 });
    }

    try {
        const { id: docId } = await params;

        // Test connectivity
        const client = await pool.connect();
        client.release();

        // Fetch document metadata
        const meta = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
        if (meta.rowCount === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Fetch all text chunks ordered by index
        const chunks = await pool.query(
            'SELECT chunk_index, content FROM document_embeddings WHERE document_id = $1 ORDER BY chunk_index ASC',
            [docId]
        );

        return NextResponse.json({
            document: meta.rows[0],
            chunks: chunks.rows,
        });
    } catch (error) {
        console.error(`GET /api/documents/${params?.id} error:`, error);
        return NextResponse.json({ 
            error: 'Failed to retrieve document details', 
            details: error.message,
            code: error.code
        }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id: docId } = await params;
        const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [docId]);
        
        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        
        return NextResponse.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error(`DELETE /api/documents/${params?.id} error:`, error);
        return NextResponse.json({ 
            error: 'Failed to delete document',
            details: error.message 
        }, { status: 500 });
    }
}
