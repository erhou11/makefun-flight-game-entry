// Kestrel Post: Valley Air Mail - hand-in program (Node 22, standard library only).
//
// The game lives in game/ as plain static files (game/index.html plus its scripts,
// no build step and no network). This program hands the entry in: it copies game/
// and screenshots/ from beside this file into the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library, which is
// the summary the judge reads. The grader runs it twice in a fresh container with
// /output writable; both runs write the same bytes because the copy and the dossier
// are pure functions of the repository contents. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// To play the game locally, serve game/ with any static server, for example the
// serve.ts beside this file, then open the page in a desktop browser.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own limits: at most 4 screenshots of at most
// 256 KiB each, at most 993 files and 48 MiB under game/, paths under game/ of
// at most 1000 bytes, and 160 KiB of source text in the dossier.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
