import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import pg from 'pg';
import dotenv from 'dotenv';
import { generateResponse } from './services/rag.service.js';
import { processDocument, processAnnouncement } from './services/ingest.js';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize WebSocket server attached to the HTTP server on the /chat path
const wss = new WebSocketServer({ server, path: '/chat' });

// ==========================================
// Middleware Configuration
// ==========================================
app.use(cors()); // Allow Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON request bodies

// ==========================================
// Database Connection Pool
// ==========================================
// We use a connection pool to efficiently manage multiple concurrent database connections
const { Pool } = pg;
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for some managed Postgres services
});

// ==========================================
// File Upload Configuration (Multer)
// ==========================================
// Use memory storage for fast, stateless processing before embedding
// A 50MB file size limit is set to prevent memory exhaustion
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ==========================================
// WebSocket Chat Server Setup
// ==========================================
wss.on('connection', (ws) => {
    console.log('⚡ New client connected to WebSocket chat interface');

    // Connection Handler: Listen for incoming messages from the client
    ws.on('message', async (messageBuffer) => {
        try {
            // Parse the incoming JSON payload
            const messageData = JSON.parse(messageBuffer.toString());
            const { content, mode, history } = messageData;

            // Validate that we received an actual prompt
            if (!content || typeof content !== 'string') {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid or missing content' }));
                return;
            }

            // Route the request to the RAG service which returns an OpenAI stream
            // mode determines the system prompt (e.g., standard vs. interview_coach)
            const responseStream = await generateResponse(content, mode || 'standard', history || []);

            // Stream chunks back to the client immediately as they arrive
            for await (const chunk of responseStream) {
                // Safely extract the delta content from the OpenAI response chunk
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) {
                    ws.send(JSON.stringify({ type: 'token', text }));
                }
            }

            // Send a termination signal to notify the UI that the complete response has been streamed
            ws.send(JSON.stringify({ type: 'done' }));

        } catch (error) {
            console.error('❌ WebSocket message processing error:', error);
            // Gracefully inform the client if an error occurred during generation
            ws.send(JSON.stringify({ type: 'error', message: 'The server failed to process your request.' }));
        }
    });

    ws.on('close', () => {
        console.log('🔌 Client disconnected from WebSocket');
    });
});

// ==========================================
// Admin REST APIs
// ==========================================

/**
 * POST /api/upload
 * Route handling document ingestion (PDF, XLSX, TXT).
 * Extracts text, chunks it, embeds it via OpenAI, and saves it into pgvector.
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded in request.' });
    }

    try {
        const { originalname, buffer, mimetype } = req.file;
        // Optionally map this to an authenticated admin ID in a real app
        const uploadedBy = req.body.userId || 'admin';
        
        console.log(`📥 Processing document upload: ${originalname} (${mimetype})`);
        
        // Pass the buffer and metadata to the ingestion pipeline service
        const documentId = await processDocument(buffer, originalname, mimetype, uploadedBy);
        
        res.status(200).json({ 
            message: 'File successfully ingested and vectorized.', 
            documentId 
        });
    } catch (error) {
        console.error(`❌ Upload Error [${req.file.originalname}]:`, error);
        res.status(500).json({ error: 'Failed to ingest document.', details: error.message });
    }
});

/**
 * DELETE /api/documents/:id
 * Route to delete a document and its corresponding vector embeddings.
 */
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const docId = req.params.id;
        
        // Assuming the database schema uses ON DELETE CASCADE for the foreign key,
        // deleting the document record will automatically drop the associated chunks
        const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [docId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Document not found.' });
        }
        
        res.status(200).json({ message: 'Document and its embeddings deleted successfully.' });
    } catch (error) {
        console.error(`❌ Delete Document Error [ID: ${req.params.id}]:`, error);
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});

/**
 * POST /api/announcements
 * Route to save a high-priority announcement and immediately vectorize it.
 */
app.post('/api/announcements', async (req, res) => {
    try {
        const { title, content, postedBy } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Both title and content are required.' });
        }

        console.log(`📢 Processing new announcement: ${title}`);
        
        // Process the announcement for embedding
        const announcementId = await processAnnouncement(title, content, postedBy || 'admin');
        
        res.status(201).json({ 
            message: 'Announcement successfully posted and vectorized.',
            announcementId
        });
    } catch (error) {
        console.error('❌ Announcement Posting Error:', error);
        res.status(500).json({ error: 'Failed to process announcement.' });
    }
});

// ==========================================
// Server Initialization
// ==========================================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 MIT Virtual Assistant backend API & WebSocket server running natively on port ${PORT}`);
});
