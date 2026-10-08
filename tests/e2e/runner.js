#!/usr/bin/env node
/**
 * Master E2E Test Runner for Cloud Coding AI Agent (openrouter-chat).
 * 
 * Usage:
 *   node tests/e2e/runner.js [options]
 * 
 * Options:
 *   --suite=<name>    Run specific suite: ac1, ac2, ac3, tier1, tier2, tier3, tier4, or all (default: all)
 *   --live            Use live credentials (GITHUB_TOKEN) instead of mock server
 *   --verbose         Print detailed diagnostic logs
 *   --json            Output results as JSON
 *   --help            Show this help message
 */

const fs = require('node:fs');
const path = require('node:path');

// ANSI Color formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

// Try loading environment from .env.local if present
function loadEnvLocal(projectRoot) {
  const envPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    } catch {
      // Ignore env parsing error
    }
  }
}

// Available Suites
const SUITES = {
  ac1: { file: './ac1_github.test.js', label: 'AC1: GitHub Verification' },
  ac2: { file: './ac2_sandbox.test.js', label: 'AC2: Sandbox Verification' },
  ac3: { file: './ac3_agent.test.js', label: 'AC3: Agent Workflow' },
  tier1: { file: './tier1_features.test.js', label: 'Tier 1: Feature Coverage' },
  tier2: { file: './tier2_boundaries.test.js', label: 'Tier 2: Boundary Cases' },
  tier3: { file: './tier3_interactions.test.js', label: 'Tier 3: Cross Interactions' },
  tier4: { file: './tier4_stress.test.js', label: 'Tier 4: Stress & Workloads' },
};

