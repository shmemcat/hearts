import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { validateTag, requireAbsent, releaseRecord } from './component-release.mjs';

const config = JSON.parse(
  await readFile(resolve(import.meta.dirname, '../release/component.json'), 'utf8')
);
test('component releases accept only their own explicit semantic version tags', () => {
  assert.equal(
    validateTag(config, config.tagPrefix + '1.2.3'),
    config.image + ':' + config.tagPrefix + '1.2.3'
  );
  for (const value of [
    'v1.2.3',
    'latest',
    'main',
    config.tagPrefix + '1.2',
    config.tagPrefix + '1.2.3;echo bad',
  ])
    assert.throws(() => validateTag(config, value));
});
test('immutable publish refuses existing tags and registry or authentication failures', () => {
  assert.doesNotThrow(() =>
    requireAbsent({ status: 1, stderr: 'ERROR: registry/image:version: not found' })
  );
  assert.throws(() => requireAbsent({ status: 0, stderr: '' }), /already exists/);
  for (const stderr of [
    'unauthorized: 404',
    'connection refused',
    'context deadline exceeded',
    'forbidden',
    '404 no such host',
  ])
    assert.throws(() => requireAbsent({ status: 1, stderr }));
  assert.throws(() => requireAbsent({ error: new Error('no Docker') }));
});
test('release records pin one component with source, account contract, and migration metadata', () => {
  const record = releaseRecord(
    config,
    config.tagPrefix + '1.2.3',
    'a'.repeat(40),
    'sha256:' + 'b'.repeat(64)
  );
  assert.equal(record.image, config.image + '@sha256:' + 'b'.repeat(64));
  assert.equal(record.accountsContract, 1);
  assert.equal(record.component, config.component);
  assert.deepEqual(record.migrationCommand, [
    'python',
    '-m',
    config.package + '.schema',
    'upgrade',
  ]);
  assert.throws(() => releaseRecord(config, config.tagPrefix + '1.2.3', 'main', 'latest'));
});
