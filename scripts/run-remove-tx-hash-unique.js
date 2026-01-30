#!/usr/bin/env node

/**
 * Remove UNIQUE constraint from payments.tx_hash
 * Allows batch payments to share the same transaction hash
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  console.log('🚀 Removing UNIQUE constraint from payments.tx_hash...\n');

  // Read environment variables
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

  if (!dbUrl) {
    console.error('❌ Error: POSTGRES_URL_NON_POOLING or POSTGRES_URL not found in environment');
    console.error('Please set the database connection string in .env file');
    process.exit(1);
  }

  // Read migration SQL file
  const sqlFilePath = path.join(__dirname, '023_remove_payments_tx_hash_unique.sql');
  let sqlContent;

  try {
    sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('✅ Migration file loaded:', sqlFilePath);
    console.log('\n📄 SQL to execute:');
    console.log('─'.repeat(80));
    console.log(sqlContent);
    console.log('─'.repeat(80));
    console.log();
  } catch (error) {
    console.error('❌ Error reading migration file:', error.message);
    process.exit(1);
  }

  // Load pg library
  let pg;
  try {
    pg = require('pg');
  } catch (error) {
    console.error('❌ Error: "pg" package not found');
    console.error('Please run: npm install pg');
    process.exit(1);
  }

  // Connect to database
  const cleanDbUrl = dbUrl.replace(/[?&]sslmode=[^&]*/g, '');

  const connectionConfig = {
    connectionString: cleanDbUrl,
    ssl: {
      rejectUnauthorized: false,
      ca: false,
      checkServerIdentity: () => undefined,
    },
    connectionTimeoutMillis: 10000,
  };

  const client = new pg.Client(connectionConfig);

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('📝 Executing migration SQL...\n');

    // Execute the migration
    await client.query(sqlContent);

    console.log('✅ Migration executed successfully!\n');

    // Verify constraint was removed
    console.log('🔍 Verifying constraint removal...');
    const verifyQuery = `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'payments'::regclass
        AND conname = 'payments_tx_hash_key';
    `;

    const verifyResult = await client.query(verifyQuery);

    if (verifyResult.rows.length === 0) {
      console.log('✅ UNIQUE constraint successfully removed from payments.tx_hash\n');
    } else {
      console.log('⚠️  Warning: UNIQUE constraint still exists\n');
    }

    // Check if index was created
    const indexQuery = `
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'payments'
        AND indexname = 'idx_payments_tx_hash';
    `;

    const indexResult = await client.query(indexQuery);

    if (indexResult.rows.length > 0) {
      console.log('✅ Non-unique index created: idx_payments_tx_hash\n');
    }

    console.log('🎉 Migration completed successfully!');
    console.log('\n✅ Next steps:');
    console.log('  1. Test batch payment transactions');
    console.log('  2. Verify multiple payments can share the same tx_hash');
    console.log('  3. Check Payment History displays all batch payment records\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    console.error('\n💡 Alternative: Use Supabase Dashboard');
    console.error('   Visit: https://supabase.com/dashboard/project/_/sql');
    console.error('   Copy and paste the SQL from scripts/023_remove_payments_tx_hash_unique.sql\n');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run migration
runMigration().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
