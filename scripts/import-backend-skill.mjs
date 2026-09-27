#!/usr/bin/env node

// Imports the AgentBank backend SKILL.md (the only source of skill wording)
// and repackages it into the Agent Skills layout described by
// skill-layout.json. Never edit the generated files by hand.
//
//   node scripts/import-backend-skill.mjs [--source <url|path>] [--check] [--root <repo>]
//
// --check exits 1 when the generated files differ from what the source would
// produce. Set AGENTBANK_SKIP_BACKEND_CHECK=1 to skip --check without network.

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from './legacy.mjs';
import { generate, sha256 } from './skill-layout.mjs';

const MARKER = 'protocol-core-sync.json';

function parseArgs(argv) {
  const options = {
    source: null,
    check: false,
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--source' || arg === '--root') {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = arg === '--root' ? path.resolve(value) : value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export async function readSource(source) {
  let bytes;
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, {
      headers: { accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    bytes = await readFile(source);
  }
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    throw new Error(`${source} is not valid UTF-8`);
  }
  return text;
}

async function readOptional(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function markerFor(previous, { source, sourceSha, addedKeys }) {
  const unchanged =
    previous.source_sha256 === sourceSha &&
    previous.source_url === source &&
    JSON.stringify(previous.packaging_keys_added) === JSON.stringify(addedKeys);
  const next = {
    source_url: source,
    source_sha256: sourceSha,
    imported_at: unchanged && previous.imported_at ? previous.imported_at : new Date().toISOString(),
    packaging_keys_added: addedKeys,
    source_repository: previous.source_repository ?? 'HumanFX/protocol-core',
    source_branch: previous.source_branch ?? 'development/1.0.0',
    source_path: previous.source_path ?? 'mcp-agent-server/skills/agentbank-pay/SKILL.md',
  };
  for (const key of ['mcp_package', 'mcp_version', 'mcp_tool_count']) {
    if (previous[key] !== undefined) next[key] = previous[key];
  }
  return next;
}

export async function importBackendSkill(options) {
  const { root } = options;
  const { layout, packaging, packageJson, marker } = await loadConfig(root);
  const source = options.source ?? layout.default_source;
  const backend = await readSource(source);
  const generated = generate({ backend, layout, packaging, version: packageJson.version });
  const sourceSha = sha256(backend);

  const skillRoot = path.join(root, 'skills', layout.skill);
  const outputs = new Map([
    [path.join('skills', layout.skill, 'SKILL.md'), generated.skill],
    ...Object.entries(generated.references).map(([file, text]) => [
      path.join('skills', layout.skill, 'references', file),
      text,
    ]),
    [path.join('dist', layout.skill, 'SKILL.md'), generated.dist],
  ]);

  const referenceDir = path.join(skillRoot, 'references');
  const existingRefs = await readdir(referenceDir).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const stale = existingRefs
    .filter((file) => !(file in generated.references))
    .map((file) => path.join('skills', layout.skill, 'references', file));

  const changed = [];
  for (const [relative, content] of outputs) {
    if ((await readOptional(path.join(root, relative))) !== content) changed.push(relative);
  }
  const markerChanged =
    marker.source_sha256 !== sourceSha ||
    JSON.stringify(marker.packaging_keys_added) !== JSON.stringify(generated.addedKeys);
  if (markerChanged) changed.push(MARKER);
  changed.push(...stale);

  if (options.check) return { source, sourceSha, changed, written: false };

  for (const [relative, content] of outputs) {
    const absolute = path.join(root, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
  for (const relative of stale) await rm(path.join(root, relative));
  const nextMarker = markerFor(marker, { source, sourceSha, addedKeys: generated.addedKeys });
  await writeFile(path.join(root, MARKER), `${JSON.stringify(nextMarker, null, 2)}\n`);
  return { source, sourceSha, changed, written: true };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.check && /^(?:1|true)$/i.test(process.env.AGENTBANK_SKIP_BACKEND_CHECK ?? '')) {
    process.stdout.write('Skipped the backend skill check (AGENTBANK_SKIP_BACKEND_CHECK is set)\n');
    return;
  }
  const result = await importBackendSkill(options);
  if (options.check) {
    if (result.changed.length) {
      process.stderr.write(
        `Generated skill files are out of date with ${result.source} (sha256 ${result.sourceSha}):\n${result.changed.map((f) => `- ${f}`).join('\n')}\nRun: npm run import:backend\n`,
      );
      process.exitCode = 1;
    } else {
      process.stdout.write(`Generated skill files match ${result.source} (sha256 ${result.sourceSha})\n`);
    }
    return;
  }
  process.stdout.write(
    result.changed.length
      ? `Imported ${result.source} (sha256 ${result.sourceSha}); updated:\n${result.changed.map((f) => `- ${f}`).join('\n')}\n`
      : `Already current with ${result.source} (sha256 ${result.sourceSha})\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
