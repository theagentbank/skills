#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import readline from 'node:readline';

const packageSpec = process.env.AGENTBANK_MCP_PACKAGE ?? 'agent-bank-mcp@latest';
const expectedVersion = process.env.AGENTBANK_MCP_EXPECTED_VERSION ??
  (process.env.AGENTBANK_MCP_PACKAGE
    ? null
    : execFileSync('npm', ['view', 'agent-bank-mcp@latest', 'version'], {
      encoding: 'utf8',
    }).trim());
const child = spawn('npx', ['-y', packageSpec], {
  env: process.env,
  shell: false,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const requiredTools = [
  'whoami',
  'get_instructions',
  'begin_agent_onboarding',
  'wait_for_agent_onboarding',
  'get_payment_approval_policy',
  'update_payment_approval_policy',
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
      `MCP ${serverVersion} initialized; found ${details.count} tools including ${requiredTools.join(', ')}\n`,
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
    const names = new Set(tools.map((tool) => tool.name));
    const missing = requiredTools.filter((name) => !names.has(name));
    if (missing.length) {
      finish(new Error(`Missing required tools: ${missing.join(', ')}`));
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
    finish(null, { count: names.size });
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
