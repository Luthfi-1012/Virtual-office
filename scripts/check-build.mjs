import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

let traces = 0;
for (const file of readdirSync('.next/server', { recursive: true }).filter(file => file.endsWith('.nft.json'))) {
  const tracePath = join('.next/server', file);
  const trace = JSON.parse(readFileSync(tracePath, 'utf8'));
  const protectedFiles = trace.files.filter(file => {
    const path = relative(process.cwd(), resolve(tracePath, '..', file)).replaceAll('\\', '/');
    return !path.startsWith('node_modules/') && /(^|\/)(\.local|qoderwake-transfer-2026-11-18|test-results|\.env[^/]*|[^/]*(?:credentials|secrets)[^/]*)(\/|$)/i.test(path);
  });
  assert.equal(protectedFiles.length, 0, `${file}: protected local files included in build tracing`);
  traces++;
}
assert.ok(traces > 0, 'No production traces found; run npm run build first.');
let chunks = 0;
for (const file of readdirSync('.next/static', { recursive: true }).filter(file => file.endsWith('.js'))) {
  const source = readFileSync(join('.next/static', file), 'utf8');
  assert.doesNotMatch(source, /better-sqlite3|OFFICE_DB_PATH|QODERWAKE_CLI_PATH|qoderwake-transfer-2026-11-18/, `${file}: server-only identifier in browser bundle`);
  chunks++;
}
assert.ok(chunks > 0, 'No browser chunks found.');
console.log(`PASS: ${traces} server traces exclude protected local files; ${chunks} browser chunks exclude checked server identifiers.`);
