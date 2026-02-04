-- Create batch_jobs table for asynchronous processing
CREATE TABLE IF NOT EXISTS batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'UPLOADING', -- UPLOADING, PARSING, PENDING_APPROVAL, QUEUED, PROCESSING, COMPLETED, FAILED, PARTIAL_FAILED
    original_filename TEXT,
    file_path TEXT, -- Storage path
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    summary JSONB DEFAULT '{}'::jsonb, -- Store Currency/Chain totals: {"EVM": {"USDT": 1000}, "SOLANA": {"SOL": 50}}
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create batch_chunks table for splitting large jobs
CREATE TABLE IF NOT EXISTS batch_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    recipient_count INTEGER NOT NULL,
    data JSONB NOT NULL, -- The actual payment items for this chunk
    retry_count INTEGER DEFAULT 0,
    tx_hashes TEXT[], -- Array of transaction hashes generated from this chunk
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_chunks_job_id ON batch_chunks(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_chunks_status ON batch_chunks(status);

-- Enable Row Level Security
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for batch_jobs
CREATE POLICY "Users can view their own batch jobs"
    ON batch_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own batch jobs"
    ON batch_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batch jobs"
    ON batch_jobs FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for batch_chunks (inherited via job_id usually, but simple ownership check)
-- Assuming the user owns the job, they access the chunks.
CREATE POLICY "Users can view chunks for their jobs"
    ON batch_chunks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM batch_jobs
            WHERE batch_jobs.id = batch_chunks.job_id
            AND batch_jobs.user_id = auth.uid()
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_batch_jobs_updated_at
    BEFORE UPDATE ON batch_jobs
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_batch_chunks_updated_at
    BEFORE UPDATE ON batch_chunks
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
