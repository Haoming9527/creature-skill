#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer } from './lib/server.mjs';
import { openBrowser, openStudio } from './lib/browser.mjs';
import { parseArgs, writeJSON, isMain } from './lib/common.mjs';

export async function renderPreviews(directory, output, quick = false) {
  const destination = path.resolve(output || path.join(directory, 'previews')); await fs.mkdir(destination, { recursive: true });
  const server = await startServer(directory); let browser;
  try {
    browser = await openBrowser(); const { page, errors } = await openStudio(browser, `${server.url}/?capture=1`);
    const images = [];
    for (const surface of quick ? ['material'] : ['clay', 'material']) {
      for (const view of quick ? ['three-quarter'] : ['three-quarter', 'three-quarter-rear', 'side', 'front', 'rear', 'above']) {
        await page.evaluate(({ surface, view }) => { const s = window.creatureStudio; s.setControl('clay', surface === 'clay'); s.setView(view); s.step(0); }, { surface, view });
        const file = `${surface}-${view}.png`; await page.screenshot({ path: path.join(destination, file) }); images.push(file);
      }
      if (!quick) for (const part of ['head','front-left-foot']) {
        await page.evaluate(p => window.creatureStudio.focusPart(p),part);
        const file = `${surface}-${part}-detail.png`; await page.screenshot({path:path.join(destination,file)});images.push(file);
      }
      if (!quick) {
        await page.evaluate(() => window.creatureStudio.focusPart('head',[1,.12,0]));
        const front=`${surface}-head-front-detail.png`;await page.screenshot({path:path.join(destination,front)});images.push(front);
        await page.evaluate(() => {const s=window.creatureStudio;s.setControl('jaw',1);s.focusPart('head');});
        const jaw=`${surface}-jaw-open-detail.png`;await page.screenshot({path:path.join(destination,jaw)});images.push(jaw);
        await page.evaluate(() => window.creatureStudio.setControl('jaw',0));
      }
    }
    if (!quick) {
      const cycle = await page.evaluate(() => window.creatureStudio.model.metrics.walkCycleSeconds);
      for (const time of Array.from({length:13},(_,i) => i*cycle/12)) {
        await page.evaluate((t) => { const s = window.creatureStudio; s.setControl('clay', true); s.setControl('pose', 'walk'); s.setView('side'); s.step(t); }, time);
        const file = `walk-${time.toFixed(2)}.png`; await page.screenshot({ path: path.join(destination, file) }); images.push(file);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.evaluate(() => { const s = window.creatureStudio; s.setControl('clay', false); s.setControl('pose', 'idle'); s.setView('three-quarter'); s.step(0); });
      await page.screenshot({ path: path.join(destination, 'mobile-layout.png'), fullPage: true }); images.push('mobile-layout.png');
    }
    const metrics = await page.evaluate(() => window.creatureStudio.metrics());
    const report = { browser: await browser.version(), images, metrics, browserErrors: errors, visualApproval: 'pending', anatomicalApproval: 'pending', physicalMobilePerformance: 'not-tested', note: 'Screenshots are evidence for review; capture success is not visual approval.' };
    await writeJSON(path.join(destination, 'review.json'), report);
    if (errors.length) throw new Error(`Capture reported ${errors.length} browser errors; see review.json`);
    return report;
  } finally { await browser?.close(); await server.close(); }
}
if (isMain(import.meta.url)) { const args = parseArgs(); if (!args._[0]) { console.error('Usage: node scripts/render.mjs <viewer folder> [--out previews] [--quick]'); process.exitCode = 1; } else try { const r = await renderPreviews(args._[0], args.out, args.quick); console.log(JSON.stringify({ images: r.images, metrics: r.metrics }, null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
