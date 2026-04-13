import OpenAI from 'openai';
import pg from 'pg';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// System Prompts
const STANDARD_MODE_PROMPT = `You are the official MIT Bengaluru Virtual Assistant. 
Answer questions strictly based on the provided context. If the answer is not in the context, use the web search tool to find MIT Bengaluru specific info. Do NOT hallucinate.`;

const INTERVIEW_COACH_PROMPT = `You are an expert Interview Coach for MIT Bengaluru students.
Use the provided placement statistics and context to conduct a mock interview. Ask technical and behavioral questions, provide constructive feedback, and guide the student.`;

/**
 * Searches the vector database for relevant context
 */
async function retrieveContext(query) {
    // 1. Embed the user query
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: query,
        dimensions: 3072
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

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

/**
 * Main RAG Generation with Tool Calling fallback
 */
export async function generateResponse(userMessage, mode = 'standard', chatHistory = []) {
    const context = await retrieveContext(userMessage);
    
    const systemPrompt = mode === 'interview' ? INTERVIEW_COACH_PROMPT : STANDARD_MODE_PROMPT;
    
    const messages = [
        { role: 'system', content: \`\${systemPrompt}\n\nRetrieved Context:\n\${context}\` },
        ...chatHistory,
        { role: 'user', content: userMessage }
    ];

    // Tool definition for fallback web search
    const tools = [
        {
            type: "function",
            function: {
                name: "mit_bengaluru_web_search",
                description: "Search the web for MIT Bengaluru related information if internal database lacks the answer.",
                parameters: {
                    type: "object",
                    properties: {
                        search_query: { type: "string", description: "The search query." }
                    },
                    required: ["search_query"]
                }
            }
        }
    ];

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools,
        tool_choice: "auto",
        stream: true // Stream enabled for WebSockets
    });

    return response; // Return stream to be piped to WebSocket
}
