#!/usr/bin/env node
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildCreature} from './build.mjs';
import {renderPreviews} from './render.mjs';
import {exportCreature} from './export.mjs';
import {checkViewer} from './check-viewer.mjs';
import {inspectModel} from './validate.mjs';
import {inspectCreatureSurfaces} from './inspect-surface.mjs';
import {validateSpec} from '../kit/spec.mjs';
import {parseArgs,readJSON,writeJSON,isMain} from './lib/common.mjs';

/** Run a complete local delivery. Review approvals are never inferred from checks. */
export async function deliver(specPath,output) {
  const built=await buildCreature(specPath,output),directory=built.output;
  const {createCreature}=await import(`${pathToFileURL(path.join(directory,'model.mjs')).href}?source=${built.sourceHash}`);
  const spec=await readJSON(path.join(directory,'creature.json')),creature=createCreature(spec);
  let structure,surfaces;
  try {
    structure=inspectModel(creature,spec);
    if(structure.valid)surfaces=inspectCreatureSurfaces(creature,spec,{onProgress:progress=>console.error(JSON.stringify({surfaceInspection:progress}))});
  } finally {creature.dispose();}
  await writeJSON(path.join(directory,'validation.json'),{...validateSpec(spec),model:structure,valid:structure.valid,anatomy:'pending-human-review',visuals:'pending-human-review'});
  if(!structure.valid)throw new Error('Model validation failed; inspect validation.json before delivery.');
  await writeJSON(path.join(directory,'surface-checks.json'),surfaces);
  if(!surfaces.passed)throw new Error('The continuous skin crosses itself at sampled poses; inspect surface-checks.json before delivery.');
  const previews=await renderPreviews(directory);
  const exported=await exportCreature(directory);
  const browser=await checkViewer(directory);
  const report={specificationHash:built.specificationHash,sourceHash:built.sourceHash,softwareChecksPassed:structure.valid&&surfaces.passed&&browser.passed&&exported.errors===0,model:structure.counts,surfaceChecks:{passed:surfaces.passed,samples:surfaces.samples,scope:surfaces.scope},previewCount:previews.images.length,export:{bytes:exported.bytes,errors:exported.errors,warnings:exported.warnings,animations:exported.roundTrip.animations},performance:browser.performance,review:{anatomy:'pending-human-review',visual:'pending-human-review',physicalMobile:'not-tested'},releaseReady:false,files:{viewer:'index.html',specification:'creature.json',source:'source.zip',model:'creature.glb',previews:'previews/review.json',structuralChecks:'validation.json',surfaceChecks:'surface-checks.json',browserChecks:'browser-checks.json',exportChecks:'creature.glb.validation.json',exportPreview:'creature.glb.preview.png'},note:'Inspect all views and motion, compare references, and record unresolved defects. Software success does not approve a showcase.'};
  await writeJSON(path.join(directory,'delivery-report.json'),report);
  if(!report.softwareChecksPassed)throw new Error('Delivery has failed browser checks; inspect delivery-report.json.');
  return{directory,softwareChecksPassed:report.softwareChecksPassed,previewCount:report.previewCount,export:report.export,review:report.review,releaseReady:false};
}
if(isMain(import.meta.url)){const args=parseArgs();if(!args._[0]){console.error('Usage: node scripts/deliver.mjs <spec.json> [--out output-folder]');process.exitCode=1;}else try{console.log(JSON.stringify(await deliver(args._[0],args.out),null,2));}catch(error){console.error(error.stack);process.exitCode=1;}}
