import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { inspectSurface } from '../scripts/inspect-surface.mjs';

function surface(points,index){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex(index);return new THREE.Mesh(g);}
test('surface inspection detects crossings that a finite-coordinate check misses',()=>{
  const mesh=surface([[0,0,0],[1,0,0],[0,1,0],[.2,.2,-1],[.2,.2,1],[.8,.2,0]],[0,1,2,3,4,5]);
  assert.equal(inspectSurface(mesh,{cellSize:.5}).crossings,1);mesh.geometry.dispose();
});
test('surface inspection excludes shared topology and separated triangles',()=>{
  const mesh=surface([[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,2],[1,0,2],[0,1,2]],[0,1,2,1,3,2,4,5,6]);
  assert.equal(inspectSurface(mesh,{cellSize:.5}).crossings,0);mesh.geometry.dispose();
});
