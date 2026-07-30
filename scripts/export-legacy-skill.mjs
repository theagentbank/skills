#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLegacy } from './legacy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(repoRoot, 'dist', 'agentbank-pay', 'SKILL.md');

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, await renderLegacy(repoRoot));
process.stdout.write(`Wrote ${path.relative(repoRoot, output)}\n`);
