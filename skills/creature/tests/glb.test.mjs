import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalizeGLB} from '../kit/glb.mjs';

function fixture(swapped){
  const images=swapped?[[9,8,7,6],[1,2,3,4,5,6,7,8]]:[[1,2,3,4,5,6,7,8],[9,8,7,6]];
  const json={asset:{version:'2.0'},buffers:[{byteLength:16}],bufferViews:[{buffer:0,byteOffset:0,byteLength:4},{buffer:0,byteOffset:4,byteLength:images[0].length},{buffer:0,byteOffset:4+images[0].length,byteLength:images[1].length}],accessors:[{bufferView:0}],images:[{bufferView:swapped?2:1},{bufferView:swapped?1:2}]};
  const text=new TextEncoder().encode(JSON.stringify(json)),n=Math.ceil(text.length/4)*4,out=new Uint8Array(28+n+16),v=new DataView(out.buffer);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);v.setUint32(12,n,true);v.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+n);out.set(text,20);v.setUint32(20+n,16,true);v.setUint32(24+n,0x004e4942,true);out.set([41,42,43,44,...images.flat()],28+n);return out.buffer;
}
test('GLB packing removes asynchronous image order while preserving data references',()=>{
  const a=canonicalizeGLB(fixture(false)),b=canonicalizeGLB(fixture(true));assert.deepEqual(new Uint8Array(a),new Uint8Array(b));
  const view=new DataView(a),n=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(a,20,n))),bin=new Uint8Array(a,28+n);
  const payload=index=>{const v=json.bufferViews[index];return [...bin.slice(v.byteOffset,v.byteOffset+v.byteLength)];};
  assert.deepEqual(payload(json.accessors[0].bufferView),[41,42,43,44]);
  assert.deepEqual(payload(json.images[0].bufferView),[1,2,3,4,5,6,7,8]);assert.deepEqual(payload(json.images[1].bufferView),[9,8,7,6]);
});
