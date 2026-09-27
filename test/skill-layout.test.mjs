import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import {
  generate,
  parsePointer,
  parseSections,
  reassemble,
  splitFrontmatter,
} from '../scripts/skill-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'test', 'fixtures', 'mini');
const importer = path.join(root, 'scripts', 'import-backend-skill.mjs');
const packaging = {
  license: 'MIT',
  compatibility: 'Fallback compatibility.',
  metadata: { author: 'theagentbank' },
};

async function fixture() {
  const [backend, layout] = await Promise.all([
    readFile(path.join(fixtureDir, 'backend.md'), 'utf8'),
    readFile(path.join(fixtureDir, 'layout.json'), 'utf8').then(JSON.parse),
  ]);
  return { backend, layout };
}

test('fixture: reassembling the generated files reproduces the backend bytes', async () => {
  const { backend, layout } = await fixture();
  const out = generate({ backend, layout, packaging, version: '9.9.9' });
  assert.equal(out.dist, backend);
  assert.equal(reassemble({ ...out }), backend);
});

test('fixture: sections move byte-for-byte, fenced headings are not sections', async () => {
  const { backend, layout } = await fixture();
  const out = generate({ backend, layout, packaging, version: '9.9.9' });
  assert.match(out.skill, /## not a heading inside a fence/);
  assert.equal(
    out.references['first.md'],
    '## Move A\n\nAlpha body.\n\n## Move B\n\nBravo body.\n\n## Move C\n\nCharlie body, same file as A but not adjacent.\n\n',
  );
  assert.equal(out.references['tail.md'], '## Tail\n\nTail body, moved at the very end.\n');
});

test('fixture: pointer lines are the only body additions', async () => {
  const { backend, layout } = await fixture();
  const out = generate({ backend, layout, packaging, version: '9.9.9' });
  const pointers = out.skill.split('\n').filter((line) => parsePointer(line));
  assert.deepEqual(pointers, [
    'Read [first.md](references/first.md) for "Move A", "Move B".',
    'Read [first.md](references/first.md) for "Move C".',
    'Read [tail.md](references/tail.md) for "Tail".',
  ]);

  // Removing the moved sections from the backend and the pointers (with their
  // separating blank line) from SKILL.md leaves identical bodies.
  const { body: backendBody } = splitFrontmatter(backend);
  const kept = parseSections(backendBody);
  const expectedBody = kept.preamble + kept.sections
    .filter((s) => layout.core.includes(s.heading))
    .map((s) => s.text)
    .join('');
  const actualBody = splitFrontmatter(out.skill).body
    .replace(/^Read \[.*\n\n?/gm, '');
  assert.equal(actualBody, expectedBody);
});

test('fixture: frontmatter keeps backend keys verbatim and appends packaging keys', async () => {
  const { backend, layout } = await fixture();
  const out = generate({ backend, layout, packaging, version: '9.9.9' });
  const backendInner = splitFrontmatter(backend).inner;
  const inner = splitFrontmatter(out.skill).inner;
  assert.ok(inner.startsWith(backendInner));
  assert.deepEqual(out.addedKeys, ['license', 'compatibility', 'metadata']);
  assert.deepEqual(parseDocument(inner).toJS(), {
    name: 'mini-skill',
    description: 'A synthetic backend skill used only by tests.',
    license: 'MIT',
    compatibility: 'Fallback compatibility.',
    metadata: { author: 'theagentbank', version: '9.9.9' },
  });
});

test('fixture: a backend compatibility value wins over the packaging fallback', async () => {
  const { backend, layout } = await fixture();
  const withCompat = backend.replace('---\n\n#', 'compatibility: Backend value.\n---\n\n#');
  const out = generate({ backend: withCompat, layout, packaging, version: '1.0.0' });
  assert.deepEqual(out.addedKeys, ['license', 'metadata']);
  assert.equal(parseDocument(splitFrontmatter(out.skill).inner).toJS().compatibility, 'Backend value.');
  assert.equal(reassemble(out), withCompat);
});

test('fixture: an unknown backend heading fails the import', async () => {
  const { backend, layout } = await fixture();
  assert.throws(
    () => generate({ backend: `${backend}\n## Brand new section\n\nNew.\n`, layout, packaging, version: '1.0.0' }),
    /backend sections not in skill-layout.json: "Brand new section"/,
  );
});

test('fixture: a mapped heading missing from the backend fails the import', async () => {
  const { backend, layout } = await fixture();
  assert.throws(
    () => generate({ backend: backend.replace('## Keep two', '## Keep 2'), layout, packaging, version: '1.0.0' }),
    /sections missing from the backend: "Keep two"/,
  );
});

test('fixture: duplicate headings and pointer-shaped backend lines are rejected', async () => {
  const { backend, layout } = await fixture();
  assert.throws(
    () => generate({ backend: `${backend}\n## Tail\n\nAgain.\n`, layout, packaging, version: '1.0.0' }),
    /repeats the section heading "Tail"/,
  );
  assert.throws(
    () => generate({
      backend: backend.replace('Core text.', 'Read [x.md](references/x.md) for "Y".'),
      layout,
      packaging,
      version: '1.0.0',
    }),
    /shaped like a generated pointer/,
  );
});

test('fixture: non-spec frontmatter keys and a mismatched name fail the import', async () => {
  const { backend, layout } = await fixture();
  assert.throws(
    () => generate({ backend: backend.replace('---\n\n#', 'version: 1\n---\n\n#'), layout, packaging, version: '1.0.0' }),
    /outside the Agent Skills specification: version/,
  );
  assert.throws(
    () => generate({ backend: backend.replace('name: mini-skill', 'name: other-skill'), layout, packaging, version: '1.0.0' }),
    /must equal the skill folder "mini-skill"/,
  );
});

test('fixture: importer CLI writes, stays idempotent, and --check detects hand edits', async (context) => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'agentbank-import-'));
  context.after(() => rm(repo, { recursive: true, force: true }));
  await cp(path.join(fixtureDir, 'layout.json'), path.join(repo, 'skill-layout.json'));
  await writeFile(path.join(repo, 'packaging.json'), JSON.stringify(packaging));
  await writeFile(path.join(repo, 'package.json'), JSON.stringify({ version: '3.1.4' }));
  await writeFile(
    path.join(repo, 'protocol-core-sync.json'),
    JSON.stringify({ mcp_package: 'agent-bank-mcp', mcp_version: '0.1.37', mcp_tool_count: 46 }),
  );
  const source = path.join(fixtureDir, 'backend.md');
  const run = (...extra) => spawnSync(
    process.execPath,
    [importer, '--root', repo, '--source', source, ...extra],
    { encoding: 'utf8', env: { ...process.env, AGENTBANK_SKIP_BACKEND_CHECK: '' } },
  );

  const before = run('--check');
  assert.equal(before.status, 1);
  assert.match(before.stderr, /out of date/);

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const marker = JSON.parse(await readFile(path.join(repo, 'protocol-core-sync.json'), 'utf8'));
  assert.equal(marker.mcp_version, '0.1.37');
  assert.match(marker.source_sha256, /^[0-9a-f]{64}$/);
  assert.equal(
    await readFile(path.join(repo, 'dist', 'mini-skill', 'SKILL.md'), 'utf8'),
    await readFile(source, 'utf8'),
  );

  const again = run();
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /Already current/);
  const markerAgain = JSON.parse(await readFile(path.join(repo, 'protocol-core-sync.json'), 'utf8'));
  assert.equal(markerAgain.imported_at, marker.imported_at);

  assert.equal(run('--check').status, 0);
  const skillPath = path.join(repo, 'skills', 'mini-skill', 'SKILL.md');
  await writeFile(skillPath, (await readFile(skillPath, 'utf8')).replace('Core text.', 'Reworded.'));
  const drift = run('--check');
  assert.equal(drift.status, 1);
  assert.match(drift.stderr, /skills\/mini-skill\/SKILL\.md/);

  await writeFile(path.join(repo, 'skills', 'mini-skill', 'references', 'stray.md'), 'x\n');
  const stray = run('--check');
  assert.match(stray.stderr, /references\/stray\.md/);
  assert.equal(run().status, 0);
  assert.equal(run('--check').status, 0);
});

test('importer --check honors the offline skip flag', () => {
  const result = spawnSync(process.execPath, [importer, '--check'], {
    encoding: 'utf8',
    env: { ...process.env, AGENTBANK_SKIP_BACKEND_CHECK: '1' },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Skipped/);
});
