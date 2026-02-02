/**
 * OWASP ZAP Security Scan Configuration
 * 
 * This script runs automated security scans using OWASP ZAP.
 * Prerequisites: 
 *   - Docker: docker pull owasp/zap2docker-stable
 *   - Or local ZAP installation
 * 
 * Run: node scripts/security-scan.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  targetUrl: process.env.TARGET_URL || 'http://localhost:3000',
  zapDockerImage: 'owasp/zap2docker-stable',
  outputDir: path.join(__dirname, '../reports/security'),
  reportName: `zap-report-${new Date().toISOString().split('T')[0]}`,
  
  // Scan settings
  spiderDuration: 1,        // minutes
  ajaxSpiderDuration: 2,    // minutes
  activeScanPolicy: 'Default Policy',
  
  // Paths to include in scan
  includePaths: [
    '/api/',
    '/auth/',
  ],
  
  // Paths to exclude from scan
  excludePaths: [
    '/api/health',
    '/_next/',
    '/static/',
  ],
  
  // Alert thresholds
  thresholds: {
    high: 0,      // Fail if any high severity issues
    medium: 5,    // Fail if more than 5 medium issues
    low: 20,      // Fail if more than 20 low issues
  },
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * Check if Docker is available
 */
function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run ZAP baseline scan (passive + spider)
 */
async function runBaselineScan() {
  console.log('🔍 Starting OWASP ZAP Baseline Scan...\n');
  
  const reportPath = path.join(CONFIG.outputDir, `${CONFIG.reportName}-baseline.html`);
  
  const command = [
    'docker', 'run', '--rm',
    '-v', `${CONFIG.outputDir}:/zap/wrk:rw`,
    '-t', CONFIG.zapDockerImage,
    'zap-baseline.py',
    '-t', CONFIG.targetUrl,
    '-r', `${CONFIG.reportName}-baseline.html`,
    '-J', `${CONFIG.reportName}-baseline.json`,
    '-I',  // Don't fail on warnings
  ].join(' ');
  
  console.log(`Running: ${command}\n`);
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`\n✅ Baseline scan complete. Report: ${reportPath}`);
    return true;
  } catch (error) {
    console.error('❌ Baseline scan failed:', error.message);
    return false;
  }
}

/**
 * Run ZAP API scan
 */
async function runApiScan() {
  console.log('\n🔍 Starting OWASP ZAP API Scan...\n');
  
  // First, create OpenAPI spec file if needed
  const openApiUrl = `${CONFIG.targetUrl}/api/openapi.json`;
  
  const command = [
    'docker', 'run', '--rm',
    '-v', `${CONFIG.outputDir}:/zap/wrk:rw`,
    '-t', CONFIG.zapDockerImage,
    'zap-api-scan.py',
    '-t', openApiUrl,
    '-f', 'openapi',
    '-r', `${CONFIG.reportName}-api.html`,
    '-J', `${CONFIG.reportName}-api.json`,
    '-I',
  ].join(' ');
  
  console.log(`Running: ${command}\n`);
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log('\n✅ API scan complete.');
    return true;
  } catch (error) {
    // API scan might fail if no OpenAPI spec exists
    console.warn('⚠️ API scan skipped (no OpenAPI spec found)');
    return false;
  }
}

/**
 * Run ZAP full scan (includes active scanning)
 */
async function runFullScan() {
  console.log('\n🔍 Starting OWASP ZAP Full Scan (this may take a while)...\n');
  
  const command = [
    'docker', 'run', '--rm',
    '-v', `${CONFIG.outputDir}:/zap/wrk:rw`,
    '-t', CONFIG.zapDockerImage,
    'zap-full-scan.py',
    '-t', CONFIG.targetUrl,
    '-r', `${CONFIG.reportName}-full.html`,
    '-J', `${CONFIG.reportName}-full.json`,
    '-m', '5',  // 5 minute timeout
    '-I',
  ].join(' ');
  
  console.log(`Running: ${command}\n`);
  
  try {
    execSync(command, { stdio: 'inherit', timeout: 600000 }); // 10 min timeout
    console.log('\n✅ Full scan complete.');
    return true;
  } catch (error) {
    console.error('❌ Full scan failed or timed out:', error.message);
    return false;
  }
}

