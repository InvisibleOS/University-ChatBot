-- PostgreSQL Schema with pgvector for the Virtual Assistant

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users Table (Admin & Students)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents Metadata
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vector Embeddings Table (pgvector)
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(3072), -- gemini-embedding-001 uses 3072 dimensions
    chunk_index INTEGER
);

-- Announcements (High Priority Context)
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    posted_by UUID REFERENCES users(id),
    embedding vector(3072),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: HNSW index is limited to 2000 dimensions. For gemini-embedding-001 (3072 dims),
-- sequential scan is used. Add IVFFlat index once you have sufficient data:
-- CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX ON announcements USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
