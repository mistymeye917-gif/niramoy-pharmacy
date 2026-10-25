import { spawnSync } from 'node:child_process';
import path from 'node:path';

console.log('====================================================');
console.log('NIRAMOY PHARMACY MANAGEMENT SYSTEM - QA TEST RUNNER');
console.log('====================================================');
console.log('Executing 22 core business & relational database tests...\n');

const res = spawnSync('npx', ['tsx', '-e', `
  import { initDatabase } from './src/db/database.ts';
  import { runAutomatedTests } from './tests/test-runner.ts';
  initDatabase();
  const summary = runAutomatedTests();
  console.log(JSON.stringify(summary, null, 2));
`], { encoding: 'utf-8' });

if (res.error) {
  console.error('Test execution error:', res.error);
  process.exit(1);
}

try {
  // Find JSON in output
  const output = res.stdout;
  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) {
    console.log(output);
    console.error(res.stderr);
    process.exit(1);
  }
  const jsonStr = output.slice(jsonStart);
  const summary = JSON.parse(jsonStr);

  for (const item of summary.results) {
    const symbol = item.status === 'passed' ? '✓ PASS' : '✗ FAIL';
    console.log(`[${symbol}] Test #${item.id}: ${item.name} (${item.durationMs}ms)`);
    if (item.error) {
      console.log(`    Error: ${item.error}`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${summary.total} | PASSED: ${summary.passed} | FAILED: ${summary.failed} | UNTESTED: ${summary.untested}`);
  console.log('----------------------------------------------------');

  if (summary.failed > 0) {
    process.exit(1);
  } else {
    console.log('All 22 critical verification tests passed successfully!\n');
  }
} catch (e) {
  console.log(res.stdout);
  console.error('Failed to parse test output:', e.message);
  process.exit(1);
}