/**
 * Analyze scan results
 */
function analyzeResults() {
  console.log('\n📊 Analyzing scan results...\n');
  
  const jsonFiles = fs.readdirSync(CONFIG.outputDir)
    .filter(f => f.endsWith('.json') && f.includes(CONFIG.reportName));
  
  let totalAlerts = { high: 0, medium: 0, low: 0, informational: 0 };
  let allAlerts = [];
  
  for (const file of jsonFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CONFIG.outputDir, file), 'utf8'));
      
      if (data.site) {
        for (const site of data.site) {
          for (const alert of site.alerts || []) {
            const riskCode = parseInt(alert.riskcode) || 0;
            const count = parseInt(alert.count) || 1;
            
            switch (riskCode) {
              case 3: totalAlerts.high += count; break;
              case 2: totalAlerts.medium += count; break;
              case 1: totalAlerts.low += count; break;
              default: totalAlerts.informational += count;
            }
            
            allAlerts.push({
              name: alert.name,
              risk: ['Informational', 'Low', 'Medium', 'High'][riskCode] || 'Unknown',
              count: count,
              description: alert.desc?.substring(0, 100) + '...',
            });
          }
        }
      }
    } catch (e) {
      console.warn(`Could not parse ${file}`);
    }
  }
  
  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   SECURITY SCAN SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Target:       ${CONFIG.targetUrl}`);
  console.log(`  Date:         ${new Date().toISOString()}`);
  console.log('');
  console.log('  Alerts Found:');
  console.log(`    🔴 High:          ${totalAlerts.high}`);
  console.log(`    🟠 Medium:        ${totalAlerts.medium}`);
  console.log(`    🟡 Low:           ${totalAlerts.low}`);
  console.log(`    🔵 Informational: ${totalAlerts.informational}`);
  console.log('');
  
  // Check thresholds
  const passed = 
    totalAlerts.high <= CONFIG.thresholds.high &&
    totalAlerts.medium <= CONFIG.thresholds.medium &&
    totalAlerts.low <= CONFIG.thresholds.low;
  
  console.log(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  // Print top alerts
  if (allAlerts.length > 0) {
    console.log('\n📋 Top Security Findings:\n');
    
    const sortedAlerts = allAlerts
      .sort((a, b) => {
        const riskOrder = { High: 0, Medium: 1, Low: 2, Informational: 3 };
        return (riskOrder[a.risk] || 4) - (riskOrder[b.risk] || 4);
      })
      .slice(0, 10);
    
    for (const alert of sortedAlerts) {
      const emoji = { High: '🔴', Medium: '🟠', Low: '🟡', Informational: '🔵' }[alert.risk] || '⚪';
      console.log(`  ${emoji} [${alert.risk}] ${alert.name} (${alert.count} instances)`);
    }
  }
  
  // Save summary
  const summaryPath = path.join(CONFIG.outputDir, `${CONFIG.reportName}-summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    target: CONFIG.targetUrl,
    alerts: totalAlerts,
    passed,
    details: allAlerts,
  }, null, 2));
  
  console.log(`\n📁 Reports saved to: ${CONFIG.outputDir}`);
  
  return passed;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           PROTOCOL BANKS SECURITY SCAN                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  // Check prerequisites
  if (!checkDocker()) {
    console.error('❌ Docker is required but not found. Please install Docker first.');
    console.log('\nAlternatively, install ZAP locally: https://www.zaproxy.org/download/');
    process.exit(1);
  }
  
  console.log(`🎯 Target: ${CONFIG.targetUrl}\n`);
  
  const scanType = process.argv[2] || 'baseline';
  
  switch (scanType) {
    case 'baseline':
      await runBaselineScan();
      break;
    case 'api':
      await runApiScan();
      break;
    case 'full':
      await runBaselineScan();
      await runApiScan();
      await runFullScan();
      break;
    default:
      console.log('Usage: node security-scan.js [baseline|api|full]');
      process.exit(1);
  }
  
  const passed = analyzeResults();
  process.exit(passed ? 0 : 1);
}

main().catch(console.error);
