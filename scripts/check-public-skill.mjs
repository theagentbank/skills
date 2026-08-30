#!/usr/bin/env node

import { createHash } from 'node:crypto';

const DEFAULT_SKILL_URL = 'https://agentbank.world/SKILL.md';
const DEFAULT_MANIFEST_URL = 'https://agentbank.world/agentbank-pay.manifest.json';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function validatePublicSkill(skill, manifest) {
  const errors = [];
  const lines = skill.split(/\r?\n/).length;

  if (lines > 500) errors.push(`SKILL.md has ${lines} lines; maximum is 500`);
  if (skill.includes('<skill-directory>')) {
    errors.push('SKILL.md contains an unavailable local skill-directory placeholder');
  }
  if (/\]\(references\//.test(skill)) {
    errors.push('SKILL.md contains unavailable relative reference links');
  }
  for (const snippet of [
    'codex mcp get agentbank --json',
    'codex mcp add agentbank -- npx -y agent-bank-mcp@latest',
    'claude mcp add --scope user agentbank -- npx -y agent-bank-mcp@latest',
    'recipient_requirements',
    'create_payment_plan',
    'failure.code=payment_expired',
    'bank_name',
    'estimate_x402_outbound_payment',
    'USDT',
    '"chain": "bsc"',
    'After browser approval, call `whoami`, restart',
    'CREDENTIAL_STORE_CORRUPT',
    'call `relogin` once',
    '## Detailed workflow references',
  ]) {
    if (!skill.includes(snippet)) errors.push(`SKILL.md is missing: ${snippet}`);
  }

  if (manifest.source !== 'https://github.com/theagentbank/skills') {
    errors.push('Manifest source is incorrect');
  }
  if (manifest.skill !== 'agentbank-pay') errors.push('Manifest skill is incorrect');
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.release ?? '')) {
    errors.push('Manifest release must be an immutable version label');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit ?? '')) {
    errors.push('Manifest sourceCommit must be a full Git commit');
  }
  if (manifest.sha256 !== sha256(skill)) errors.push('Manifest sha256 does not match SKILL.md');
  return errors;
}

async function fetchText(url, expectedType) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  if (expectedType && !response.headers.get('content-type')?.includes(expectedType)) {
    throw new Error(`${url} did not return ${expectedType}`);
  }
  return response.text();
}

async function main() {
  const skillUrl = process.argv[2] ?? DEFAULT_SKILL_URL;
  const manifestUrl = process.argv[3] ?? DEFAULT_MANIFEST_URL;
  const [skill, manifestText] = await Promise.all([
    fetchText(skillUrl, 'text/markdown'),
    fetchText(manifestUrl, 'application/json'),
  ]);
  const errors = validatePublicSkill(skill, JSON.parse(manifestText));
  if (errors.length) throw new Error(errors.join('\n- '));
  process.stdout.write(`Public AgentBank skill verified: ${skillUrl}\n`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`- ${error.message}\n`);
    process.exitCode = 1;
  });
}
