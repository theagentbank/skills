// Pure functions that repackage the AgentBank backend SKILL.md into the
// Agent Skills folder layout and reassemble it back, byte for byte.
//
// The backend file is the only source of skill wording. This module may only
// (a) append packaging frontmatter keys, (b) replace moved sections with one
// generated pointer line (plus the blank line that separates it from the next
// heading), and (c) split section bodies into reference files unchanged.

import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';

const HEADING = /^## (.+?)[ \t]*$/;
const FENCE = /^[ \t]{0,3}(```|~~~)/;
const POINTER = /^Read \[([^\]\n]+)\]\(references\/\1\) for ((?:"[^"\n]*"(?:, )?)+)\.$/;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function lines(text) {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function stripEol(line) {
  return line.endsWith('\n') ? line.slice(0, -1) : line;
}

export function splitFrontmatter(text, label = 'SKILL.md') {
  if (!text.startsWith('---\n')) throw new Error(`${label} must start with YAML frontmatter`);
  const end = text.indexOf('\n---\n', 3);
  if (end < 0) throw new Error(`${label} has unterminated YAML frontmatter`);
  const inner = text.slice(4, end + 1);
  return { inner, body: text.slice(end + 5) };
}

// A section is its `## ` line through the line before the next `## ` line.
// Headings inside fenced code blocks are not section boundaries.
export function parseSections(body, label = 'document') {
  const preamble = [];
  const sections = [];
  let fenced = false;
  for (const line of lines(body)) {
    const bare = stripEol(line);
    const match = fenced ? null : bare.match(HEADING);
    if (FENCE.test(bare)) fenced = !fenced;
    if (match) {
      sections.push({ heading: match[1], text: line });
    } else if (sections.length) {
      sections.at(-1).text += line;
    } else {
      preamble.push(line);
    }
  }
  if (fenced) throw new Error(`${label} has an unterminated code fence`);
  const seen = new Set();
  for (const { heading } of sections) {
    if (seen.has(heading)) throw new Error(`${label} repeats the section heading "${heading}"`);
    seen.add(heading);
  }
  return { preamble: preamble.join(''), sections };
}

export function pointerLine(file, headings) {
  return `Read [${file}](references/${file}) for ${headings.map((h) => `"${h}"`).join(', ')}.`;
}

export function parsePointer(line) {
  const match = stripEol(line).match(POINTER);
  if (!match) return null;
  return {
    file: match[1],
    headings: [...match[2].matchAll(/"([^"\n]*)"/g)].map((m) => m[1]),
  };
}

function layoutTargets(layout) {
  const target = new Map();
  const claim = (heading, file) => {
    if (target.has(heading)) throw new Error(`skill-layout.json lists "${heading}" more than once`);
    target.set(heading, file);
  };
  for (const heading of layout.core ?? []) claim(heading, null);
  for (const [file, headings] of Object.entries(layout.references ?? {})) {
    if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(file)) {
      throw new Error(`skill-layout.json has an invalid reference filename: ${file}`);
    }
    for (const heading of headings) claim(heading, file);
  }
  return target;
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

// Returns the packaging lines to append to the backend frontmatter and the
// top-level keys they add. Backend values always win.
export function packagingFrontmatter(backendKeys, packaging, version) {
  const added = [];
  const out = [];
  if (!backendKeys.includes('license')) {
    added.push('license');
    out.push(`license: ${packaging.license}`);
  }
  if (!backendKeys.includes('compatibility')) {
    added.push('compatibility');
    out.push(`compatibility: ${yamlScalar(packaging.compatibility)}`);
  }
  if (backendKeys.includes('metadata')) {
    throw new Error(
      'The backend frontmatter now provides metadata; update packaging rules before importing',
    );
  }
  added.push('metadata');
  out.push('metadata:');
  for (const [key, value] of Object.entries({ ...packaging.metadata, version })) {
    out.push(`  ${key}: ${yamlScalar(value)}`);
  }
  return { added, text: out.map((line) => `${line}\n`).join('') };
}

export function generate({ backend, layout, packaging, version }) {
  if (backend.includes('\r')) {
    throw new Error('The backend skill contains CR characters; it cannot be stored byte-for-byte');
  }
  if (!backend.endsWith('\n')) throw new Error('The backend skill must end with a newline');
  const { inner, body } = splitFrontmatter(backend, 'The backend skill');
  const parsed = parseDocument(inner, { uniqueKeys: true });
  if (parsed.errors.length) {
    throw new Error(`The backend frontmatter is invalid YAML: ${parsed.errors[0].message}`);
  }
  const backendKeys = Object.keys(parsed.toJS() ?? {});
  const { preamble, sections } = parseSections(body, 'The backend skill');

  for (const line of lines(backend)) {
    if (parsePointer(line)) {
      throw new Error(`The backend skill contains a line shaped like a generated pointer: ${stripEol(line)}`);
    }
  }

  const target = layoutTargets(layout);
  const backendHeadings = new Set(sections.map((s) => s.heading));
  const unknown = sections.map((s) => s.heading).filter((h) => !target.has(h));
  const missing = [...target.keys()].filter((h) => !backendHeadings.has(h));
  if (unknown.length || missing.length) {
    const detail = [
      unknown.length ? `backend sections not in skill-layout.json: ${unknown.map((h) => `"${h}"`).join(', ')}` : '',
      missing.length ? `skill-layout.json sections missing from the backend: ${missing.map((h) => `"${h}"`).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`The backend section list does not match skill-layout.json (${detail})`);
  }

  const { added, text: packagingText } = packagingFrontmatter(backendKeys, packaging, version);
  let skill = `---\n${inner}${packagingText}---\n${preamble}`;
  const references = Object.fromEntries(Object.keys(layout.references ?? {}).map((f) => [f, '']));

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const file = target.get(section.heading);
    if (file === null) {
      skill += section.text;
      continue;
    }
    const run = [section];
    while (index + 1 < sections.length && target.get(sections[index + 1].heading) === file) {
      run.push(sections[++index]);
    }
    for (const moved of run) references[file] += moved.text;
    const atEnd = index === sections.length - 1;
    skill += `${pointerLine(file, run.map((s) => s.heading))}\n${atEnd ? '' : '\n'}`;
  }

  return { skill, references, dist: backend, addedKeys: added };
}

function removeTopLevelKeys(inner, keys) {
  const drop = new Set(keys);
  const out = [];
  let dropping = false;
  for (const line of lines(inner)) {
    const key = line.match(/^([A-Za-z0-9_-]+):/)?.[1];
    if (key !== undefined) dropping = drop.has(key);
    else if (!/^[ \t]/.test(line) && line.trim()) dropping = false;
    if (!dropping) out.push(line);
  }
  return out.join('');
}

// Inverse of generate(): rebuilds the backend file from the generated folder.
export function reassemble({ skill, references, addedKeys }) {
  const { inner, body } = splitFrontmatter(skill, 'skills/agentbank-pay/SKILL.md');
  const pools = new Map();
  for (const [file, text] of Object.entries(references)) {
    const { preamble, sections } = parseSections(text, `references/${file}`);
    if (preamble) throw new Error(`references/${file} has text outside backend sections`);
    pools.set(file, new Map(sections.map((s) => [s.heading, s.text])));
  }

  let out = `---\n${removeTopLevelKeys(inner, addedKeys)}---\n`;
  const bodyLines = lines(body);
  for (let index = 0; index < bodyLines.length; index += 1) {
    const pointer = parsePointer(bodyLines[index]);
    if (!pointer) {
      out += bodyLines[index];
      continue;
    }
    const pool = pools.get(pointer.file);
    if (!pool) throw new Error(`Pointer names unknown reference file ${pointer.file}`);
    for (const heading of pointer.headings) {
      if (!pool.has(heading)) {
        throw new Error(`references/${pointer.file} does not contain "${heading}"`);
      }
      out += pool.get(heading);
      pool.delete(heading);
    }
    if (bodyLines[index + 1] === '\n') index += 1;
  }
  for (const [file, pool] of pools) {
    if (pool.size) {
      throw new Error(`references/${file} has sections no pointer names: ${[...pool.keys()].join(', ')}`);
    }
  }
  return out;
}
