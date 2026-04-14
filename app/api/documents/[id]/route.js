import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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
