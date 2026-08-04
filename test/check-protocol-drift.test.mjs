import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePorcelainPath } from '../scripts/git-porcelain.mjs';

test('parses staged and unstaged porcelain paths from the fixed status prefix', () => {
  const path = 'mcp-agent-server/skills/agentbank-pay/SKILL.md';

  assert.equal(parsePorcelainPath(`M  ${path}`), path);
  assert.equal(parsePorcelainPath(`A  ${path}`), path);
  assert.equal(parsePorcelainPath(` M ${path}`), path);
  assert.equal(parsePorcelainPath(`MM ${path}`), path);
  assert.equal(parsePorcelainPath(`?? ${path}`), path);
});

test('rejects malformed porcelain records', () => {
  assert.throws(() => parsePorcelainPath('M path'), /Invalid git status/);
});
