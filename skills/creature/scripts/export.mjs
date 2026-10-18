#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import validator from 'gltf-validator';
import { startServer } from './lib/server.mjs';
import { openBrowser, openStudio } from './lib/browser.mjs';
import { parseArgs, writeJSON, isMain } from './lib/common.mjs';
import { verifyRoundTrip } from './lib/roundtrip.mjs';

export async function exportCreature(directory, output) {
  const destination = path.resolve(output || path.join(directory, 'creature.glb'));
  const server = await startServer(directory); let browser;
  try {
    browser = await openBrowser(); const { page, errors } = await openStudio(browser, `${server.url}/?capture=1`);
    const encoded = await page.evaluate(() => window.creatureStudio.exportBase64());
    const bytes = Buffer.from(encoded, 'base64');
    const report = await validator.validateBytes(new Uint8Array(bytes), { uri: path.basename(destination), maxIssues: 100 });
    const roundTrip = await verifyRoundTrip(page, encoded);
    await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, bytes);
    const previewFile=`${destination}.preview.png`;await fs.writeFile(previewFile,Buffer.from(roundTrip.preview,'base64'));delete roundTrip.preview;roundTrip.previewFile=path.basename(previewFile);
    await writeJSON(`${destination}.validation.json`, { ...report, roundTrip, browserErrors: errors, anatomicalApproval: 'pending', visualApproval: 'pending' });
    const animated = roundTrip.animations.length >= 2 && roundTrip.animations.every(a => a.changedComponents > 0);
    if (report.issues.numErrors || errors.length || !roundTrip.finite || !roundTrip.skinnedMeshes || !animated) throw new Error(`GLB export failed verification. See ${destination}.validation.json`);
    return { file: destination, bytes: bytes.length, errors: report.issues.numErrors, warnings: report.issues.numWarnings, roundTrip };
  } finally { await browser?.close(); await server.close(); }
}
if (isMain(import.meta.url)) { const args = parseArgs(); if (!args._[0]) { console.error('Usage: node scripts/export.mjs <viewer folder> [--out model.glb]'); process.exitCode = 1; } else try { console.log(JSON.stringify(await exportCreature(args._[0], args.out), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
