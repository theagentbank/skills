// The portable single-file skill is the backend file itself. renderLegacy()
// rebuilds it from the generated skill folder so tests and validation can
// prove the folder drops, rewords, and reorders nothing.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { reassemble } from './skill-layout.mjs';

export async function readJson(repoRoot, relative) {
  return JSON.parse(await readFile(path.join(repoRoot, relative), 'utf8'));
}

export async function loadConfig(repoRoot) {
  const [layout, packaging, packageJson, marker] = await Promise.all([
    readJson(repoRoot, 'skill-layout.json'),
    readJson(repoRoot, 'packaging.json'),
    readJson(repoRoot, 'package.json'),
    readJson(repoRoot, 'protocol-core-sync.json').catch((error) => {
      if (error.code === 'ENOENT') return {};
      throw error;
    }),
  ]);
  return { layout, packaging, packageJson, marker };
}

export async function readGenerated(repoRoot, layout) {
  const skillRoot = path.join(repoRoot, 'skills', layout.skill);
  const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
  const references = {};
  for (const file of Object.keys(layout.references)) {
    references[file] = await readFile(path.join(skillRoot, 'references', file), 'utf8');
  }
  return { skill, references };
}

export async function renderLegacy(repoRoot) {
  const { layout, marker } = await loadConfig(repoRoot);
  const generated = await readGenerated(repoRoot, layout);
  return reassemble({ ...generated, addedKeys: marker.packaging_keys_added ?? [] });
}
