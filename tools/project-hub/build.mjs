// Builds the SHOPME Project Hub page (published as a claude.ai artifact).
//
//   node tools/project-hub/build.mjs          (or: npm run hub)
//
// Combines the board data in hub-data.json with live Git state (development vs
// production, checkpoints, recent commits, unsaved files) and the phase
// progress recorded in CLAUDE.md, then writes project-hub.html next to this file.
// It only reads Git; it never commits, merges or pushes.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const WINDOWS_GIT = 'C:\\Program Files\\Git\\cmd\\git.exe';
const GIT_BIN = process.platform === 'win32' && fs.existsSync(WINDOWS_GIT) ? WINDOWS_GIT : 'git';

function git(...args) {
  try {
    // trimEnd only: `git status --porcelain` lines start with a meaningful space
    return execFileSync(GIT_BIN, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return '';
  }
}

const SEP = '\u001f';
function commits(...range) {
  const out = git('log', ...range, `--pretty=format:%h${SEP}%cI${SEP}%s`);
  return out ? out.split('\n').map((line) => {
    const [hash, date, subject] = line.split(SEP);
    return { hash, date, subject };
  }) : [];
}

function phasesFromClaudeMd() {
  const text = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  const built = [...text.matchAll(/^- ✅ Phase (\d+):/gm)].map((m) => Number(m[1]));
  const next = text.match(/^- ⏭ Phase (\d+):/m);
  return { built, next: next ? Number(next[1]) : null };
}

function gitState() {
  const hasProduction = Boolean(git('rev-parse', '--verify', '--quiet', 'refs/heads/production'));
  const [head] = commits('-1', 'development');
  const pending = hasProduction ? commits('production..development') : commits('development');
  const phases = phasesFromClaudeMd();
  return {
    branch: git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
    head: head || { hash: '-', date: '', subject: 'No commits yet' },
    production: hasProduction ? commits('-1', 'production')[0] || null : null,
    totalCommits: Number(git('rev-list', '--count', 'development')) || 0,
    pendingForProduction: { count: pending.length, commits: pending.slice(0, 40) },
    checkpoints: commits('development', '--grep=^Checkpoint', '--regexp-ignore-case'),
    recent: commits('-15', 'development'),
    // The hub's own files are left out: they are rebuilt and committed together right after
    uncommitted: git('status', '--porcelain', '--untracked-files=all')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).replace(/^"|"$/g, ''))
      .filter((f) => !f.startsWith('tools/project-hub/')),
    remote: git('remote', 'get-url', 'origin') || null,
    phasesBuilt: phases.built,
    nextPhase: phases.next,
  };
}

const data = JSON.parse(fs.readFileSync(path.join(here, 'hub-data.json'), 'utf8'));
const hub = { ...data, generatedAt: new Date().toISOString(), git: gitState() };

// Safe inside a <script>: no "</script>" or HTML comment openers can break out
const json = JSON.stringify(hub).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const template = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
if (!template.includes('/*HUB_DATA*/ null')) throw new Error('template.html is missing the /*HUB_DATA*/ null placeholder');
const out = path.join(here, 'project-hub.html');
fs.writeFileSync(out, template.replace('/*HUB_DATA*/ null', json));

const counts = hub.cards.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), {});
console.log(`Project Hub built: ${path.relative(root, out)}`);
console.log(`Artifact: ${hub.artifactUrl}`);
console.log(`Cards: ${hub.cards.length} (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
console.log(`Git: on ${hub.git.branch} @ ${hub.git.head.hash}; ${hub.git.totalCommits} commits; ${hub.git.pendingForProduction.count} waiting for production; ${hub.git.uncommitted.length} unsaved file(s)`);
console.log(`Phases built (CLAUDE.md): ${hub.git.phasesBuilt.join(', ') || 'none'}; next: ${hub.git.nextPhase ?? 'none'}`);
