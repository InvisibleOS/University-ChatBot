import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export async function GET(req, { params }) {
    try {
        const docId = params.id;

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const docId = params.id;
        const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [docId]);
        
        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        
        return NextResponse.json({ message: 'Document deleted successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }
}
