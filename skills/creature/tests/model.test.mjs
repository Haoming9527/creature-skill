import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCreature } from '../kit/creature.mjs';
import { createEditedSpec } from '../kit/spec.mjs';
import { inspectModel } from '../scripts/validate.mjs';

const example = async name => JSON.parse(await readFile(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));
function geometryHash(root) {
  const hash = createHash('sha256');
  root.traverse(node => {
    if (!node.isMesh) return;
    hash.update(node.name);
    for (const [key, attribute] of Object.entries(node.geometry.attributes).sort(([a],[b]) => a.localeCompare(b))) {
      hash.update(key);
      hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    if (node.geometry.index) hash.update(Buffer.from(node.geometry.index.array.buffer));
  });
  return hash.digest('hex');
}
function boneRest(root) {
  const result = {};
  root.traverse(node => { if (node.isBone) result[node.name] = node.position.toArray(); });
  return result;
}

for (const [name, hoofCount] of [['cow',8],['horse',4]]) {
  test(`${name}: a single closed skin, correct hoof digits, finite normalized skinning and exportable clips`, async () => {
    const spec = await example(name), creature = createCreature(spec);
    try {
      const report = inspectModel(creature, spec);
      assert.equal(report.valid,true,JSON.stringify(report.errors));
      assert.equal(creature.metrics.skin.connectedComponents,1,'body should be one connected deforming surface');
      assert.equal(creature.metrics.skin.boundaryEdges,0,'body should not have open branch ports');
      assert.equal(creature.metrics.skin.nonManifoldEdges,0);
      assert.equal(creature.metrics.hoofCount,hoofCount);
      assert.equal(creature.metrics.baseReviewStatus,'unreviewed','software checks cannot award anatomical approval');
      assert(report.counts.bones >= 20);
    } finally { creature.dispose(); }
  });
}

test('same specification and seed reproduce geometry, weights and bone positions exactly', async () => {
  const spec = await example('cow'), first = createCreature(spec), second = createCreature(structuredClone(spec));
  try {
    assert.equal(geometryHash(first.root),geometryHash(second.root));
    assert.deepEqual(boneRest(first.root),boneRest(second.root));
    assert.deepEqual(first.metrics,second.metrics);
    const before = geometryHash(first.root);
    first.update(4.1,{pose:'walk',speed:1,jaw:1,lookX:1,lookY:-1});
    first.reset();
    assert.equal(geometryHash(first.root),before,'pose updates should not destructively deform the source geometry');
  } finally { first.dispose(); second.dispose(); }
});

test('leg-length follow-up changes surface, rig and stride while preserving seed and sources', async () => {
  const original = await example('horse');
  const edited = createEditedSpec(original,{'proportions.legLength':1.05});
  const first = createCreature(original), second = createCreature(edited);
  try {
    assert.notEqual(geometryHash(first.root),geometryHash(second.root));
    assert.notDeepEqual(boneRest(first.root),boneRest(second.root));
    assert(second.metrics.dimensions.height > first.metrics.dimensions.height);
    assert(second.metrics.nominalStride > first.metrics.nominalStride);
    assert(second.metrics.walkCycleSeconds > first.metrics.walkCycleSeconds);
    for (const limb of ['FL','FR','HL','HR']) {
      const length = c => ['Lower','Cannon','Pastern','Hoof'].reduce((sum,joint)=>sum+c.root.getObjectByName(`${limb}_${joint}`).position.length(),0);
      assert(Math.abs(length(second)/length(first)-1.05)<1e-10,`${limb} articulated chain must lengthen by exactly the requested 5%`);
    }
    assert.equal(edited.seed,original.seed);
    assert.deepEqual(edited.sources,original.sources);
    for (const id of ['head','jaw','tail','front-left-foot']) assert(second.anchors[id],`${id} attachment must be rebuilt`);
  } finally { first.dispose(); second.dispose(); }
});

test('jaw and head controls visibly change their intended joints and stay finite', async () => {
  const creature = createCreature(await example('horse'));
  try {
    creature.update(0,{pose:'idle',breathing:false,jaw:0,lookX:0,lookY:0});
    const jaw = creature.root.getObjectByName('Jaw'), head = creature.root.getObjectByName('Head');
    const closed = jaw.quaternion.toArray(), forward = head.quaternion.toArray();
    creature.update(0,{pose:'idle',breathing:false,jaw:1,lookX:1,lookY:-1});
    assert.notDeepEqual(jaw.quaternion.toArray(),closed);
    assert.notDeepEqual(head.quaternion.toArray(),forward);
    assert([...jaw.quaternion.toArray(),...head.quaternion.toArray()].every(Number.isFinite));
    const open = jaw.quaternion.toArray();
    creature.update(0,{pose:'idle',breathing:false,jaw:100,lookX:100,lookY:-100});
    assert.deepEqual(jaw.quaternion.toArray(),open,'out-of-range controls must clamp rather than break the joint');
  } finally { creature.dispose(); }
});

test('declared attachment IDs resolve to the specified moving anatomical regions',async()=>{
  const spec=await example('horse');spec.attachments=[{id:'hoof-inspection',region:'front-left-foot'},{id:'skull-label',region:'head'}];
  const c=createCreature(spec);
  try{assert.deepEqual(Object.keys(c.attachments),['hoof-inspection','skull-label']);assert.equal(c.attachments['hoof-inspection'],c.anchors['front-left-foot']);assert.equal(c.attachments['skull-label'],c.anchors.head);c.update(1,{pose:'walk',locomotion:'world'});assert(c.attachments['hoof-inspection'].matrixWorld.elements.every(Number.isFinite));}finally{c.dispose();}
});

for (const name of ['cow','horse','horse-longer-legs']) {
  test(`${name}: lateral four-beat walk preserves stance contact and speed/travel relationship`, async () => {
    const spec = await example(name), creature = createCreature(spec);
    try {
      for (const speed of [0.5,1,1.5]) {
        const cycle = creature.metrics.walkCycleSeconds/speed, steps = 240;
        let previous, maxGround=0, maxIK=0, maxSlip=0;
        const touchdowns=[], planted={};
        for (let i=0;i<=steps*2;i++) {
          const t=i/steps*cycle;
          creature.update(t,{pose:'walk',speed,breathing:false});
          const d=structuredClone(creature.diagnostics);
          maxGround=Math.max(maxGround,d.maxContactError);
          maxIK=Math.max(maxIK,d.maxIKResidual);
          for (const [id,foot] of Object.entries(d.feet)) {
            const prev=previous?.feet[id];
            if (prev && !prev.stance && foot.stance) touchdowns.push(id);
            if (foot.stance) {
              if (planted[id] === undefined || !prev?.stance) planted[id]=foot.virtualGroundX;
              maxSlip=Math.max(maxSlip,Math.abs(foot.virtualGroundX-planted[id]));
            } else delete planted[id];
          }
          previous=d;
        }
        assert(maxGround<0.025,`ground error ${maxGround}m at speed ${speed}`);
        assert(maxIK<0.025,`IK error ${maxIK}m at speed ${speed}`);
        assert(maxSlip<0.012,`accumulated planted-foot drift ${maxSlip}m at speed ${speed}`);
        const sequence=['HL','FL','HR','FR'];
        assert(touchdowns.length>=7,`expected two four-beat cycles: ${touchdowns}`);
        for(let i=1;i<touchdowns.length;i++) assert.equal(touchdowns[i],sequence[(sequence.indexOf(touchdowns[i-1])+1)%4],`footfall order: ${touchdowns}`);
        const expectedTravel=spec.behavior.walkSpeed*speed*spec.proportions.scale*cycle*2;
        assert(Math.abs(previous.virtualRootTravel-expectedTravel)<1e-6);
      }
    } finally { creature.dispose(); }
  });
}
