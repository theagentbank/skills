// Invariants for the checked-in generated skill. The wording itself belongs to
// the AgentBank backend, so these tests never assert specific phrases.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfig, readGenerated } from '../scripts/legacy.mjs';
import { parsePointer, parseSections, splitFrontmatter } from '../scripts/skill-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { layout, marker } = await loadConfig(root);
const backend = await readFile(path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'), 'utf8');
const generated = await readGenerated(root, layout);
const backendParts = parseSections(splitFrontmatter(backend).body);

test('core SKILL.md stays within 500 lines', () => {
  assert.ok(generated.skill.split('\n').length <= 500);
});

test('every backend section appears in exactly one generated file', () => {
  const files = { 'SKILL.md': generated.skill, ...generated.references };
  for (const section of backendParts.sections) {
    const holders = Object.entries(files).filter(([, text]) => text.includes(section.text));
    const expected = layout.core.includes(section.heading)
      ? 'SKILL.md'
      : Object.entries(layout.references).find(([, hs]) => hs.includes(section.heading))[0];
    assert.deepEqual(holders.map(([name]) => name), [expected], section.heading);
  }
});

test('every backend line is accounted for exactly once', () => {
  const generatedLines = [
    ...splitFrontmatter(generated.skill).body.split('\n'),
    ...Object.values(generated.references).flatMap((text) => text.split('\n')),
  ].filter((line) => !parsePointer(line));
  const count = (list) => list.reduce((map, line) => map.set(line, (map.get(line) ?? 0) + 1), new Map());
  const expected = count(splitFrontmatter(backend).body.split('\n'));
  const actual = count(generatedLines);
  for (const [line, n] of expected) {
    if (line === '') continue; // blank separators move with pointer lines
    assert.equal(actual.get(line) ?? 0, n, `backend line appears ${actual.get(line) ?? 0}x instead of ${n}x: ${line}`);
  }
  for (const line of actual.keys()) {
    assert.ok(expected.has(line), `generated line not in the backend: ${line}`);
  }
});

test('the only SKILL.md additions are packaging frontmatter and pointer lines', () => {
  const backendLines = new Set(backend.split('\n'));
  const { inner } = splitFrontmatter(generated.skill);
  const backendInner = splitFrontmatter(backend).inner;
  assert.ok(inner.startsWith(backendInner), 'backend frontmatter must be copied verbatim first');
  const addedFrontmatterKeys = inner
    .slice(backendInner.length)
    .split('\n')
    .map((line) => line.match(/^([A-Za-z0-9_-]+):/)?.[1])
    .filter(Boolean);
  assert.deepEqual(addedFrontmatterKeys, marker.packaging_keys_added);

  const extras = splitFrontmatter(generated.skill).body
    .split('\n')
    .filter((line) => line !== '' && !backendLines.has(line));
  assert.ok(extras.length > 0);
  for (const line of extras) assert.ok(parsePointer(line), `unexpected added line: ${line}`);
});

test('core sections stay in backend order and each pointer names its moved headings', () => {
  const skillParts = parseSections(splitFrontmatter(generated.skill).body);
  assert.equal(skillParts.preamble, backendParts.preamble);
  assert.deepEqual(
    skillParts.sections.map((s) => s.heading),
    backendParts.sections.map((s) => s.heading).filter((h) => layout.core.includes(h)),
  );
  const pointed = generated.skill
    .split('\n')
    .map(parsePointer)
    .filter(Boolean)
    .flatMap(({ file, headings }) => headings.map((h) => [h, file]));
  assert.deepEqual(
    pointed,
    backendParts.sections
      .filter((s) => !layout.core.includes(s.heading))
      .map((s) => [s.heading, Object.entries(layout.references).find(([, hs]) => hs.includes(s.heading))[0]]),
  );
});
