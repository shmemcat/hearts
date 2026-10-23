import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateTag(config, tag) {
  if (!new RegExp('^' + config.tagPrefix + '[0-9]+\\.[0-9]+\\.[0-9]+$').test(tag))
    throw new Error('Use an existing ' + config.tagPrefix + 'MAJOR.MINOR.PATCH tag.');
  return `${config.image}:${tag}`;
}
export function requireAbsent(result) {
  if (result.error) throw result.error;
  if (result.status === 0)
    throw new Error(
      'That image tag already exists. Versioned component images cannot be overwritten.'
    );
  const message = result.stderr || '';
  if (
    !/\bmanifest unknown\b|\bnot found\b|\b404\b/i.test(message) ||
    /unauthorized|denied|forbidden|timeout|timed out|connection|no such host/i.test(message)
  )
    throw new Error('Unable to establish that the image tag is unused: ' + message);
}
export function releaseRecord(config, tag, revision, digest) {
  validateTag(config, tag);
  if (!/^[a-f0-9]{40}$/.test(revision) || !/^sha256:[a-f0-9]{64}$/.test(digest))
    throw new Error('A complete source revision and registry digest are required.');
  return {
    version: 1,
    component: config.component,
    release: tag,
    image: config.image + '@' + digest,
    sourceRevision: revision,
    accountsContract: 1,
    schemaRevision: config.schemaRevision,
    migrationCommand: config.package ? ['python', '-m', config.package + '.schema', 'upgrade'] : [],
  };
}
export async function main([operation, tag, revision, digest], component = 'component') {
  const root = resolve(import.meta.dirname, '..');
  const config = JSON.parse(await readFile(resolve(root, `release/${component}.json`), 'utf8'));
  const image = validateTag(config, tag);
  if (operation === 'check') {
    requireAbsent(
      spawnSync('docker', ['buildx', 'imagetools', 'inspect', image], {
        encoding: 'utf8',
        windowsHide: true,
      })
    );
  } else if (operation === 'record') {
    const directory = resolve(root, 'release-artifacts');
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, config.component + '.json'),
      JSON.stringify(releaseRecord(config, tag, revision, digest), null, 2) + '\n'
    );
  } else throw new Error('Use check or record');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const flag = args[0];
  const component = flag === '--gateway' ? 'gateway' : flag === '--web' ? 'web' : 'component';
  if (component !== 'component') args.shift();
  main(args, component).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
