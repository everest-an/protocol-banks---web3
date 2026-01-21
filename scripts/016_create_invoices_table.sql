-- Create invoices table for merchant payment collection
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT UNIQUE NOT NULL,
  recipient_address TEXT NOT NULL,
  amount DECIMAL(18,6) NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  description TEXT,
  merchant_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  signature TEXT NOT NULL,
  tx_hash TEXT,
  paid_by TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_id ON invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_recipient ON invoices(recipient_address);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read invoices by invoice_id (for payment)
CREATE POLICY "Allow public read by invoice_id" ON invoices
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can create invoices
CREATE POLICY "Allow authenticated users to create invoices" ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only the recipient can update their invoices
CREATE POLICY "Allow recipient to update invoices" ON invoices
  FOR UPDATE
  USING (recipient_address = current_setting('request.jwt.claims')::json->>'wallet_address');
