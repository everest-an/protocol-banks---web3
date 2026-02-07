#!/bin/bash

# Multi-Network Support Migration Runner
# This script runs the database migration for multi-network support

set -e  # Exit on error

echo "=================================="
echo "Multi-Network Migration Script"
echo "=================================="
echo ""

# Check if database is running
echo "1. Checking database connection..."
if pnpm prisma db execute --stdin < /dev/null 2>/dev/null; then
    echo "✓ Database is accessible"
else
    echo "✗ Database is not running on localhost:51214"
    echo ""
    echo "Please start your PostgreSQL database first:"
    echo "  - Docker: docker start <postgres-container>"
    echo "  - Local: pg_ctl start -D /path/to/data"
    echo ""
    exit 1
fi

# Run Prisma schema push
echo ""
echo "2. Pushing Prisma schema to database..."
pnpm prisma db push --accept-data-loss

# Generate Prisma client
echo ""
echo "3. Generating Prisma client..."
pnpm prisma generate

# Run SQL migration for views, functions, triggers
echo ""
echo "4. Applying additional SQL features (views, functions, triggers)..."
echo "   Note: This requires psql to be installed"

# Extract connection details from .env
if command -v psql &> /dev/null; then
    # Note: You may need to adjust these connection parameters
    # based on your DATABASE_URL format
    psql -h localhost -p 51214 -U postgres -d template1 -f scripts/009_multi_network_support.sql
    echo "✓ SQL migration applied successfully"
else
    echo "⚠ psql not found. Skipping advanced SQL features."
    echo "  Views, functions, and triggers were not created."
    echo "  You can run them manually later:"
    echo "  psql -h localhost -p 51214 -U postgres -d template1 -f scripts/009_multi_network_support.sql"
fi

echo ""
echo "=================================="
echo "✓ Migration completed successfully!"
echo "=================================="
echo ""
echo "Next steps:"
echo "  1. Run tests: pnpm test"
echo "  2. Start dev server: pnpm dev"
echo "  3. Test API endpoints (see docs/TESTING_GUIDE.md)"
echo ""
