import { NextResponse } from 'next/server';
import pg from 'pg';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export async function GET() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not defined');
        return NextResponse.json({ 
            error: 'Database configuration missing in environment',
            details: 'DATABASE_URL is not set.'
        }, { status: 500 });
    }

    try {
        // Test connectivity first
        const client = await pool.connect();
        client.release();

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
        return NextResponse.json({ 
            error: 'Failed to load documents',
            details: error.message,
            code: error.code
        }, { status: 500 });
    }
}
