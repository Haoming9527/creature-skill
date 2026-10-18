import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { createCreature } from '../kit/creature.mjs';

for(const name of ['cow','horse','horse-longer-legs']){
  test(`${name}: actual world-space stance contacts stay planted on a stationary floor`,async()=>{
    const spec=JSON.parse(await readFile(new URL(`../examples/${name}.json`,import.meta.url),'utf8'));
    const creature=createCreature(spec);
    try{
      let maxDrift=0,maxSwingPitch=0,minHoofHeight=Infinity;
      const hooves=[],vertex=new Vector3();
      creature.root.traverse(o=>{if(o.isMesh&&o.userData.part==='hoof')hooves.push(o);});
      for(const speed of [.5,1,1.5]){
        const cycle=creature.metrics.walkCycleSeconds/speed,planted={},previous={};
        for(let i=0;i<=360;i++){
          const t=i/180*cycle;creature.update(t,{pose:'walk',speed,breathing:false,locomotion:'world'});
          const expected=spec.behavior.walkSpeed*spec.proportions.scale*speed*t;
          assert(Math.abs(creature.root.getObjectByName('Root').position.x-expected)<1e-8);
          assert.equal(creature.diagnostics.treadmill,false);
          for(const [id,foot]of Object.entries(creature.diagnostics.feet)){
            if(foot.stance)assert.equal(foot.hoofPitch,0,'a planted hoof must remain level');
            else maxSwingPitch=Math.max(maxSwingPitch,Math.abs(foot.hoofPitch));
            // Read the transformed bone from the actual render hierarchy. Do not
            // add a virtual offset or trust a corrected diagnostic coordinate.
            const actual=creature.root.getObjectByName(`${id}_Contact`).getWorldPosition(new Vector3());
            if(foot.stance){
              if(!previous[id]||!planted[id])planted[id]=actual.clone();
              maxDrift=Math.max(maxDrift,actual.distanceTo(planted[id]));
            }else delete planted[id];
            previous[id]=foot.stance;
          }
          if(speed===1&&i%3===0)for(const hoof of hooves){
            const positions=hoof.geometry.attributes.position;
            for(let j=0;j<positions.count;j++){
              vertex.fromBufferAttribute(positions,j).applyMatrix4(hoof.matrixWorld);
              minHoofHeight=Math.min(minHoofHeight,vertex.y);
            }
          }
        }
      }
      assert(maxDrift<.012,`actual stationary-floor stance drift ${maxDrift}m`);
      assert(maxSwingPitch>.05,'the hoof should flex during swing rather than staying flat');
      assert(minHoofHeight>-.001,`actual hoof shell penetrated the floor by ${-minHoofHeight}m`);
      creature.update(.4,{pose:'walk',locomotion:'world'});
      const sample=creature.anchors['front-left-foot'].getWorldPosition(new Vector3()).toArray();
      creature.update(7.2,{pose:'walk',locomotion:'world'});
      creature.update(.4,{pose:'walk',locomotion:'world'});
      assert.deepEqual(creature.anchors['front-left-foot'].getWorldPosition(new Vector3()).toArray(),sample,'backward seek must reproduce the pose and root displacement');
      creature.update(2,{pose:'walk'});assert.equal(creature.root.getObjectByName('Root').position.x,0,'portable default stays in-place');
      const clip=creature.clips.find(c=>c.name==='WalkRootMotion'),track=clip.tracks.find(t=>t.name==='Root.position');
      assert(Math.abs(track.values.at(-3)-creature.metrics.locomotion.walkCycleDisplacement)<1e-6,'root-motion clip retains its forward displacement');
      assert.equal(creature.clips.find(c=>c.name==='Walk').tracks.find(t=>t.name==='Root.position').values.at(-3),0);
    }finally{creature.dispose();}
  });
}
