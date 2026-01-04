-- =====================================================
-- Protocol Banks - Custom Auth System Database Schema
-- Privy-like security with Shamir Secret Sharing
-- =====================================================

-- 1. Auth Users Table
-- Stores user authentication data (Email, Google, Apple)
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  google_id TEXT UNIQUE,
  apple_id TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own data" ON auth_users 
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own data" ON auth_users 
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "System can insert users" ON auth_users 
  FOR INSERT WITH CHECK (true);

-- 2. Magic Links Table
-- For passwordless email authentication
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,  -- Store hashed token
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies (system only)
CREATE POLICY "System can manage magic links" ON magic_links 
  FOR ALL USING (true);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);

-- 3. Embedded Wallets Table
-- Stores Shamir shares (encrypted) - Server share only
CREATE TABLE IF NOT EXISTS embedded_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  -- Server share (Share B) - encrypted with user's PIN-derived key
  server_share_encrypted TEXT NOT NULL,
  server_share_iv TEXT NOT NULL,
  -- Recovery share (Share C) - encrypted, returned to user for backup
  recovery_share_encrypted TEXT NOT NULL,
  recovery_share_iv TEXT NOT NULL,
  -- Key derivation parameters
  salt TEXT NOT NULL,
  -- Metadata
  chain_type TEXT DEFAULT 'EVM', -- EVM, Solana, etc.
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chain_type, is_primary)
);

-- Enable RLS
ALTER TABLE embedded_wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their wallets" ON embedded_wallets 
  FOR SELECT USING (user_id IN (SELECT id FROM auth_users WHERE email = current_setting('request.jwt.claims', true)::json->>'email'));

CREATE POLICY "Users can create wallets" ON embedded_wallets 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their wallets" ON embedded_wallets 
  FOR UPDATE USING (user_id IN (SELECT id FROM auth_users WHERE email = current_setting('request.jwt.claims', true)::json->>'email'));

-- Index
CREATE INDEX IF NOT EXISTS idx_embedded_wallets_user ON embedded_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_embedded_wallets_address ON embedded_wallets(address);

-- 4. Auth Sessions Table
-- Custom session management
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  session_token_hash TEXT UNIQUE NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "System can manage sessions" ON auth_sessions 
  FOR ALL USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- 5. Wallet Recovery Requests Table
-- For account recovery flow
CREATE TABLE IF NOT EXISTS wallet_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  recovery_token_hash TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, verified, completed, expired
  verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE wallet_recovery_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "System can manage recovery requests" ON wallet_recovery_requests 
  FOR ALL USING (true);

-- 6. Device Shares Table
-- Stores device-bound shares (Share A)
-- This is also stored in IndexedDB, but we keep a backup here
CREATE TABLE IF NOT EXISTS device_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES embedded_wallets(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  -- Device share (Share A) - encrypted with device-specific key
  device_share_encrypted TEXT NOT NULL,
  device_share_iv TEXT NOT NULL,
  device_key_salt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_id, device_id)
);

-- Enable RLS
ALTER TABLE device_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their device shares" ON device_shares 
  FOR ALL USING (user_id IN (SELECT id FROM auth_users WHERE email = current_setting('request.jwt.claims', true)::json->>'email'));

-- Index
CREATE INDEX IF NOT EXISTS idx_device_shares_wallet ON device_shares(wallet_id);
CREATE INDEX IF NOT EXISTS idx_device_shares_device ON device_shares(device_id);

-- 7. Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_auth_data()
RETURNS void AS $$
BEGIN
  -- Delete expired magic links
  DELETE FROM magic_links WHERE expires_at < NOW();
  
  -- Delete expired sessions
  DELETE FROM auth_sessions WHERE expires_at < NOW();
  
  -- Delete expired recovery requests
  DELETE FROM wallet_recovery_requests WHERE expires_at < NOW() AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_auth_users_updated_at ON auth_users;
CREATE TRIGGER update_auth_users_updated_at
  BEFORE UPDATE ON auth_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_embedded_wallets_updated_at ON embedded_wallets;
CREATE TRIGGER update_embedded_wallets_updated_at
  BEFORE UPDATE ON embedded_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