async function main() {
  const args = process.argv.slice(2);
  const projectRoot = path.resolve(__dirname, '../..');
  loadEnvLocal(projectRoot);

  const parsedArgs = {
    suite: 'all',
    live: false,
    verbose: false,
    json: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
Cloud Coding AI Agent — E2E Test Runner

Usage:
  node tests/e2e/runner.js [options]

Options:
  --suite=<name>    ac1, ac2, ac3, tier1, tier2, tier3, tier4, all (default: all)
  --live            Run against live GitHub API (requires GITHUB_TOKEN)
  --verbose         Print verbose logs
  --json            Output results in JSON format
  --help            Show help
      `);
      process.exit(0);
    } else if (arg.startsWith('--suite=')) {
      parsedArgs.suite = arg.split('=')[1].toLowerCase();
    } else if (arg === '--live') {
      parsedArgs.live = true;
    } else if (arg === '--verbose') {
      parsedArgs.verbose = true;
    } else if (arg === '--json') {
      parsedArgs.json = true;
    }
  }

  const suitesToRun = [];
  if (parsedArgs.suite === 'all') {
    suitesToRun.push('ac1', 'ac2', 'ac3', 'tier1', 'tier2', 'tier3', 'tier4');
  } else if (SUITES[parsedArgs.suite]) {
    suitesToRun.push(parsedArgs.suite);
  } else {
    console.error(`${colors.red}Error: Unknown suite "${parsedArgs.suite}". Available: ${Object.keys(SUITES).join(', ')}, all${colors.reset}`);
    process.exit(1);
  }

  if (!parsedArgs.json) {
    console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}  Cloud Coding AI Agent — Automated E2E Test Suite    ${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);
    console.log(`${colors.gray}Environment: Node ${process.version} | Platform: ${process.platform} | Mode: ${parsedArgs.live ? 'LIVE' : 'MOCK/HERMETIC'}${colors.reset}\n`);
  }

  const overallResults = {
    timestamp: new Date().toISOString(),
    mode: parsedArgs.live ? 'live' : 'hermetic',
    suites: [],
    summary: {
      totalSuites: suitesToRun.length,
      passedSuites: 0,
      failedSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      durationMs: 0,
    },
  };

  const overallStartTime = Date.now();

  for (const suiteKey of suitesToRun) {
    const suiteMeta = SUITES[suiteKey];
    const suiteModule = require(suiteMeta.file);
    const suiteName = suiteModule.name || suiteMeta.label;

    if (!parsedArgs.json) {
      console.log(`${colors.bold}▶ Running Suite: ${colors.yellow}${suiteName}${colors.reset}`);
    }

    const suiteStartTime = Date.now();
    let testResults = [];
    let suiteError = null;

    try {
      testResults = await suiteModule.run({
        live: parsedArgs.live,
        verbose: parsedArgs.verbose,
        projectRoot,
      });
    } catch (err) {
      suiteError = err.message;
    }

    const suiteDuration = Date.now() - suiteStartTime;
    const suitePassed = !suiteError && testResults.every((t) => t.passed);

    if (suitePassed) {
      overallResults.summary.passedSuites++;
    } else {
      overallResults.summary.failedSuites++;
    }

    for (const t of testResults) {
      overallResults.summary.totalTests++;
      if (t.passed) {
        overallResults.summary.passedTests++;
        if (!parsedArgs.json) {
          console.log(`  ${colors.green}✔ PASS${colors.reset}  ${t.name} ${colors.gray}(${t.details || ''})${colors.reset}`);
        }
      } else {
        overallResults.summary.failedTests++;
        if (!parsedArgs.json) {
          console.log(`  ${colors.red}✖ FAIL${colors.reset}  ${t.name}`);
          console.log(`         ${colors.red}Error: ${t.error}${colors.reset}`);
        }
      }
    }

    if (suiteError && !parsedArgs.json) {
      console.log(`  ${colors.red}✖ SUITE ERROR${colors.reset}: ${suiteError}`);
    }

    if (!parsedArgs.json) {
      console.log(`  ${colors.dim}Suite completed in ${suiteDuration}ms${colors.reset}\n`);
    }

    overallResults.suites.push({
      key: suiteKey,
      name: suiteName,
      passed: suitePassed,
      durationMs: suiteDuration,
      tests: testResults,
      error: suiteError,
    });
  }

  overallResults.summary.durationMs = Date.now() - overallStartTime;

  if (parsedArgs.json) {
    console.log(JSON.stringify(overallResults, null, 2));
  } else {
    console.log(`${colors.bold}${colors.cyan}------------------------------------------------------${colors.reset}`);
    console.log(`${colors.bold}Summary:${colors.reset}`);
    console.log(`  Suites:  ${overallResults.summary.passedSuites === overallResults.summary.totalSuites ? colors.green : colors.red}${overallResults.summary.passedSuites}/${overallResults.summary.totalSuites} passed${colors.reset}`);
    console.log(`  Tests:   ${overallResults.summary.failedTests === 0 ? colors.green : colors.red}${overallResults.summary.passedTests}/${overallResults.summary.totalTests} passed${colors.reset}`);
    console.log(`  Time:    ${overallResults.summary.durationMs}ms`);
    console.log(`${colors.bold}${colors.cyan}------------------------------------------------------${colors.reset}`);

    if (overallResults.summary.failedTests === 0 && overallResults.summary.failedSuites === 0) {
      console.log(`\n${colors.bold}${colors.green}✅ ALL TEST SUITES PASSED! [100% SUCCESS]${colors.reset}\n`);
    } else {
      console.log(`\n${colors.bold}${colors.red}❌ SOME TESTS FAILED. Inspect details above.${colors.reset}\n`);
    }
  }

  // Save report artifact to tests/e2e/report.json
  try {
    const reportPath = path.join(__dirname, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(overallResults, null, 2), 'utf-8');
  } catch {
    // Non-fatal
  }

  const exitCode = (overallResults.summary.failedTests === 0 && overallResults.summary.failedSuites === 0) ? 0 : 1;
  process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal runner error:', err);
    process.exit(1);
  });
}

module.exports = { main };
