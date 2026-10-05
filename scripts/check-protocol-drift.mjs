#!/usr/bin/env node

// Maintainer check: compares the backend skill file in a local protocol-core
// checkout with the bytes this repository last imported. The live URL, not
// the git checkout, is what the importer and CI use.
//
//   node scripts/check-protocol-drift.mjs [--target ../protocol-core]

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePorcelainPath } from './git-porcelain.mjs';
import { sha256 } from './skill-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const target = path.resolve(
  targetIndex >= 0 && args[targetIndex + 1]
    ? args[targetIndex + 1]
    : path.join(root, '..', 'protocol-core'),
);
const marker = JSON.parse(
  await readFile(path.join(root, 'protocol-core-sync.json'), 'utf8'),
);
const sourcePath = marker.source_path ?? 'mcp-agent-server/skills/agentbank-pay/SKILL.md';

function git(gitArgs) {
  const result = spawnSync('git', ['-C', target, ...gitArgs], {
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${gitArgs.join(' ')} failed`);
  }
  // Preserve the leading index/worktree status columns in porcelain output.
  return result.stdout.trimEnd();
}

const head = git(['rev-parse', 'HEAD']);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const dirty = git(['status', '--porcelain', '--', sourcePath])
  .split('\n')
  .filter(Boolean)
  .map(parsePorcelainPath);
const bytes = await readFile(path.join(target, sourcePath));
const localSha = sha256(bytes);
const where = `${target} (${branch} @ ${head.slice(0, 12)}${dirty.length ? ', uncommitted changes' : ''})`;

if (localSha === marker.source_sha256) {
  process.stdout.write(`Backend skill in ${where} matches the imported sha256 ${localSha}\n`);
  process.exit(0);
}
process.stderr.write(
  `Backend skill in ${where} differs from the imported source.\n` +
    `  ${sourcePath}: sha256 ${localSha}\n` +
    `  imported ${marker.source_url}: sha256 ${marker.source_sha256}\n` +
    'The live URL is authoritative for imports; pull protocol-core or wait for its deploy, then run npm run import:backend.\n',
);
process.exit(1);
