import { build } from 'esbuild';
import { skillRoot } from './common.mjs';
/** Independently parse the delivered file and exercise its baked clips. */
export async function verifyRoundTrip(page, encoded) {
  const source = `
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { createStudioEnvironment } from './kit/studio.mjs';
    export async function verify(encoded) {
      const binary=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const gltf=await new GLTFLoader().parseAsync(binary.buffer,'');
      let meshes=0,skinnedMeshes=0,bones=0,finite=true;
      const rest=[];
      gltf.scene.traverse(o=>{if(o.isMesh)meshes++;if(o.isSkinnedMesh)skinnedMeshes++;if(o.isBone){bones++;rest.push(o);}o.updateMatrixWorld(true);});
      const snapshots=()=>rest.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]);
      const animations=[];
      for(const clip of gltf.animations){
        const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.play();mixer.setTime(0);const a=snapshots();mixer.setTime(clip.duration*.37);const b=snapshots();
        gltf.scene.updateMatrixWorld(true);
        let changed=0;for(let i=0;i<a.length;i++){if(Math.abs(a[i]-b[i])>1e-6)changed++;if(!Number.isFinite(b[i]))finite=false;}
        gltf.scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();const v=new THREE.Vector3();for(let i=0;i<o.geometry.attributes.position.count;i+=Math.max(1,Math.floor(o.geometry.attributes.position.count/500))){v.fromBufferAttribute(o.geometry.attributes.position,i);o.applyBoneTransform(i,v);if(!v.toArray().every(Number.isFinite))finite=false;}}});
        animations.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,changedComponents:changed});mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
      }
      // A new scene, renderer and camera exercise the parsed GLB independently
      // of the authoring scene. Keep an actual image for material/skin review.
      const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(960,800);renderer.setPixelRatio(1);
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      const scene=new THREE.Scene();scene.background=new THREE.Color('#e2e5e0');scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(gltf.scene),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z);
      const camera=new THREE.PerspectiveCamera(32,960/800,.01,span*30);camera.position.copy(center).addScaledVector(new THREE.Vector3(1.7,.8,2.7).normalize(),span*1.95);camera.lookAt(center);
      const environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=1.1;
      scene.add(new THREE.HemisphereLight('#ffffff','#aaaaaa',.4));const light=new THREE.DirectionalLight('#fffaf4',2.2);light.position.set(-span*.3,span*4,span*2);light.target.position.copy(center);light.castShadow=true;
      light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-span;light.shadow.camera.right=span;light.shadow.camera.top=span;light.shadow.camera.bottom=-span;light.shadow.normalBias=.006;scene.add(light,light.target);
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(span*30,span*30),new THREE.MeshStandardMaterial({color:'#b5b7b5',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=bounds.min.y;floor.receiveShadow=true;scene.add(floor);
      gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});renderer.render(scene,camera);
      const preview=renderer.domElement.toDataURL('image/png').split(',')[1];
      floor.geometry.dispose();floor.material.dispose();environment.dispose();renderer.dispose();
      gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material)){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});
      return {meshes,skinnedMeshes,bones,finite,animations,preview};
    }`;
  const result = await build({ stdin: { contents: source, resolveDir: skillRoot }, bundle: true, write: false, format: 'iife', globalName: 'GLBCheck', target: 'es2022' });
  await page.addScriptTag({ content: result.outputFiles[0].text });
  return page.evaluate((value) => window.GLBCheck.verify(value), encoded);
}
