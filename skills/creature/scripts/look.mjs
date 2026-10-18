#!/usr/bin/env node
// Fast authoring loop: capture a few canvas-only views of a built viewer.
// Use during shape work; run render.mjs/deliver.mjs for complete evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer } from './lib/server.mjs';
import { openBrowser, openStudio } from './lib/browser.mjs';
import { parseArgs, isMain } from './lib/common.mjs';

const SHOTS = {
  side: { view: 'side' }, 'three-quarter': { view: 'three-quarter' }, front: { view: 'front' }, rear: { view: 'rear' },
  'head-side': { part: 'head', direction: [0, .08, 1] }, 'head-three-quarter': { part: 'head', direction: [.75, .25, 1] }, 'head-front': { part: 'head', direction: [1, .12, .05] },
  'leg-front': { part: 'front-left-foot', direction: [0, .2, 1] }, walk: { view: 'side', pose: 'walk', time: .35 }
};

export async function look(directory, output, names = ['side', 'head-side', 'three-quarter'], surfaces = ['clay', 'material']) {
  await fs.mkdir(output, { recursive: true });
  const server = await startServer(directory); let browser;
  try {
    browser = await openBrowser(); const { page, errors } = await openStudio(browser, `${server.url}/?capture=1`, { width: 1100, height: 800 });
    const files = [];
    for (const surface of surfaces) for (const name of names) {
      const shot = SHOTS[name]; if (!shot) throw new Error(`Unknown shot ${name}. Known: ${Object.keys(SHOTS).join(', ')}`);
      await page.evaluate(({ surface, shot }) => { const s = window.creatureStudio; s.setControl('clay', surface === 'clay'); s.setControl('pose', shot.pose ?? 'idle'); s.setControl('labels', false); if (shot.part) s.focusPart(shot.part, shot.direction); else s.setView(shot.view); s.step(shot.time ?? 0); }, { surface, shot });
      const file = path.join(output, `${surface}-${name}.png`); await page.locator('#canvas').screenshot({ path: file }); files.push(file);
    }
    if (errors.length) console.error(errors);
    return files;
  } finally { await browser?.close(); await server.close(); }
}
if (isMain(import.meta.url)) {
  const args = parseArgs();
  if (!args._[0]) { console.error('Usage: node scripts/look.mjs <viewer folder> [--out dir] [--shots side,head-side] [--surfaces clay,material]'); process.exitCode = 1; }
  else look(args._[0], path.resolve(args.out ?? path.join(args._[0], 'look')), args.shots ? String(args.shots).split(',') : undefined, args.surfaces ? String(args.surfaces).split(',') : undefined).then(f => console.log(f.join('\n'))).catch(e => { console.error(e.message); process.exitCode = 1; });
}
