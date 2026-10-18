import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Local studio reflections, authored from light panels rather than a remote HDR. */
export function createStudioEnvironment(renderer){
  const scene=new THREE.Scene();scene.background=new THREE.Color(.12,.13,.14);
  const panels=[
    {size:[8,6],position:[-3,7,3],color:[4.0,3.8,3.5]},
    {size:[2,7],position:[4,3,-5],color:[3.2,3.5,4.0]},
    {size:[3,6],position:[-5,2,-3],color:[1.7,1.8,2.0]},
    {size:[5,2],position:[2,1,6],color:[.75,.75,.72]},
    {size:[4,7],position:[5,2,2],color:[.025,.025,.025]}
  ];
  for(const p of panels){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(...p.size),new THREE.MeshBasicMaterial({color:new THREE.Color(...p.color),side:THREE.DoubleSide}));mesh.position.set(...p.position);mesh.lookAt(0,1,0);scene.add(mesh);}
  const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(scene,.035);
  pmrem.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return target;
}

/** Mild local occlusion exposes joins and ground contact without baking them
 * into the animal. Standard PBR materials remain independent of this viewer. */
export function createStudioRenderer(renderer,scene,camera,scale){
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,target),renderPass=new RenderPass(scene,camera);
  const ao=new GTAOPass(scene,camera,512,512,undefined,{radius:.11*scale,thickness:.06*scale,distanceExponent:1.5,scale:1,samples:12},{radius:6,samples:8});
  ao.blendIntensity=.55;
  const output=new OutputPass();composer.addPass(renderPass);composer.addPass(ao);composer.addPass(output);
  renderer.info.autoReset=false;
  return {
    render(){renderer.info.reset();composer.render();},
    setOcclusion(enabled){ao.enabled=enabled;},
    resize(width,height){composer.setSize(width,height);},
    dispose(){ao.dispose();output.dispose();renderPass.dispose();composer.dispose();}
  };
}
