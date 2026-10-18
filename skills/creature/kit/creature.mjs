import * as THREE from 'three';
import { BASES, ORIGINAL_BASE_NOTICE } from './bases/ungulates.mjs';
import { hoofGeometry, dewclawGeometry } from './geometry.mjs';
import { createMaterials, coatColorFunction, createCoatTexture, createCoatCoordinates } from './materials.mjs';
import { createMorph, createRig, createMotion } from './rig.mjs';
import { buildEquineSkin } from './equine-body.mjs';
import { buildEquineFace, buildEquineHair } from './equine-details.mjs';
import { buildBovineSkin } from './bovine-body.mjs';
import { buildBovineFace, buildBovineUdder } from './bovine-details.mjs';
import { buildBovineHair } from './bovine-hair.mjs';
import { createHeadWarp, warpRestGeometry } from './warp.mjs';


function normalizeInput(input){
  const profile=input.profile??'thoroughbred';
  if(!BASES[profile])throw new Error(`Unsupported original base: ${profile}. Supported: holstein, thoroughbred.`);
  return {...input,profile,seed:input.seed??1,
    proportions:{scale:1,torsoLength:1,torsoWidth:1,torsoDepth:1,neckLength:1,headLength:1,legLength:1,tailLength:1,...input.proportions},
    materials:{coatColor:profile==='holstein'?'#e5e0d5':'#6c3020',secondaryColor:profile==='holstein'?'#171917':'#1b1716',muzzleColor:'#4b4441',hoofColor:'#35312c',eyeColor:'#6a4122',roughness:.83,pattern:profile==='holstein'?'piebald':'solid',...input.materials},
    features:{mane:profile==='thoroughbred',tailTuft:true,horns:false,udder:profile==='holstein',...input.features},
    behavior:{breathingRate:.2,walkSpeed:profile==='holstein'?1:1.2,strideScale:1,headYawLimit:.35,headPitchLimit:.25,jawLimit:.2,...input.behavior}};
}

