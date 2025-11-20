-- Enable Row Level Security
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_payment_items ENABLE ROW LEVEL SECURITY;

-- Vendors policies: Users can only see and manage their own vendors
CREATE POLICY "Users can view their own vendors"
  ON vendors FOR SELECT
  USING (created_by = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own vendors"
  ON vendors FOR INSERT
  WITH CHECK (created_by = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own vendors"
  ON vendors FOR UPDATE
  USING (created_by = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own vendors"
  ON vendors FOR DELETE
  USING (created_by = current_setting('request.jwt.claims', true)::json->>'sub');

-- Payments policies: Users can only see payments from their wallet
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (from_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can insert their own payments"
  ON payments FOR INSERT
  WITH CHECK (from_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Batch payments policies
CREATE POLICY "Users can view their own batch payments"
  ON batch_payments FOR SELECT
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can insert their own batch payments"
  ON batch_payments FOR INSERT
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update their own batch payments"
  ON batch_payments FOR UPDATE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Batch payment items policies
CREATE POLICY "Users can view batch payment items"
  ON batch_payment_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM batch_payments
      WHERE batch_payments.id = batch_payment_items.batch_id
      AND batch_payments.wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    )
  );

CREATE POLICY "Users can insert batch payment items"
  ON batch_payment_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM batch_payments
      WHERE batch_payments.id = batch_payment_items.batch_id
      AND batch_payments.wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    )
  );
