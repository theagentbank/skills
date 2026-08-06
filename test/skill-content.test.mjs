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

test('documents client-affine credential recovery without duplicate onboarding', async () => {
  const [skill, onboarding] = await Promise.all([
    read('skills/agentbank-pay/SKILL.md'),
    read('skills/agentbank-pay/references/onboarding.md'),
  ]);

  assert.match(skill, /configured AgentBank MCP server in the active\s+client and profile/);
  assert.match(skill, /post-restart call succeeds/);
  assert.match(onboarding, /status=authorized[\s\S]*resumed=true/);
  assert.match(onboarding, /CREDENTIAL_STORE_CORRUPT/);
  assert.match(onboarding, /never start duplicate onboarding/);
  assert.match(onboarding, /HFX_MCP_PROFILE/);
  assert.match(onboarding, /HFX_MCP_DATA_DIR/);
  assert.match(onboarding, /Earlier local stores are deliberately not imported/);
});

test('uses quote-driven fiat recipient instruments', async () => {
  const recipients = await read(
    'skills/agentbank-pay/references/recipients-wallets.md',
  );

  assert.match(recipients, /`recipient_requirements`/);
  assert.match(recipients, /choose exactly one listed\s+`payment_instrument`/);
  assert.match(recipients, /mobile-money destination is opaque/);
  assert.match(recipients, /holder_name_must_match_kyc=true/);
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

test('uses recipient-free estimates and route-only hops', async () => {
  const [skill, payments, recipients] = await Promise.all([
    read('skills/agentbank-pay/SKILL.md'),
    read('skills/agentbank-pay/references/payments.md'),
    read('skills/agentbank-pay/references/recipients-wallets.md'),
  ]);

  assert.match(skill, /Keep estimates recipient-free/);
  assert.match(payments, /Do not provide\s+`recipient_id` or `recipient_fields`/);
  assert.match(payments, /`next_action\.type=review_estimate`/);
  assert.match(payments, /returned hops contain route data only/);
  assert.match(payments, /recipient once in\s+`destination\.recipient_id`/);
  assert.match(recipients, /recipient-free/);
  assert.doesNotMatch(payments, /recipient validation/);
});

test('confirms effective two-hop amounts and dynamic approval behavior', async () => {
  const [skill, onboarding, payments] = await Promise.all([
    read('skills/agentbank-pay/SKILL.md'),
    read('skills/agentbank-pay/references/onboarding.md'),
    read('skills/agentbank-pay/references/payments.md'),
  ]);

  assert.match(payments, /Treat those returned effective amounts as the review truth/);
  assert.match(payments, /different `source_amount`/);
  assert.match(payments, /exact current estimate\s+`hops` unchanged/);
  assert.match(skill, /update_payment_approval_policy/);
  assert.match(onboarding, /get_payment_approval_policy/);
  assert.match(onboarding, /explicit human confirmation/);
  assert.match(onboarding, /non-USD-stable routes always require World ID/);
  assert.match(payments, /Do not assume a fixed threshold/);
  assert.match(payments, /`approval_ready` with\s+`approval:null`/);
  assert.doesNotMatch(payments, /at most 10 USD/);
});

test('documents quote-unavailable and latest recipient recovery', async () => {
  const [payments, recipients, onboarding] = await Promise.all([
    read('skills/agentbank-pay/references/payments.md'),
    read('skills/agentbank-pay/references/recipients-wallets.md'),
    read('skills/agentbank-pay/references/onboarding.md'),
  ]);

  assert.match(payments, /`QUOTE_UNAVAILABLE`/);
  assert.match(payments, /`min_amount`/);
  assert.match(payments, /`fee_ccy`/);
  assert.match(payments, /reason=recipient_incompatible/);
  assert.match(payments, /chooses one listed `payment_instrument`/);
  assert.match(recipients, /`bank_transfer` requires/);
  assert.match(recipients, /default crypto recipient/);
  assert.match(recipients, /human-owner scoped/);
  assert.match(recipients, /chain and address match/);
  assert.match(onboarding, /default crypto\s+recipient/);
  assert.match(onboarding, /scoped to the human owner/);
});
