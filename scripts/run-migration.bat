@echo off
REM Multi-Network Support Migration Runner (Windows)
REM This script runs the database migration for multi-network support

echo ==================================
echo Multi-Network Migration Script
echo ==================================
echo.

REM Check if database is running
echo 1. Checking database connection...
pnpm prisma db execute --stdin < nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Database is accessible
) else (
    echo [ERROR] Database is not running on localhost:51214
    echo.
    echo Please start your PostgreSQL database first:
    echo   - Docker: docker start ^<postgres-container^>
    echo   - Local: pg_ctl start -D /path/to/data
    echo.
    exit /b 1
)

REM Run Prisma schema push
echo.
echo 2. Pushing Prisma schema to database...
pnpm prisma db push --accept-data-loss
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to push schema
    exit /b 1
)

REM Generate Prisma client
echo.
echo 3. Generating Prisma client...
pnpm prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to generate Prisma client
    exit /b 1
)

REM Note about SQL migration
echo.
echo 4. Additional SQL features (views, functions, triggers)...
echo    Note: Manual SQL execution required for advanced features
echo.
echo    Run this command manually if you have psql installed:
echo    psql -h localhost -p 51214 -U postgres -d template1 -f scripts\009_multi_network_support.sql
echo.

echo ==================================
echo [OK] Migration completed successfully!
echo ==================================
echo.
echo Next steps:
echo   1. Run tests: pnpm test
echo   2. Start dev server: pnpm dev
echo   3. Test API endpoints (see docs\TESTING_GUIDE.md)
echo.

pause
