#!/usr/bin/env node

/**
 * Payments RLS Policy Migration Runner
 * Adds RLS policies to payments table
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  console.log('🚀 Starting payments RLS policy migration...\n');

  // Read environment variables
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

  if (!dbUrl) {
    console.error('❌ Error: POSTGRES_URL_NON_POOLING or POSTGRES_URL not found in environment');
    console.error('Please set the database connection string in .env file');
    process.exit(1);
  }

  // Read migration SQL file
  const sqlFilePath = path.join(__dirname, '022_add_payments_rls_policy.sql');
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

    // Verify policies were created
    console.log('🔍 Verifying RLS policies...');
    const verifyQuery = `
      SELECT policyname, cmd, roles
      FROM pg_policies
      WHERE tablename = 'payments'
      ORDER BY policyname;
    `;

    const verifyResult = await client.query(verifyQuery);

    if (verifyResult.rows.length > 0) {
      console.log(`✅ Found ${verifyResult.rows.length} RLS policies for payments table:\n`);
      verifyResult.rows.forEach((policy, idx) => {
        const roles = Array.isArray(policy.roles) ? policy.roles.join(', ') : policy.roles;
        console.log(`  ${idx + 1}. ${policy.policyname}`);
        console.log(`     Command: ${policy.cmd}`);
        console.log(`     Roles: ${roles}\n`);
      });
    } else {
      console.log('⚠️  Warning: No policies found for payments table');
    }

    // Check if RLS is enabled
    const rlsCheckQuery = `
      SELECT relrowsecurity
      FROM pg_class
      WHERE relname = 'payments'
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `;

    const rlsCheckResult = await client.query(rlsCheckQuery);

    if (rlsCheckResult.rows.length > 0) {
      const rlsEnabled = rlsCheckResult.rows[0].relrowsecurity;
      console.log(`🛡️  Row Level Security: ${rlsEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n`);

      if (!rlsEnabled) {
        console.log('⚠️  Warning: RLS is not enabled on payments table');
        console.log('   Run this SQL to enable RLS:');
        console.log('   ALTER TABLE payments ENABLE ROW LEVEL SECURITY;\n');
      }
    }

    console.log('🎉 Migration completed successfully!');
    console.log('\n✅ Next steps:');
    console.log('  1. Test payment transactions in batch payment page');
    console.log('  2. Verify payment records are saved to database');
    console.log('  3. Check Payment History section displays transactions');
    console.log('  4. Check payments table in Supabase Dashboard\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    console.error('\n💡 Alternative: Use Supabase Dashboard');
    console.error('   Visit: https://supabase.com/dashboard/project/_/sql');
    console.error('   Copy and paste the SQL from scripts/022_add_payments_rls_policy.sql\n');
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
