-- Enable pgvector (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing indexes if they exist (to avoid duplicates, ignore errors if they don't exist)
-- DROP INDEX IF EXISTS idx_document_embeddings;
-- DROP INDEX IF EXISTS idx_announcements_embeddings;

-- Create IVFFlat index on document_embeddings
-- Note: Using IVFFlat instead of HNSW because HNSW has a 2000-dimension limit
-- and gemini-embedding-001/text-embedding-004 use 3072 dimensions.
-- 100 lists is a good starting point for smaller datasets.
CREATE INDEX IF NOT EXISTS idx_document_embeddings ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create IVFFlat index on announcements
CREATE INDEX IF NOT EXISTS idx_announcements_embeddings ON announcements 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Vacuum analyze to update statistics
VACUUM ANALYZE document_embeddings;
VACUUM ANALYZE announcements;
