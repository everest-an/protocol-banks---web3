#!/usr/bin/env node

/**
 * Get All Vendors Data
 * Fetches and displays all data from the vendors table
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function getVendorsData() {
  console.log('🔍 Fetching vendors table data...\n');

  // Read environment variables
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

  if (!dbUrl) {
    console.error('❌ Error: POSTGRES_URL_NON_POOLING or POSTGRES_URL not found in environment');
    console.error('Please set the database connection string in .env file');
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

    // ==========================================
    // 1. Check if vendors table exists
    // ==========================================
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'vendors'
      );
    `;

    const tableExistsResult = await client.query(tableExistsQuery);
    const tableExists = tableExistsResult.rows[0].exists;

    if (!tableExists) {
      console.log('⚠️  Table "vendors" does not exist in the database');
      console.log('\nTo create the vendors table, run:');
      console.log(`
CREATE TABLE vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
      `);
      return;
    }

    // ==========================================
    // 2. Get table schema
    // ==========================================
    console.log('📋 TABLE SCHEMA: vendors');
    console.log('─'.repeat(80));

    const columnsQuery = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vendors'
      ORDER BY ordinal_position;
    `;

    const columnsResult = await client.query(columnsQuery);

    console.log('\n📝 Columns:');
    columnsResult.rows.forEach((col, idx) => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` (default: ${col.column_default})` : '';
      console.log(`  ${idx + 1}. ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
    });

    // ==========================================
    // 3. Get row count
    // ==========================================
    const countQuery = `SELECT COUNT(*) as count FROM vendors`;
    const countResult = await client.query(countQuery);
    const rowCount = parseInt(countResult.rows[0].count);

    console.log(`\n📊 Total Rows: ${rowCount}\n`);

    if (rowCount === 0) {
      console.log('⚠️  No data found in vendors table\n');
      return;
    }

    // ==========================================
    // 4. Get all data
    // ==========================================
    console.log('─'.repeat(80));
    console.log('📦 VENDORS DATA');
    console.log('─'.repeat(80));

    const dataQuery = `
      SELECT *
      FROM vendors
      ORDER BY created_at DESC;
    `;

    const dataResult = await client.query(dataQuery);

    console.log(`\nFound ${dataResult.rows.length} vendor(s):\n`);

    dataResult.rows.forEach((vendor, index) => {
      console.log(`\n${index + 1}. ┌${'─'.repeat(78)}┐`);
      console.log(`   │ ID:              ${vendor.id || 'N/A'}`.padEnd(81) + '│');
      console.log(`   │ Name:            ${vendor.name || 'N/A'}`.padEnd(81) + '│');
      console.log(`   │ Wallet Address:  ${vendor.wallet_address || 'N/A'}`.padEnd(81) + '│');
      console.log(`   │ Category:        ${vendor.category || 'N/A'}`.padEnd(81) + '│');
      console.log(`   │ Created At:      ${vendor.created_at ? new Date(vendor.created_at).toLocaleString() : 'N/A'}`.padEnd(81) + '│');
      console.log(`   └${'─'.repeat(78)}┘`);
    });

    // ==========================================
    // 5. Export to JSON (optional)
    // ==========================================
    console.log('\n─'.repeat(80));
    console.log('💾 EXPORT OPTIONS');
    console.log('─'.repeat(80));

    const exportDir = path.join(__dirname, '../exports');
    const exportFile = path.join(exportDir, `vendors-${Date.now()}.json`);

    // Create exports directory if it doesn't exist
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Write to JSON file
    fs.writeFileSync(exportFile, JSON.stringify(dataResult.rows, null, 2));
    console.log(`\n✅ Data exported to: ${exportFile}\n`);

    // ==========================================
    // 6. Check RLS status
    // ==========================================
    const rlsCheckQuery = `
      SELECT relrowsecurity
      FROM pg_class
      WHERE relname = 'vendors'
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `;

    const rlsCheckResult = await client.query(rlsCheckQuery);

    if (rlsCheckResult.rows.length > 0) {
      const rlsEnabled = rlsCheckResult.rows[0].relrowsecurity;
      console.log('─'.repeat(80));
      console.log('🛡️  ROW LEVEL SECURITY');
      console.log('─'.repeat(80));
      console.log(`\nStatus: ${rlsEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n`);

      if (rlsEnabled) {
        // Get RLS policies
        const policiesQuery = `
          SELECT
            policyname,
            cmd,
            roles,
            qual,
            with_check
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'vendors'
          ORDER BY policyname;
        `;

        const policiesResult = await client.query(policiesQuery);

        if (policiesResult.rows.length > 0) {
          console.log('Active Policies:');
          policiesResult.rows.forEach((policy, i) => {
            const roles = Array.isArray(policy.roles) ? policy.roles.join(', ') : policy.roles;
            console.log(`\n  ${i + 1}. ${policy.policyname}`);
            console.log(`     Command: ${policy.cmd}`);
            console.log(`     Roles: ${roles}`);
          });
        } else {
          console.log('⚠️  RLS is enabled but no policies found!');
          console.log('\nTo allow insertions, run:');
          console.log(`
CREATE POLICY "Enable insert for all users" ON vendors
  FOR INSERT
  WITH CHECK (true);
          `);
        }
      }
    }

    console.log('\n✅ Vendors data fetching completed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the script
getVendorsData().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
