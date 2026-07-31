import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { EXPECTED } from '../skills/agentbank-pay/scripts/setup-mcp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relative) {
  return readFile(path.join(root, relative), 'utf8');
}

test('new MCP installations rely on package endpoint defaults', async () => {
  const [skill, onboarding, smoke] = await Promise.all([
    read('skills/agentbank-pay/SKILL.md'),
    read('skills/agentbank-pay/references/onboarding.md'),
    read('scripts/smoke-mcp.mjs'),
  ]);

  assert.deepEqual(EXPECTED, {
    name: 'agentbank',
    command: 'npx',
    args: ['-y', 'agent-bank-mcp@latest'],
    env: {},
  });
  assert.match(skill, /Do not\s+add endpoint environment overrides/);
  assert.match(onboarding, /New\s+installations must not add endpoint overrides/);
  assert.doesNotMatch(smoke, /PROTOCOL_BASE_URL|APP_BASE_URL/);
});

test('documents the manual Hermes installation and reload flow', async () => {
  const skill = await read('skills/agentbank-pay/SKILL.md');

  assert.match(
    skill,
    /hermes mcp add agentbank --command npx --args -y agent-bank-mcp@latest/,
  );
  assert.match(skill, /run `\/reload-mcp`/);
});

test('requires human-provided holder names for curated fiat recipients', async () => {
  const recipients = await read(
    'skills/agentbank-pay/references/recipients-wallets.md',
  );

  assert.match(recipients, /collect a non-empty `holder_name` from the human/);
  assert.match(recipients, /Do not infer it from an EMV QR display label/);
  assert.match(recipients, /Core derives\s+`bank_name`/);
});

test('uses the hosted AgentKit verification handoff', async () => {
  const identity = await read(
    'skills/agentbank-pay/references/identity.md',
  );

  assert.match(identity, /hosted `verification_url` unchanged/);
  assert.match(identity, /until it returns `status=verified`/);
  assert.match(identity, /Do not rewrite or reconstruct the verification URL/);
  assert.match(identity, /run the AgentKit CLI\s+manually/);
});

test('confirms effective two-hop amounts and approval bypass behavior', async () => {
  const payments = await read(
    'skills/agentbank-pay/references/payments.md',
  );

  assert.match(payments, /Treat those returned effective amounts as the review truth/);
  assert.match(payments, /different `source_amount`/);
  assert.match(payments, /exact current estimate `hops` unchanged/);
  assert.match(payments, /at most 10 USD/);
  assert.match(payments, /`approval_ready` with `approval:null`/);
});
