#!/usr/bin/env node
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpec } from '../kit/spec.mjs';

function inspectTopology(geometry) {
  const count=geometry.getAttribute('position').count, index=geometry.index?.array;
  if (!index) return { connectedComponents: null, boundaryEdges: null, nonManifoldEdges: null, indexed: false };
  const parent=Array.from({length:count},(_,i)=>i), edges=new Map(), used=new Set();
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<index.length;i+=3) {
    const tri=[index[i],index[i+1],index[i+2]];
    for(let j=0;j<3;j++) {
      const a=tri[j],b=tri[(j+1)%3];
      if(a>=count||b>=count) continue;
      used.add(a); used.add(b); parent[find(a)]=find(b);
      const key=a<b?`${a}:${b}`:`${b}:${a}`;
      edges.set(key,(edges.get(key)??0)+1);
    }
  }
  return {indexed:true,connectedComponents:new Set([...used].map(find)).size,boundaryEdges:[...edges.values()].filter(n=>n===1).length,nonManifoldEdges:[...edges.values()].filter(n=>n>2).length,unusedVertices:count-used.size};
}

/** Structural checks, never an anatomical or visual certification. */
export function inspectModel(creature, spec) {
  const errors = [], warnings = [], counts = { meshes: 0, skinnedMeshes: 0, vertices: 0, triangles: 0, degenerateTriangles: 0, bones: 0, hoofDigits: 0, animations: creature.clips?.length ?? 0 };
  const issue = (code, location, message) => errors.push({ code, path: location, message });
  const bones = new Set(); let mainSkin;
  creature.root.updateMatrixWorld(true);
  creature.root.traverse(node => {
    const location = node.name || node.type;
    if (![...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray(), ...node.matrixWorld.elements].every(Number.isFinite)) issue('NONFINITE_TRANSFORM', location, 'A transform contains NaN or Infinity.');
    if (!node.isMesh) return;
    counts.meshes++;
    const geometry = node.geometry, pos = geometry?.getAttribute('position');
    if (!pos) { issue('MISSING_POSITIONS', location, 'Mesh has no position attribute.'); return; }
    counts.vertices += pos.count;
    if (geometry.userData.speciesHoof) counts.hoofDigits++;
    counts.triangles += geometry.index ? geometry.index.count / 3 : pos.count / 3;
    for (const [name, attribute] of Object.entries(geometry.attributes)) if (!Array.from(attribute.array).every(Number.isFinite)) issue('NONFINITE_ATTRIBUTE', `${location}.${name}`, 'Geometry attributes must be finite.');
    const invalidIndex=geometry.index && Array.from(geometry.index.array).some(index => index < 0 || index >= pos.count);
    if (invalidIndex) issue('INVALID_INDEX', location, 'Triangle index falls outside the vertex array.');
    const triangleVertices=geometry.index?.count??pos.count;
    if(triangleVertices%3)issue('INCOMPLETE_TRIANGLE',location,'Triangle vertex count must be a multiple of three.');
    if(!invalidIndex){
      let collapsed=0;
      for(let i=0;i+2<triangleVertices;i+=3){
        const a=geometry.index?.getX(i)??i,b=geometry.index?.getX(i+1)??i+1,c=geometry.index?.getX(i+2)??i+2;
        const ux=pos.getX(b)-pos.getX(a),uy=pos.getY(b)-pos.getY(a),uz=pos.getZ(b)-pos.getZ(a);
        const vx=pos.getX(c)-pos.getX(a),vy=pos.getY(c)-pos.getY(a),vz=pos.getZ(c)-pos.getZ(a);
        const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
        // Below 0.5 square micrometres in bind space: collapsed topology, not
        // a useful visible face. This also catches duplicate pole vertices.
        if(x*x+y*y+z*z<=1e-24)collapsed++;
      }
      counts.degenerateTriangles+=collapsed;
      if(collapsed)issue('DEGENERATE_TRIANGLES',location,`${collapsed} triangles have zero or negligible bind-space area.`);
    }
    if (!node.isSkinnedMesh) return;
    counts.skinnedMeshes++;
    // Merged hair fibres can have more vertices than the body. Topology gates
    // apply to the authored continuous skin, never whichever mesh is largest.
    if (node.name === 'Continuous_Skin') mainSkin=node;
    node.skeleton.bones.forEach(bone => bones.add(bone));
    const weights = geometry.getAttribute('skinWeight'), indices = geometry.getAttribute('skinIndex');
    if (!weights || !indices || weights.count !== pos.count || indices.count !== pos.count) { issue('INVALID_SKIN', location, 'Every skinned vertex needs matching skin weights and indices.'); return; }
    for (let i = 0; i < pos.count; i++) {
      const w = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      if (w.some(value => value < 0) || Math.abs(w.reduce((sum, v) => sum + v, 0) - 1) > 0.001) { issue('INVALID_SKIN_WEIGHT', location, `Vertex ${i} has unnormalized skin weights.`); break; }
      const joints = [indices.getX(i), indices.getY(i), indices.getZ(i), indices.getW(i)];
      if (joints.some((index, j) => w[j] > 0 && (!Number.isInteger(index) || index < 0 || index >= node.skeleton.bones.length))) { issue('INVALID_SKIN_INDEX', location, `Vertex ${i} references a missing joint.`); break; }
    }
  });
  counts.bones = bones.size;
  if (!counts.skinnedMeshes) issue('MISSING_SKINNED_BODY', 'root', 'A deforming skinned body is required.');
  if (!mainSkin) issue('MISSING_CONTINUOUS_SKIN', 'root', 'The named continuous skin is required for topology review.');
  const topology=mainSkin?inspectTopology(mainSkin.geometry):null;
  if (topology && (!topology.indexed || topology.connectedComponents!==1 || topology.boundaryEdges!==0 || topology.nonManifoldEdges!==0)) issue('INVALID_BODY_TOPOLOGY',mainSkin.name,'The main skin must be one connected, closed, indexed manifold surface.');
  const expectedHooves=spec.profile==='holstein'?8:4;
  if(counts.hoofDigits!==expectedHooves) issue('INCORRECT_HOOF_DIGITS','hooves',`Expected ${expectedHooves} geometric principal hoof digits for ${spec.profile}; found ${counts.hoofDigits}.`);
  for (const name of spec.supportedMovements) if (!creature.clips?.some(clip => clip.name.toLowerCase() === name)) issue('MISSING_ANIMATION', 'clips', `Missing ${name} animation clip.`);
  for (const clip of creature.clips ?? []) if (!clip.validate() || !Number.isFinite(clip.duration) || clip.duration <= 0) issue('INVALID_ANIMATION', clip.name, 'Animation must contain finite ordered keyframes and positive duration.');
  const frames = 48;
  const motionMeasurements={maxGroundError:0,maxIKResidual:0,samples:frames+1};
  for (let i = 0; i <= frames; i++) {
    creature.update(i / frames * 4, { pose: 'walk', speed: 1, jaw: 0.2, lookX: 0.2, lookY: 0.1, breathing: true });
    creature.root.updateMatrixWorld(true);
    motionMeasurements.maxGroundError=Math.max(motionMeasurements.maxGroundError,creature.diagnostics?.maxContactError??0);
    motionMeasurements.maxIKResidual=Math.max(motionMeasurements.maxIKResidual,creature.diagnostics?.maxIKResidual??0);
    let invalid = false;
    creature.root.traverse(node => { if (!node.matrixWorld.elements.every(Number.isFinite)) invalid = true; });
    if (invalid) { issue('NONFINITE_ANIMATION', 'root', `Non-finite transform at sample ${i}.`); break; }
  }
  if(motionMeasurements.maxGroundError>0.025*spec.proportions.scale) issue('FOOT_CONTACT_ERROR','motion',`Sampled planted-foot ground error is ${motionMeasurements.maxGroundError.toFixed(4)}m; inspect the rig.`);
  if(motionMeasurements.maxIKResidual>0.025*spec.proportions.scale) issue('IK_REACH_ERROR','motion',`Sampled joint solver residual is ${motionMeasurements.maxIKResidual.toFixed(4)}m; inspect stride reach and joint configuration.`);
  creature.reset();
  warnings.push({ code: 'VISUAL_MOTION_REVIEW_REQUIRED', path: 'model', message: 'Finite skinning and sampled transforms do not prove clean joints, accurate anatomy, foot contact, self-intersection freedom, or visual appeal. Inspect full cycles and clay views.' });
  return { valid: errors.length === 0, errors, warnings, counts, topology, motionMeasurements, engineMetrics: creature.metrics, diagnostics: creature.diagnostics };
}

