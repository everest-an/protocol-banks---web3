ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS telegram_link_code TEXT;
ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS telegram_link_expires_at TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS trading_accounts_telegram_chat_id_key ON trading_accounts(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trading_accounts_telegram_link_code_key ON trading_accounts(telegram_link_code) WHERE telegram_link_code IS NOT NULL;