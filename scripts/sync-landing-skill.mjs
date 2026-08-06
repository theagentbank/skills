#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetFlag = process.argv.indexOf('--target');
const targetRoot = targetFlag >= 0 ? process.argv[targetFlag + 1] : undefined;

if (!targetRoot) {
  throw new Error('Usage: node scripts/sync-landing-skill.mjs --target <landing-page-repo>');
}

const source = path.join(repoRoot, 'dist', 'agentbank-pay', 'SKILL.md');
const destination = path.join(targetRoot, 'public', 'SKILL.md');
const packageJson = JSON.parse(
  await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
);
const skill = await readFile(source);
const sourceCommit = process.env.GITHUB_SHA;

if (!sourceCommit) {
  throw new Error('GITHUB_SHA is required to record the source revision.');
}

await mkdir(path.dirname(destination), { recursive: true });
await cp(source, destination);

const manifest = {
  source: 'https://github.com/theagentbank/skills',
  skill: 'agentbank-pay',
  release: process.env.GITHUB_REF_NAME ?? packageJson.version,
  sourceCommit,
  sha256: createHash('sha256').update(skill).digest('hex'),
};

await writeFile(
  path.join(targetRoot, 'public', 'agentbank-pay.manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

process.stdout.write(
  `Synced ${path.relative(repoRoot, source)} to ${path.relative(targetRoot, destination)}\n`,
);
