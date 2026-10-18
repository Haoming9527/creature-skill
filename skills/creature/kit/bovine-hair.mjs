import * as THREE from 'three';
import { Cage, addLoft } from './geometry.mjs';

/** Original short tail switch. Rounded tapered fibres share the tail rig; no
 * solid cone or hair card supplies the silhouette. */
export function buildBovineHair(base,spec,morph,rig,materials){
  if(!spec.features.tailTuft)return;
  const cage=new Cage(),S=morph.scale,seed=spec.seed;
  const random=i=>{const n=Math.sin(i*127.1+seed*17.71)*43758.5453;return n-Math.floor(n);};
  const start=morph.tail(base.tailPath[3]).lerp(morph.tail(base.tailPath[4]),.62);
  const lower=morph.tail(base.tailPath.at(-1));
  for(let i=0;i<190;i++){
    const angle=random(i)*Math.PI*2,radius=Math.sqrt(random(i+221)),length=.035+.095*random(i+446);
    const points=Array.from({length:6},(_,j)=>{
      const t=j/5,p=start.clone().lerp(lower,t);
      const spread=(.010+.033*Math.sin(t*Math.PI*.74))*radius*S;
      p.x+=Math.cos(angle)*spread+Math.sin(t*5+i)*.004*S;
      p.z+=Math.sin(angle)*spread;
      p.y-=length*S*t*t;
      return p;
    });
    const curve=new THREE.CatmullRomCurve3(points);
    addLoft(cage,Array.from({length:11},(_,j)=>({center:curve.getPoint(j/10),radius:(.00015+.00135*(1-j/10)**.58)*S})),{
      segments:5,
      weights:j=>{const t=THREE.MathUtils.smoothstep(j/10,.05,.8);return {[rig.index('Tail_2')]:1-t,[rig.index('Tail_3')]:t};}
    });
  }
  const geometry=cage.toGeometry(p=>new THREE.Color().setScalar(.76+.22*random(Math.round(p.x*1700+p.y*2900+p.z*3100))));
  const hair=materials.hair.clone();hair.vertexColors=true;
  const mesh=new THREE.SkinnedMesh(geometry,hair);mesh.name='Bovine_Tail_Switch';
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  const root=rig.root.parent.parent;root.add(mesh);mesh.bind(rig.skeleton);mesh.normalizeSkinWeights();
}
