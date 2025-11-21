-- Drop existing restrictive policies that require JWT claims
DROP POLICY IF EXISTS "Users can view their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can insert their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can update their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON vendors;

DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;

DROP POLICY IF EXISTS "Users can view their own batch payments" ON batch_payments;
DROP POLICY IF EXISTS "Users can insert their own batch payments" ON batch_payments;
DROP POLICY IF EXISTS "Users can update their own batch payments" ON batch_payments;

DROP POLICY IF EXISTS "Users can view batch payment items" ON batch_payment_items;
DROP POLICY IF EXISTS "Users can insert batch payment items" ON batch_payment_items;

-- Create new permissive policies for Web3 app (since we don't have server-side wallet auth)
-- Vendors
CREATE POLICY "Enable read access for all users" ON vendors FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON vendors FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON vendors FOR DELETE USING (true);

-- Payments
CREATE POLICY "Enable read access for all users" ON payments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON payments FOR INSERT WITH CHECK (true);

-- Batch Payments
CREATE POLICY "Enable read access for all users" ON batch_payments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON batch_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON batch_payments FOR UPDATE USING (true);

-- Batch Payment Items
CREATE POLICY "Enable read access for all users" ON batch_payment_items FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON batch_payment_items FOR INSERT WITH CHECK (true);
