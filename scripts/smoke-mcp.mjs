#!/usr/bin/env node

import { spawn } from 'node:child_process';
import readline from 'node:readline';

const child = spawn('npx', ['-y', 'agent-bank-mcp@latest'], {
  env: {
    ...process.env,
    PROTOCOL_BASE_URL: 'https://protocol.agentbank.world',
    APP_BASE_URL: 'https://staging.agentbank.world',
  },
  shell: false,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const requiredTools = [
  'whoami',
  'get_instructions',
  'begin_agent_onboarding',
  'wait_for_agent_onboarding',
];
let stderr = '';
let initialized = false;
let settled = false;

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
      `MCP initialized; found ${details.count} tools including ${requiredTools.join(', ')}\n`,
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
    const names = new Set(
      (message.result?.tools ?? []).map((tool) => tool.name),
    );
    const missing = requiredTools.filter((name) => !names.has(name));
    if (missing.length) {
      finish(new Error(`Missing required tools: ${missing.join(', ')}`));
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
