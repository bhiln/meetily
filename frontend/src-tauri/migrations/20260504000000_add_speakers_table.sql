-- Migration: Add speakers table for people management and diarization
CREATE TABLE IF NOT EXISTS speakers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_context TEXT,
    voice_profile BLOB, -- To store Sherpa-ONNX embeddings later
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for searching speakers by name
CREATE INDEX IF NOT EXISTS idx_speakers_name ON speakers(name);
