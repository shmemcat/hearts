import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const source = await readFile(resolve(import.meta.dirname, '../.github/workflows/release.yml'), 'utf8');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
function stepScript(name) {
  const lines = source.split('\n');
  const start = lines.indexOf(`      - name: ${name}`);
  assert(start >= 0, `Missing release gate: ${name}`);
  let end = lines.findIndex((line, i) => i > start && /^      - /.test(line));
  if (end < 0) end = lines.length;
  const step = lines.slice(start, end);
  const run = step.indexOf('        run: |');
  assert(run >= 0);
  return step.slice(run + 1).map((line) => line.slice(10)).join('\n');
}
function run(script, env) {
  const result = spawnSync(bash, ['-e', '-o', 'pipefail', '-c', script], {
    env: { ...process.env, RELEASE_TAG: 'v1.2.3', ...env },
    encoding: 'utf8', windowsHide: true,
  });
  assert.ifError(result.error);
  return result.status;
}

test('legacy publishing exposes only manual dispatch and never updates latest', () => {
  const triggers = source.match(/^on:\n([\s\S]*?)^\S/m)?.[1];
  assert(triggers);
  assert.deepEqual([...triggers.matchAll(/^  ([a-z_]+):/gm)].map((m) => m[1]), ['workflow_dispatch']);
  assert.match(triggers, /acknowledge_legacy:\n[\s\S]*?type: boolean\n[\s\S]*?default: false/);
  assert(!source.includes(':latest'));
  assert(!source.includes('github.ref_name'));
  assert(source.indexOf('Require explicit legacy publication') < source.indexOf('uses: actions/checkout'));
  assert(source.indexOf('Refuse existing legacy image tags') < source.indexOf('uses: docker/build-push-action'));
});

test('the actual manual gate rejects missing acknowledgement and invalid source tags', () => {
  const script = stepScript('Require explicit legacy publication');
  for (const value of ['', 'false', 'yes']) assert.notEqual(run(script, { ACKNOWLEDGE_LEGACY: value }), 0);
  assert.equal(run(script, { ACKNOWLEDGE_LEGACY: 'true' }), 0);
  for (const tag of ['main', 'game-v1.2.3', 'v1.2.3;echo unsafe', 'v1.2.3\nother', ''])
    assert.notEqual(run(script, { ACKNOWLEDGE_LEGACY: 'true', RELEASE_TAG: tag }), 0);
});

test('the actual image guard refuses overwrites and ambiguous registry failures', () => {
  const script = `docker() { printf '%s' "$INSPECT_OUTPUT"; return "$INSPECT_STATUS"; }\n` +
    stepScript('Refuse existing legacy image tags');
  assert.notEqual(run(script, { INSPECT_OUTPUT: 'published manifest', INSPECT_STATUS: '0' }), 0);
  for (const output of ['manifest unknown', 'image not found', '404 Not Found'])
    assert.equal(run(script, { INSPECT_OUTPUT: output, INSPECT_STATUS: '1' }), 0);
  for (const output of ['unauthorized: 404', 'UNAUTHORIZED: 404', 'connection refused',
    'context deadline exceeded', '404 no such host', 'forbidden: not found', 'timeout: 404'])
    assert.notEqual(run(script, { INSPECT_OUTPUT: output, INSPECT_STATUS: '1' }), 0);
});
