#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const packageSpec = process.env.AGENTBANK_MCP_PACKAGE ?? 'agent-bank-mcp@latest';
const expectedVersion = process.env.AGENTBANK_MCP_EXPECTED_VERSION ??
  (process.env.AGENTBANK_MCP_PACKAGE
    ? null
    : execFileSync('npm', ['view', 'agent-bank-mcp@latest', 'version'], {
      encoding: 'utf8',
    }).trim());
const candidateSpec = process.env.AGENTBANK_MCP_PACKAGE
  ? (/^(?:file:|https?:)/.test(packageSpec)
      ? packageSpec
      : packageSpec.endsWith('.tgz')
        ? pathToFileURL(path.resolve(packageSpec)).href
        : packageSpec)
  : null;
const npxArgs = candidateSpec
  ? ['-y', `--package=${candidateSpec}`, 'agent-bank-mcp']
  : ['-y', packageSpec];
const child = spawn('npx', npxArgs, {
  env: process.env,
  shell: false,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const expectedTools = [
  'begin_agent_onboarding',
  'wait_for_agent_onboarding',
  'relogin',
  'revoke_agent',
  'get_payment_approval_policy',
  'update_payment_approval_policy',
  'get_installation_status',
  'whoami',
  'check_verification_status',
  'do_kyc',
  'get_verification_guidance',
  'check_my_scopes',
  'list_currencies',
  'get_supported_payment_capabilities',
  'get_supported_bank_names',
  'list_quote_book_pairs',
  'browse_quote_book',
  'get_ramp_quote',
  'get_instructions',
  'get_account_status',
  'estimate_payment',
  'create_payment_plan',
  'review_payment_plan',
  'list_payment_plans',
  'create_payment',
  'submit_payment_plan',
  'cancel_payment_plan',
  'continue_payment',
  'execute_payment_instruction',
  'get_wallet_balances',
  'get_token_allowance',
  'approve_token',
  'get_transaction_receipt',
  'get_payment',
  'list_payments',
  'cancel_payment',
  'correct_payment_recipient',
  'list_recipients',
  'get_recipient',
  'create_recipient',
  'update_recipient',
  'list_wallets',
  'verify_agent_kit',
];
let stderr = '';
let initialized = false;
let settled = false;
let serverVersion = 'unknown';

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

const timeout = setTimeout(() => {
  finish(new Error('Timed out waiting for the AgentBank MCP tool catalog'));
}, 30_000);

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function finish(error, details) {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  child.kill();
  if (error) {
    process.stderr.write(`${error.message}\n${stderr}`.trimEnd() + '\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `MCP ${serverVersion} initialized; verified exact ${details.count}-tool production contract\n`,
    );
  }
}

child.on('error', (error) => finish(error));
child.on('exit', (code) => {
  if (!settled) {
    finish(new Error(`AgentBank MCP exited before discovery (code ${code})`));
  }
});

readline.createInterface({ input: child.stdout }).on('line', (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  if (message.id === 1 && message.result && !initialized) {
    if (message.result.serverInfo?.name !== 'agent-bank-mcp') {
      finish(
        new Error(
          `Unexpected MCP server name: ${message.result.serverInfo?.name ?? '(missing)'}`,
        ),
      );
      return;
    }
    serverVersion = message.result.serverInfo.version ?? 'unknown';
    if (expectedVersion && serverVersion !== expectedVersion) {
      finish(
        new Error(
          `MCP initialize version ${serverVersion} does not match npm latest ${expectedVersion}`,
        ),
      );
      return;
    }
    initialized = true;
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    return;
  }

  if (message.id === 2) {
    if (message.error) {
      finish(new Error(`tools/list failed: ${JSON.stringify(message.error)}`));
      return;
    }
    const tools = message.result?.tools ?? [];
    const actualTools = tools.map((tool) => tool.name);
    const expectedSet = new Set(expectedTools);
    const actualSet = new Set(actualTools);
    const missing = expectedTools.filter((name) => !actualSet.has(name));
    const unexpected = actualTools.filter((name) => !expectedSet.has(name));
    if (missing.length || unexpected.length || actualTools.length !== expectedTools.length) {
      finish(new Error(
        `MCP tool catalog drifted; missing=[${missing.join(', ')}], unexpected=[${unexpected.join(', ')}], expected=${expectedTools.length}, actual=${actualTools.length}`,
      ));
      return;
    }

    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const policyField =
      byName.get('update_payment_approval_policy')?.inputSchema?.properties
        ?.world_id_approval_threshold_usd;
    if (policyField?.type !== 'string') {
      finish(
        new Error(
          'update_payment_approval_policy must accept a string world_id_approval_threshold_usd',
        ),
      );
      return;
    }

    const estimateDestination =
      byName.get('estimate_payment')?.inputSchema?.properties?.destination
        ?.properties ?? {};
    const createDestination =
      byName.get('create_payment')?.inputSchema?.properties?.destination
        ?.properties ?? {};
    if (
      'recipient_id' in estimateDestination ||
      'recipient_fields' in estimateDestination ||
      !('recipient_id' in createDestination) ||
      !('recipient_fields' in createDestination)
    ) {
      finish(
        new Error(
          'MCP schemas do not preserve the recipient-free estimate/create boundary',
        ),
      );
      return;
    }

    const hopProperties =
      byName.get('create_payment')?.inputSchema?.properties?.hops?.items
        ?.properties ?? {};
    if ('recipient_fields' in hopProperties || 'recipient_ref' in hopProperties) {
      finish(new Error('create_payment public hops must contain route data only'));
      return;
    }

    const createPayment = byName.get('create_payment');
    const createProperties = createPayment?.inputSchema?.properties ?? {};
    const createRequired = createPayment?.inputSchema?.required ?? [];
    if (
      createProperties.plan_id?.type !== 'string' ||
      createProperties.plan_position?.type !== 'integer' ||
      createProperties.confirmed_by_user?.type !== 'boolean' ||
      createRequired.includes('confirmed_by_user')
    ) {
      finish(new Error('create_payment does not preserve standalone/plan confirmation fields'));
      return;
    }

    const planSchemas = {
      create_payment_plan: ['request_id', 'description'],
      review_payment_plan: ['payment_plan_id'],
      list_payment_plans: [],
      submit_payment_plan: ['payment_plan_id', 'request_id', 'confirmed_by_user'],
      cancel_payment_plan: ['payment_plan_id', 'request_id'],
    };
    for (const [name, required] of Object.entries(planSchemas)) {
      const schema = byName.get(name)?.inputSchema;
      if (!schema || required.some((field) => !schema.required?.includes(field))) {
        finish(new Error(`${name} schema is missing required plan fields`));
        return;
      }
    }

    const createRecipient = byName.get('create_recipient')?.inputSchema;
    const recipientProperties = createRecipient?.properties ?? {};
    const instrumentValues = recipientProperties.payment_instrument?.enum ?? [];
    const bankProperties = recipientProperties.bank_info?.properties ?? {};
    if (
      JSON.stringify(instrumentValues) !== JSON.stringify(['qr', 'bank_transfer', 'mobile_money']) ||
      !('bank_name' in bankProperties) ||
      'bank_code' in bankProperties ||
      !('mobile_money_network_code' in bankProperties) ||
      !('mobile_money_destination' in bankProperties)
    ) {
      finish(new Error('create_recipient does not expose the canonical fiat instrument contract'));
      return;
    }

    const updateInstrument = byName.get('update_recipient')?.inputSchema
      ?.properties?.payment_instrument?.enum ?? [];
    if (JSON.stringify(updateInstrument) !== JSON.stringify(instrumentValues)) {
      finish(new Error('update_recipient must accept the canonical payment instruments'));
      return;
    }

    const bankNamesSchema = byName.get('get_supported_bank_names')?.inputSchema;
    if (
      bankNamesSchema?.properties?.rail?.type !== 'string' ||
      !bankNamesSchema?.required?.includes('rail')
    ) {
      finish(new Error('get_supported_bank_names must require the destination rail'));
      return;
    }

    finish(null, { count: actualSet.size });
  }
});

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'theagentbank-skills-smoke', version: '1.0.0' },
  },
});