function attachMesh(parent,geometry,material,name,position=new THREE.Vector3()){
  // These are rigid accessories parented to a bone. Their transform supplies
  // motion; retaining cage skin attributes would create invalid glTF semantics.
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.copy(position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

/** Bake a stable tangent basis for portable normal maps. Projection poles can
 * have degenerate UV triangles; use a projected axis for those vertices. */
function bakeCoatTangents(geometry){
  geometry.computeTangents();
  const tangent=geometry.getAttribute('tangent'),normal=geometry.getAttribute('normal');
  const n=new THREE.Vector3(),t=new THREE.Vector3();
  for(let i=0;i<tangent.count;i++){
    t.fromBufferAttribute(tangent,i);
    if(!t.toArray().every(Number.isFinite)||t.lengthSq()<.5){
      n.fromBufferAttribute(normal,i).normalize();t.set(Math.abs(n.x)<.8?1:0,Math.abs(n.x)<.8?0:1,0);t.addScaledVector(n,-t.dot(n)).normalize();
      tangent.setXYZW(i,t.x,t.y,t.z,1);
    }
  }
}

function buildHooves(base,spec,morph,rig,materials,colorAt){
  const cow=spec.profile==='holstein',S=morph.scale;
  for(const leg of rig.limbs){
    const h=base.hoof;
    for(let j=0;j<(cow?2:1);j++){
      const geo=hoofGeometry(h.length*S*(!cow&&leg.which==='hind'?.96:1),(cow?h.width*.46:h.width* (leg.which==='hind'?.94:1))*S,h.height*S,cow);
      const hoof=attachMesh(leg.hoof,geo,materials.hoof,`${leg.id}_${cow?`Cloven_Toe_${j+1}`:'Single_Hoof'}`,new THREE.Vector3(0,h.height*.65*S-leg.points.foot.y,cow?(j?1:-1)*h.width*.27*S:0));
      hoof.userData={part:'hoof',limb:leg.id,hoofType:cow?'cloven':'single',toe:j+1};
    }
    if(cow)for(const side of [-1,1]){
      attachMesh(leg.pastern,dewclawGeometry(S),materials.hoof,`${leg.id}_Dewclaw_${side===leg.side?'lateral':'medial'}`,new THREE.Vector3(-.021*S,.014*S,side*.027*S));
    }
  }
}

/** Build a deterministic, editable ungulate from the shared specification.
 * The returned root contains only the creature and portable PBR materials. */
export function createCreature(input){
  const spec=normalizeInput(input),base=BASES[spec.profile],morph=createMorph(base,spec),rig=createRig(base,spec,morph),materials=createMaterials(spec);
  const root=new THREE.Group();root.name=spec.id??spec.profile;root.userData={creatureId:spec.id,profile:spec.profile,category:spec.category??'living',seed:spec.seed,originalBaseNotice:ORIGINAL_BASE_NOTICE};
  const pigmentDimensions={muzzleStart:base.neckHead.at(-4)[0],muzzleEnd:base.neckHead.at(-1)[0]};
  const pigmentSpec={...spec,proportions:{...spec.proportions,scale:1}},reference=createCoatCoordinates(morph,rig);
  const pigment=coatColorFunction(pigmentSpec,pigmentDimensions),projected=createCoatTexture(pigmentSpec,pigmentDimensions);
  const colorAt=projected?()=>new THREE.Color('white'):pigment;
  if(projected)materials.coat.map=projected.texture;
  const equine=spec.profile==='thoroughbred';
  const skin=(equine?buildEquineSkin:buildBovineSkin)(base,spec,morph,rig,colorAt,materials.coat);root.add(skin.mesh);
  (equine?buildEquineFace:buildBovineFace)(base,spec,morph,rig,materials,colorAt);
  buildHooves(base,spec,morph,rig,materials,colorAt);
  (equine?buildEquineHair:buildBovineHair)(base,spec,morph,rig,materials);
  if(!equine)buildBovineUdder(spec,morph,rig,materials,p=>(projected?.sampleAt??pigment)(reference.torso(p)));
  // Capture bind-space UVs for every coated part, including jaw and ears.
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||o.material!==materials.coat)return;
    const positions=o.geometry.getAttribute('position'),indices=o.geometry.getAttribute('skinIndex'),weights=o.geometry.getAttribute('skinWeight'),uv=[],colors=[];
    const authored=o.geometry.getAttribute('color'),overrides=o.geometry.getAttribute('pigmentOverride');
    const preserve=o.geometry.userData.preserveAuthoredPigment&&authored;
    let bone=o.parent;while(bone&&!bone.isBone)bone=bone.parent;
    for(let i=0;i<positions.count;i++){
      const world=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);
      const p=o.isSkinnedMesh&&indices&&weights?reference.skinned(world,indices,weights,i):reference.rigid(world,bone);
      const v=projected?projected.uvAt(p):new THREE.Vector2((p.x+3)/6,(p.y+p.z*.13)/3.5);uv.push(v.x,v.y);
      const color=preserve?new THREE.Color().fromBufferAttribute(authored,i):projected?new THREE.Color('white'):pigment(p);
      if(overrides){const alpha=THREE.MathUtils.clamp(overrides.getW(i),0,1);if(alpha)color.lerp(new THREE.Color().fromBufferAttribute(overrides,i),alpha);}
      colors.push(color.r,color.g,color.b);
    }
    o.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));o.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    o.geometry.deleteAttribute('pigmentOverride');
    if(materials.coat.normalMap)bakeCoatTangents(o.geometry);
  });
  // Pigment and texture coordinates are attached first, so the landmark warp
  // carries markings with the tissue instead of re-projecting them.
  if(base.headWarp)warpRestGeometry(root,createHeadWarp(base.headWarp,morph.head(base.headWarp.origin),morph.headScale));
  const anchors={head:rig.head,jaw:rig.jaw,neck:rig.neck,torso:rig.body,tail:rig.tails[0]};
  for(const leg of rig.limbs)anchors[`${leg.which}-${leg.side===1?'left':'right'}-foot`]=leg.hoof;
  const attachments=Object.fromEntries((spec.attachments??Object.keys(anchors).map(id=>({id,region:id}))).map(({id,region})=>[id,anchors[region]]));
  const motion=createMotion(rig,base,spec,morph),clips=motion.bakeClips();
  motion.update(0,{pose:'idle'});root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
  const metrics={profile:spec.profile,dimensions:{length:size.x,height:size.y,width:size.z},bounds:{min:box.min.toArray(),max:box.max.toArray()},boneCount:rig.bones.length,hoofCount:spec.profile==='holstein'?8:4,hoovesPerFoot:spec.profile==='holstein'?2:1,nominalStride:motion.walk.cycleDistance,walkCycleSeconds:clips[1].duration,skin:{vertices:skin.mesh.geometry.getAttribute('position').count,triangles:skin.mesh.geometry.index.count/3,connectedComponents:skin.topology.components,boundaryEdges:skin.topology.boundaryEdges,nonManifoldEdges:skin.topology.nonManifoldEdges,controlCage:skin.controlTopology},baseReviewStatus:'unreviewed',morphologyModel:'Original equine/bovine control cages; engineering morph envelope, not biological measurements.'};
  root.userData.metrics=metrics;
  metrics.locomotion={defaultMode:'in-place',worldMode:'controls.locomotion = "world"',forwardAxis:'+X',walkCycleDisplacement:spec.behavior.walkSpeed*morph.scale*clips[1].duration,clips:{Idle:'In place; loops',Walk:'In place; loops',WalkRootMotion:'One forward cycle; accumulate final Root displacement when repeating'}};
  metrics.locomotion.dutyFactors={...motion.walk.duty};
  metrics.locomotion.stanceTravel={front:motion.walk.stanceDistance('front'),hind:motion.walk.stanceDistance('hind')};
  const reset=()=>{motion.update(0,{pose:'idle',breathing:false});};
  const dispose=()=>{const geometries=new Set(),mats=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const g of geometries)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();rig.skeleton.dispose();};
  return{root,update:motion.update,reset,clips,anchors,attachments,metrics,diagnostics:motion.diagnostics,dispose};
}
export { BASES, ORIGINAL_BASE_NOTICE };
