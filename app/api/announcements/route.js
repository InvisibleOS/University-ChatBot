// Announcements Route
// POST: Embed and store an announcement in the DB
// GET:  Fetch all announcements ordered by newest first

import { NextResponse } from 'next/server';
import { embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import pg from 'pg';

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// GET — list all announcements (newest first)
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ 
      error: 'Database configuration missing',
      details: 'DATABASE_URL environment variable is not set.'
    }, { status: 500 });
  }

  try {
    // Test connectivity
    const client = await pool.connect();
    client.release();

    const res = await pool.query(
      `SELECT id, title, content, created_at
       FROM announcements
       ORDER BY created_at DESC`
    );
    return NextResponse.json({ announcements: res.rows });
  } catch (error) {
    console.error('[Announcements GET]', error);
    return NextResponse.json({ 
      error: 'Failed to fetch announcements',
      details: error.message,
      code: error.code
    }, { status: 500 });
  }
}

// POST — embed and store a new announcement
export async function POST(req) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ 
      error: 'Database configuration missing',
      details: 'DATABASE_URL environment variable is not set.'
    }, { status: 500 });
  }

  try {
    const { title, content } = await req.json();

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const fullText = `ANNOUNCEMENT: ${title}\n\n${content}`;

    // Test connectivity first
    const client = await pool.connect();
    
    try {
      // Embed using Gemini (matches 3072d vector space in DB)
      const { embedding } = await embed({
        model: googleAI.textEmbeddingModel('text-embedding-004', {
          outputDimensionality: 3072,
        }),
        value: fullText,
      });

      // posted_by is NULL — no auth system yet (schema has no NOT NULL constraint)
      const res = await client.query(
        `INSERT INTO announcements (title, content, embedding)
         VALUES ($1, $2, $3::vector)
         RETURNING id, title, content, created_at`,
        [title, content, JSON.stringify(embedding)]
      );

      return NextResponse.json(
        {
          message: 'Announcement posted and vectorized',
          announcement: res.rows[0],
        },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Announcements POST]', error);
    return NextResponse.json(
      { 
        error: 'Failed to post announcement', 
        details: error.message,
        code: error.code 
      },
      { status: 500 }
    );
  }
}
