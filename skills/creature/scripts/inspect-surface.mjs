#!/usr/bin/env node
import * as THREE from 'three';
import path from 'node:path';
import { validateSpec } from '../kit/spec.mjs';
import { parseArgs,readJSON,writeJSON,isMain } from './lib/common.mjs';

/** Detect non-adjacent, non-coplanar triangle crossings on an indexed surface.
 * This complements manifold checks. It does not certify an anatomical shape,
 * coplanar overlap, or intersections between different accessory meshes. */
export function inspectSurface(mesh,{cellSize=.04,sampleLimit=80}={}){
  if(!mesh?.geometry)throw new Error('The continuous skin is missing.');
  if(!Number.isFinite(cellSize)||cellSize<=0)throw new Error('Surface grid cells must have a positive finite size.');
  mesh.updateMatrixWorld(true);mesh.skeleton?.update();
  const index=mesh.geometry.index?.array;if(!index)throw new Error('Surface inspection requires indexed geometry.');
  const vertices=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()));
  const triangles=[],cells=new Map();
  for(let i=0;i<index.length;i+=3){
    const ids=[index[i],index[i+1],index[i+2]],points=ids.map(n=>vertices[n]),box=new THREE.Box3().setFromPoints(points);
    const lo=box.min.clone().divideScalar(cellSize).floor(),hi=box.max.clone().divideScalar(cellSize).floor();
    const t={ids,points,box,lo,hi,id:i/3};triangles.push(t);
    for(let x=lo.x;x<=hi.x;x++)for(let y=lo.y;y<=hi.y;y++)for(let z=lo.z;z<=hi.z;z++){
      const key=`${x},${y},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t.id);
    }
  }
  const ray=new THREE.Ray(),hit=new THREE.Vector3(),edge=new THREE.Vector3(),findings=[],regions={};
  const epsilon=cellSize*1e-5;
  let candidates=0,crossings=0;
  const intersect=(a,b)=>{
    for(let i=0;i<3;i++){
      edge.copy(a[i===2?0:i+1]).sub(a[i]);const length=edge.length();if(length<epsilon)continue;
      ray.origin.copy(a[i]);ray.direction.copy(edge).divideScalar(length);
      if(ray.intersectTriangle(...b,false,hit)){
        const distance=hit.distanceTo(a[i]);
        if(distance>epsilon&&distance<length-epsilon)return hit.clone();
      }
    }
    return null;
  };
  for(const [cell,ids] of cells)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const aId=Math.min(ids[i],ids[j]),bId=Math.max(ids[i],ids[j]);
    const a=triangles[aId],b=triangles[bId];
    if(a.ids.some(n=>b.ids.includes(n))||!a.box.intersectsBox(b.box))continue;
    // Each pair belongs to the first cell shared by its two bounding boxes.
    // This avoids a quadratic-size global pair set on dense facial topology.
    const owner=`${Math.max(a.lo.x,b.lo.x)},${Math.max(a.lo.y,b.lo.y)},${Math.max(a.lo.z,b.lo.z)}`;
    if(cell!==owner)continue;
    candidates++;
    const point=intersect(a.points,b.points)||intersect(b.points,a.points);
    if(!point)continue;
    crossings++;const region=point.toArray().map(n=>(Math.round(n/.1)*.1).toFixed(1)).join(',');regions[region]=(regions[region]??0)+1;
    if(findings.length<sampleLimit)findings.push({triangles:[aId,bId],position:point.toArray()});
  }
  return {mesh:mesh.name,triangles:triangles.length,candidates,crossings,samples:findings,regions:Object.entries(regions).sort((a,b)=>b[1]-a[1]),scope:'Non-adjacent non-coplanar triangle crossings within the continuous skin at the sampled pose. Coplanar overlap and accessory intersections require separate review.',visualApproval:'pending',anatomicalApproval:'pending'};
}

/** Sample the entire walk period and each independent head/jaw control limit.
 * Discrete samples are evidence at those poses, not a continuous-time proof. */
export function inspectCreatureSurfaces(creature,spec,{walkSamples=12,onProgress=()=>{}}={}){
  if(!Number.isInteger(walkSamples)||walkSamples<4||walkSamples>120)throw new Error('Use 4–120 walk samples.');
  const duration=creature.clips.find(c=>c.name==='Walk')?.duration;
  if(!Number.isFinite(duration)||duration<=0)throw new Error('A valid Walk clip is required for cycle inspection.');
  const poses=[
    {name:'idle',time:0,controls:{pose:'idle',breathing:false}},
    {name:'breath-peak',time:1/(4*spec.behavior.breathingRate),controls:{pose:'idle',breathing:true}},
    ...[{jaw:1},{lookX:-1},{lookX:1},{lookY:-1},{lookY:1}].map(controls=>({name:`limit-${Object.keys(controls)[0]}-${Object.values(controls)[0]}`,time:0,controls:{pose:'idle',breathing:false,...controls}})),
    ...Array.from({length:walkSamples},(_,i)=>({name:`walk-${i}`,phase:i/walkSamples,time:i/walkSamples*duration,controls:{pose:'walk',speed:1,breathing:false}}))
  ];
  const mesh=creature.root.getObjectByName('Continuous_Skin'),results=[];
  try{
    for(const pose of poses){
      creature.update(pose.time,pose.controls);creature.root.updateMatrixWorld(true);
      const result={...pose,...inspectSurface(mesh,{cellSize:.02*spec.proportions.scale})};
      results.push(result);onProgress({sample:results.length,total:poses.length,name:pose.name,crossings:result.crossings});
    }
  }finally{creature.reset();}
  return {profile:spec.profile,passed:results.every(r=>r.crossings===0),samples:results.length,walkSamples,walkDuration:duration,maximumCrossings:Math.max(...results.map(r=>r.crossings)),results,scope:'Continuous skin only, at the recorded discrete poses. Unsampled poses, coplanar overlaps and accessory intersections still require review.',visualApproval:'pending',anatomicalApproval:'pending'};
}

if(isMain(import.meta.url)){
  const args=parseArgs();
  try{
    if(!args._[0])throw new Error('Usage: node scripts/inspect-surface.mjs spec.json [--pose idle|walk] [--time seconds] [--cycle] [--samples 12] [--out report.json]');
    const spec=await readJSON(args._[0]),validation=validateSpec(spec);if(!validation.valid)throw new Error(JSON.stringify(validation.errors));
    const {createCreature}=await import('../kit/creature.mjs');const model=createCreature(spec);
    try{
      const pose=args.pose||'idle',time=Number(args.time||0);if(!['idle','walk'].includes(pose)||!Number.isFinite(time))throw new Error('Use a supported pose and finite time.');
      model.update(time,{pose,breathing:false});model.root.updateMatrixWorld(true);
      const report=args.cycle?inspectCreatureSurfaces(model,spec,{walkSamples:Number(args.samples??12),onProgress:p=>console.error(JSON.stringify(p))}):{profile:spec.profile,pose,time,...inspectSurface(model.root.getObjectByName('Continuous_Skin'),{cellSize:.02*spec.proportions.scale})};
      const output=path.resolve(args.out||`out/${spec.id}-surface-${args.cycle?'cycle':pose}.json`);
      if(path.resolve(args._[0]).toLowerCase()===output.toLowerCase())throw new Error('Refusing to overwrite the specification with a report.');
      await writeJSON(output,report);console.log(JSON.stringify({output,passed:report.passed??report.crossings===0,samples:report.samples?.length??report.samples,crossings:report.maximumCrossings??report.crossings,regions:report.regions?.slice(0,12)}));
      if(report.passed===false||report.crossings>0)process.exitCode=1;
    }finally{model.dispose();}
  }catch(error){console.error(error.stack);process.exitCode=1;}
}
