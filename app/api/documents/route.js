import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export async function GET() {
    try {
        const res = await pool.query(`
            SELECT 
                d.id,
                d.title,
                d.file_type,
                d.upload_timestamp,
                COUNT(de.id) AS chunk_count
            FROM documents d
            LEFT JOIN document_embeddings de ON de.document_id = d.id
            GROUP BY d.id
            ORDER BY d.upload_timestamp DESC
        `);
        return NextResponse.json({ documents: res.rows });
    } catch (error) {
        console.error('GET /api/documents error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
