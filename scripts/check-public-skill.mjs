#!/usr/bin/env node

// Verifies the public skill URL serves exactly the imported backend file
// (dist/agentbank-pay/SKILL.md).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256 } from './skill-layout.mjs';

export { sha256 };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SKILL_URL = 'https://useagentbank.com/SKILL.md';

export function comparePublicSkill(published, local) {
  const errors = [];
  const publishedSha = sha256(published);
  const localSha = sha256(local);
  if (!Buffer.from(published).equals(Buffer.from(local))) {
    errors.push(
      `Published SKILL.md (sha256 ${publishedSha}, ${published.length} bytes) differs from dist/agentbank-pay/SKILL.md (sha256 ${localSha}, ${local.length} bytes)`,
    );
  }
  return errors;
}

async function main() {
  const skillUrl = process.argv[2] ?? DEFAULT_SKILL_URL;
  const response = await fetch(skillUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${skillUrl} returned HTTP ${response.status}`);
  const published = Buffer.from(await response.arrayBuffer());
  const local = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'));
  const errors = comparePublicSkill(published, local);
  if (errors.length) throw new Error(errors.join('\n- '));
  process.stdout.write(`Public AgentBank skill verified: ${skillUrl} (sha256 ${sha256(local)})\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`- ${error.message}\n`);
    process.exitCode = 1;
  });
}
