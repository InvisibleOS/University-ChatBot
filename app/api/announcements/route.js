import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pg from 'pg';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export async function POST(req) {
    try {
        const { title, content, postedBy } = await req.json();
        
        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        const fullText = \`ANNOUNCEMENT: \${title}\\n\\n\${content}\`;
        
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const result = await model.embedContent(fullText);
        const embedding = result.embedding.values;

        const res = await pool.query(
            \`INSERT INTO announcements (title, content, posted_by, embedding)
             VALUES ($1, $2, $3, $4::vector) RETURNING id\`,
            [title, content, postedBy || 'admin', JSON.stringify(embedding)]
        );

        return NextResponse.json({ 
            message: 'Announcement posted and vectorized',
            announcementId: res.rows[0].id
        }, { status: 201 });
    } catch (error) {
        console.error('Announcement Error:', error);
        return NextResponse.json({ error: 'Failed to post announcement' }, { status: 500 });
    }
}
