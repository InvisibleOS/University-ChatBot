// Hybrid Chat Engine — AI SDK v6 compatible
// - Groq (Llama 3) handles real-time chat generation (fast, free-tier friendly)
// - Google Gemini handles query embedding for Supabase pgvector RAG retrieval
//   (preserves the 3072-dimensional vector space already in the database)

import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, embed } from 'ai';
import pg from 'pg';

// --- Provider Initialization ---

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Google AI is ONLY used for embedding — not for generation.
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --- Database Pool ---

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- System Prompt ---

const SYSTEM_PROMPT = `You are the official MIT Bengaluru Virtual Assistant — a knowledgeable, friendly assistant for students, faculty, and prospective applicants of Manipal Institute of Technology, Bengaluru.

Your capabilities include:
- Answering questions about admissions, courses, campus life, faculty, fees, placements, and events using the provided context.
- Conducting mock job interviews when a student asks. In interview mode: ask one question at a time, wait for the student's answer, provide constructive feedback, then move to the next question. Cover both technical and behavioural aspects based on placement context.
- Providing career and placement guidance based on available placement statistics.

Always base your answers on the provided context. If the answer is not in the context, say so clearly — do not hallucinate facts about MIT Bengaluru.`;

// --- RAG Context Retrieval ---
// Uses Google Gemini embeddings to match the 3072d vectors stored in Supabase.
// Queries BOTH announcements (high-priority) and document_embeddings.
// This function is non-fatal: if it fails, chat continues without RAG context.

async function retrieveContext(query) {
  try {
    const { embedding: queryEmbedding } = await embed({
      model: googleAI.textEmbeddingModel('gemini-embedding-001'),
      value: query,
    });

    const embeddingJson = JSON.stringify(queryEmbedding);

    // Query announcements first — treated as high-priority context
    const announcementsRes = await pool.query(
      `SELECT title, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM announcements
       WHERE 1 - (embedding <=> $1::vector) > 0.4
       ORDER BY similarity DESC
       LIMIT 3`,
      [embeddingJson]
    );

    // Query document embeddings
    const docsRes = await pool.query(
      `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
       FROM document_embeddings
       WHERE 1 - (embedding <=> $1::vector) > 0.5
       ORDER BY similarity DESC
       LIMIT 5`,
      [embeddingJson]
    );

    const announcementContext = announcementsRes.rows
      .map((row) => `[ANNOUNCEMENT] ${row.title}\n${row.content}`)
      .join('\n\n');

    const documentContext = docsRes.rows
      .map((row) => row.content)
      .join('\n\n');

    const parts = [announcementContext, documentContext].filter(Boolean);
    return parts.join('\n\n---\n\n');
  } catch (err) {
    console.warn('[RAG] Context retrieval skipped:', err.message);
    return '';
  }
}

// --- Extract plain text from a message ---
// AI SDK v6 messages may have a 'parts' array or a plain 'content' string.
function extractText(message) {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }
  return '';
}

// --- Normalise messages for Groq (core message format) ---
// AI SDK v6 UIMessages need to be converted to CoreMessages for streamText.
function normaliseMessages(messages) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: extractText(m) }))
    .filter((m) => m.content.trim().length > 0);
}

// --- POST Handler ---

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const coreMessages = normaliseMessages(messages);

    if (coreMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not parse message content.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve RAG context for the latest user message
    const latestUserMsg = [...coreMessages].reverse().find((m) => m.role === 'user');
    const context = latestUserMsg ? await retrieveContext(latestUserMsg.content) : '';

    const systemWithContext = context
      ? `${SYSTEM_PROMPT}\n\nRetrieved Context from MIT Bengaluru Knowledge Base:\n${context}`
      : SYSTEM_PROMPT;

    // Stream via Groq — AI SDK v6 uses toUIMessageStreamResponse()
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemWithContext,
      messages: coreMessages,
      abortSignal: AbortSignal.timeout(25000),
    });

    // AI SDK v6: use toUIMessageStreamResponse (replaces toDataStreamResponse)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error('[CHAT] Groq request timed out.');
      return new Response(
        JSON.stringify({
          error: 'The AI took too long to respond. Please try again.',
          code: 'TIMEOUT',
        }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('[CHAT] API Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An unknown error occurred.',
        status: error.status || 500,
      }),
      { status: error.status || 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
