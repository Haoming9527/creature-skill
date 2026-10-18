import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { BASES } from '../kit/bases/ungulates.mjs';
import { createMorph, createRig } from '../kit/rig.mjs';
import { createCoatCoordinates, coatColorFunction } from '../kit/materials.mjs';

test('proportion edits retain pigment at corresponding anatomical landmarks',async()=>{
  const original=JSON.parse(await readFile(new URL('../examples/cow.json',import.meta.url),'utf8'));
  const edited=structuredClone(original);
  Object.assign(edited.proportions,{scale:1.3,legLength:1.05,torsoLength:.96,torsoWidth:1.04,torsoDepth:.97,neckLength:1.03,headLength:1.04,tailLength:1.05});
  const base=BASES.holstein,morph=createMorph(base,edited),rig=createRig(base,edited,morph),reference=createCoatCoordinates(morph,rig);
  const pigment=coatColorFunction(original,{muzzleStart:base.neckHead.at(-4)[0],muzzleEnd:base.neckHead.at(-1)[0]});
  const landmarks=[
    ['Body',[.10,1.30,.20],morph.torso],
    ['Neck',[.80,1.36,.10],morph.neck],
    ['Head',[1.25,1.30,.10],morph.head],
    ['Tail_1',[-1.12,.85,0],morph.tail],
    ['FL_Lower',[.49,.63,.24],a=>morph.limb(a,'front')],
    ['HR_Cannon',[-.80,.30,-.28],a=>{const p=morph.limb([a[0],a[1],-a[2]],'hind');p.z*=-1;return p;}]
  ];
  try{
    for(const [bone,xyz,transform]of landmarks){
      const source=new THREE.Vector3(...xyz),world=transform(xyz),mapped=reference.rigid(world,rig.byName[bone]);
      assert(mapped.distanceTo(source)<1e-10,`${bone} marking coordinates moved with the edit`);
      const before=pigment(source).toArray(),after=pigment(mapped).toArray();
      assert(before.every((v,i)=>Math.abs(v-after[i])<1e-9),`${bone} pigment changed`);
      const indices=new THREE.Uint16BufferAttribute([rig.index(bone),0,0,0],4),weights=new THREE.Float32BufferAttribute([1,0,0,0],4);
      assert(reference.skinned(world,indices,weights,0).distanceTo(source)<1e-10,`${bone} skin pigment mapping differs from the rigid attachment`);
    }
  }finally{rig.skeleton.dispose();}
});
