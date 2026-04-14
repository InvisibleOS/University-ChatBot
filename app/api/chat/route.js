import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { streamText } from 'ai';
import pg from 'pg';

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const STANDARD_MODE_PROMPT = `You are the official MIT Bengaluru Virtual Assistant. 
Answer questions strictly based on the provided context. If the answer is not in the context, use the web search tool to find MIT Bengaluru specific info. Do NOT hallucinate.`;

const INTERVIEW_COACH_PROMPT = `You are an expert Interview Coach for MIT Bengaluru students.
Use the provided placement statistics and context to conduct a mock interview. Ask technical and behavioral questions, provide constructive feedback, and guide the student.`;

async function retrieveContext(query) {
    // 1. Embed the user query
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(query);
    const queryEmbedding = result.embedding.values;

    // 2. Query pgvector for closest matches (Cosine Similarity)
    const dbRes = await pool.query(`
        SELECT content, 1 - (embedding <=> $1::vector) AS similarity 
        FROM document_embeddings 
        WHERE 1 - (embedding <=> $1::vector) > 0.5
        ORDER BY similarity DESC 
        LIMIT 5
    `, [JSON.stringify(queryEmbedding)]);

    return dbRes.rows.map(row => row.content).join('\n\n');
}

export async function POST(req) {
  const { messages, data } = await req.json();
  const mode = data?.mode || 'standard';
  
  const latestMessage = messages[messages.length - 1].content;
  const context = await retrieveContext(latestMessage);
  
  const systemInstruction = mode === 'interview' ? INTERVIEW_COACH_PROMPT : STANDARD_MODE_PROMPT;
  
  const result = await streamText({
    model: googleAI('gemini-1.5-pro'),
    system: `${systemInstruction}\n\nRetrieved Context:\n${context}`,
    messages,
  });

  return result.toDataStreamResponse();
}
