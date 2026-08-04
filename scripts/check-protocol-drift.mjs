#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePorcelainPath } from './git-porcelain.mjs';

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
const relevantPaths = [
  'mcp-agent-server',
  'backend-core/src/modules/agent',
  'backend-core/src/modules/identity',
  'backend-core/src/modules/payment',
  'humanfx-inhouse-solver/src',
];
const generatedCompatibilityPaths = new Set([
  'mcp-agent-server/skills/agentbank-pay/SKILL.md',
  'mcp-agent-server/skills/agentbank-pay/agents/openai.yaml',
]);

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
const dirty = git([
  'status',
  '--porcelain',
  '--untracked-files=all',
  '--',
  ...relevantPaths,
])
  .split('\n')
  .filter(Boolean)
  .filter((line) => {
    const changedPath = parsePorcelainPath(line);
    return !generatedCompatibilityPaths.has(changedPath);
  });

if (head === marker.source_commit && dirty.length === 0) {
  process.stdout.write(`Protocol-core is synchronized at ${head}\n`);
  process.exit(0);
}

const ancestor = spawnSync(
  'git',
  ['-C', target, 'merge-base', '--is-ancestor', marker.source_commit, head],
  { shell: false },
);
if (ancestor.status !== 0) {
  process.stderr.write(
    `Recorded protocol commit ${marker.source_commit} is not an ancestor of ${head}. Re-audit the full divergence.\n`,
  );
  process.exit(1);
}

const range = `${marker.source_commit}..${head}`;
const commits =
  head === marker.source_commit
    ? ''
    : git(['log', '--date=iso-strict', '--format=%h %ad %s', range]);
const files =
  head === marker.source_commit
    ? ''
    : git(['diff', '--name-only', range, '--', ...relevantPaths]);
process.stderr.write(
  `Protocol-core differs from the recorded sync.\n\nCommits:\n${commits || '(none)'}\n\nRelevant committed files:\n${files || '(none)'}\n\nRelevant working-tree changes:\n${dirty.join('\n') || '(none)'}\n`,
);
process.exit(1);
