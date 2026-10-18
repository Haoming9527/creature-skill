#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { validateSpec } from '../kit/spec.mjs';
import { skillRoot, parseArgs, readJSON, writeJSON, listFiles, isMain } from './lib/common.mjs';
import { zipFiles } from './lib/zip.mjs';

export async function buildCreature(specPath, output) {
  const spec = await readJSON(specPath), validation = validateSpec(spec);
  if (!validation.valid) throw new Error(validation.errors.map((e) => `${e.code}: ${e.path}: ${e.message}`).join('\n'));
  const destination = path.resolve(output || path.join('out', spec.id));
  if (destination === skillRoot || skillRoot.startsWith(`${destination}${path.sep}`)) throw new Error('Output must not replace the skill source directory or its parent.');
  const existing = await fs.readdir(destination).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
  if (existing.length && !existing.includes('.creature-output.json')) throw new Error(`Refusing to overwrite a non-generated directory: ${destination}`);
  await fs.mkdir(destination, { recursive: true });
  // Reports from an earlier generated body must not survive as apparent evidence.
  for (const file of ['creature.glb','creature.glb.validation.json','creature.glb.preview.png','browser-checks.json','delivery-report.json','surface-checks.json','previews/review.json']) await fs.rm(path.join(destination,file),{force:true});
  const specificationHash = createHash('sha256').update(JSON.stringify(spec)).digest('hex');
  await writeJSON(path.join(destination, '.creature-output.json'), { generator: 'creature', version: '0.1.0', specId: spec.id, specificationHash });
  await writeJSON(path.join(destination, 'creature.json'), spec);
  await writeJSON(path.join(destination, 'validation.json'), { specification: validation, visualReview: 'pending', anatomicalReview: 'pending', geometry: 'not-run', browser: 'not-run', export: 'not-run', physicalMobilePerformance: 'not-tested' });
  const source = path.join(destination, 'source'); await fs.mkdir(source, { recursive: true });
  const sourceFiles=await listFiles(skillRoot, '', [destination]),sourceDigest=createHash('sha256');
  for (const relative of sourceFiles) {
    const contents=await fs.readFile(path.join(skillRoot,relative));
    sourceDigest.update(relative.split(path.sep).join('/'));sourceDigest.update('\0');sourceDigest.update(contents);sourceDigest.update('\0');
    const target = path.join(source, relative); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, contents);
  }
  const sourceHash=sourceDigest.digest('hex');
  await writeJSON(path.join(destination, '.creature-output.json'), { generator: 'creature', version: '0.1.0', specId: spec.id, specificationHash, sourceHash });
  const sourcePrefix = `${path.resolve(source)}${path.sep}`.toLowerCase();
  const snapshotPaths = new Set(sourceFiles.map(relative => path.resolve(source, relative).toLowerCase()));
  const snapshotOnly = { name: 'current-source-snapshot', setup(context) {
    context.onLoad({ filter: /.*/ }, args => {
      const resolved = path.resolve(args.path).toLowerCase();
      if (resolved.startsWith(sourcePrefix) && !snapshotPaths.has(resolved)) {
        return { errors: [{ text: `Source import is absent from this build snapshot: ${path.relative(source, args.path)}` }] };
      }
    });
  } };
  // Build from the archived source snapshot, so the editable source and viewer
  // cannot diverge if the development checkout changes during the build.
  await build({ entryPoints: [path.join(source, 'kit/viewer.mjs')], plugins:[snapshotOnly], nodePaths:[path.join(skillRoot,'node_modules')], outfile: path.join(destination, 'viewer.js'), bundle: true, format: 'esm', target: 'es2022', minify: true, legalComments: 'eof', sourcemap: true });
  await build({ entryPoints: [path.join(source, 'kit/creature.mjs')], plugins:[snapshotOnly], nodePaths:[path.join(skillRoot,'node_modules')], outfile: path.join(destination, 'model.mjs'), bundle: true, platform:'node',format:'esm',target:'node22',minify:true,legalComments:'eof' });
  await fs.copyFile(path.join(source, 'kit/viewer.html'), path.join(destination, 'index.html'));
  await fs.copyFile(path.join(source, 'kit/viewer.css'), path.join(destination, 'viewer.css'));
  await fs.copyFile(path.join(source, 'LICENSE'), path.join(destination, 'LICENSE'));
  await fs.copyFile(path.join(source, 'assets/LICENSES.md'), path.join(destination, 'ASSET-LICENSES.md'));
  await fs.mkdir(path.join(source, 'examples'), { recursive: true }); await writeJSON(path.join(source, 'examples/creature.json'), spec);
  // Archive exactly the current source snapshot. A rebuilt output directory
  // can contain old files or user notes; those do not belong in this package.
  await zipFiles(source, [...new Set([...sourceFiles, 'examples/creature.json'])], path.join(destination, 'source.zip'));
  await fs.writeFile(path.join(destination, 'README.txt'), `CREATURE STUDY\n\nServe this folder over HTTP; all viewer dependencies are local.\nUse the skill's serve script or any static server.\n\nEditable source: source/ or source.zip\nSpecification: creature.json\n\nTo rebuild: extract source.zip, run npm ci, then\nnode scripts/build.mjs examples/creature.json --out out/creature\n\nExport: node scripts/export.mjs <this folder>\nPreviews: node scripts/render.mjs <this folder>\n\nVisual and anatomical approval are separate from software checks.\n`);
  return { output: destination, specificationHash, sourceHash, warnings: validation.warnings };
}
if (isMain(import.meta.url)) {
  const args = parseArgs();
  if (!args._[0]) { console.error('Usage: node scripts/build.mjs <spec.json> [--out out/name]'); process.exitCode = 1; }
  else try { console.log(JSON.stringify(await buildCreature(args._[0], args.out), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