export async function validateMain(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log('Usage: node scripts/validate.mjs spec.json [--out report.json] [--model]\nBy default checks only the specification. --model also builds geometry and samples motion.'); return; }
  const [input, ...flags] = args;
  if (!input) throw new Error('Provide a specification path; use --help for usage.');
  let output, model = false;
  for (let i = 0; i < flags.length; i++) { if (flags[i] === '--model') model = true; else if (flags[i] === '--out' && flags[i + 1]) output = flags[++i]; else throw new Error(`Unknown or incomplete option ${flags[i]}.`); }
  if (output) {
    const originalPath = await realpath(input), reportPath = await realpath(output).catch(() => path.resolve(output));
    const equal = process.platform === 'win32' ? originalPath.toLowerCase() === reportPath.toLowerCase() : originalPath === reportPath;
    if (equal) throw new Error('Refusing to overwrite the input specification with a validation report. Choose a different --out path.');
  }
  const spec = JSON.parse(await readFile(input, 'utf8'));
  const report = { ...validateSpec(spec), scope: model ? 'specification-and-model-structure' : 'specification-only', approval: { anatomy: 'pending-human-review', visuals: 'pending-human-review', physicalMobilePerformance: 'unmeasured' } };
  if (model && report.valid) {
    const { createCreature } = await import('../kit/creature.mjs');
    const creature = createCreature(spec);
    try {
      report.model = inspectModel(creature, spec);
      report.valid = report.model.valid;
      report.errors.push(...report.model.errors);
      report.warnings.push(...report.model.warnings);
    } finally { creature.dispose(); }
  }
  if (output) { await mkdir(path.dirname(path.resolve(output)), { recursive: true }); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) validateMain().catch(error => { console.error(error.message); process.exitCode = 1; });
