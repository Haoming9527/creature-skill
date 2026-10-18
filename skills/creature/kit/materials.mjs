import * as THREE from 'three';

/** Return pigment coordinates in the original anatomy's reference space.
 * Blend inverse region transforms at sewn joints just as skin influences are
 * blended there. Proportion edits then stretch the existing individual instead
 * of sampling a new part of a world-space marking field. */
export function createCoatCoordinates(morph,rig){
  const inverse=map=>{
    const origin=map([0,0,0]),x=map([1,0,0]).sub(origin),y=map([0,1,0]).sub(origin),z=map([0,0,1]).sub(origin);
    return new THREE.Matrix4().makeBasis(x,y,z).setPosition(origin).invert();
  };
  const torso=inverse(morph.torso),neck=inverse(morph.neck),head=inverse(morph.head),tail=inverse(morph.tail);
  const limbMatrices=new Map(rig.limbs.map(leg=>[leg.id,inverse(a=>{const p=morph.limb([a[0],a[1],a[2]*leg.side],leg.which);p.z*=leg.side;return p;})]));
  const forBone=bone=>{
    const name=bone?.name??'';
    if(name==='Neck')return neck;
    if(name==='Head'||name==='Jaw'||name.startsWith('Ear_'))return head;
    if(name.startsWith('Tail_'))return tail;
    return limbMatrices.get(name.slice(0,2))??torso;
  };
  const boneMatrices=rig.bones.map(forBone),sample=new THREE.Vector3();
  return {
    torso:p=>p.clone().applyMatrix4(torso),
    rigid:(p,bone)=>p.clone().applyMatrix4(forBone(bone)),
    skinned:(p,indices,weights,i)=>{
      const result=new THREE.Vector3();let total=0;
      for(let j=0;j<4;j++){
        const weight=weights.getComponent(i,j);if(weight<=0)continue;
        sample.copy(p).applyMatrix4(boneMatrices[indices.getComponent(i,j)]??torso);result.addScaledVector(sample,weight);total+=weight;
      }
      return total?result.divideScalar(total):p.clone().applyMatrix4(torso);
    }
  };
}

export function createMaterials(spec){
  const m=spec.materials;
  const result = {
    coat:new THREE.MeshStandardMaterial({name:'Coat · portable vertex pigment',color:0xffffff,vertexColors:true,roughness:m.roughness??.83}),
    skin:new THREE.MeshStandardMaterial({name:'Muzzle and lips',color:m.muzzleColor,roughness:.68}),
    eyelid:new THREE.MeshStandardMaterial({name:'Pigmented eyelid',color:'#29231f',roughness:.84}),
    hair:new THREE.MeshStandardMaterial({name:'Mane and tail hair',color:spec.profile==='thoroughbred'?'#171514':m.secondaryColor,roughness:.9}),
    hoof:new THREE.MeshStandardMaterial({name:'Keratin hoof',color:m.hoofColor,roughness:.64,vertexColors:true}),
    iris:new THREE.MeshStandardMaterial({name:'Iris',color:m.eyeColor,roughness:.25}),
    eye:new THREE.MeshPhysicalMaterial({name:'Moist corneal surface',color:'#171715',roughness:.13,clearcoat:1,clearcoatRoughness:.06}),
    pupil:new THREE.MeshStandardMaterial({name:'Pupil and nostril recess',color:'#080909',roughness:.3}),
    ear:new THREE.MeshStandardMaterial({name:'Ear interior',color:spec.profile==='holstein'?'#aa928a':'#725747',roughness:.96,side:THREE.DoubleSide}),
    udder:new THREE.MeshStandardMaterial({name:'Udder skin',color:'#b9a095',roughness:.84})
  };
  {
    const detail=createShortCoatDetail(spec.seed);
    result.coat.normalMap=detail.normal;
    result.coat.normalScale=new THREE.Vector2(.045,.045);
    result.coat.roughnessMap=detail.roughness;
    // glTF packs roughness in G and metalness in B. Sharing this data texture
    // also avoids the exporter's canvas-only path for merging separate maps.
    result.coat.metalnessMap=detail.roughness;
    result.coat.name='Short coat · portable directional surface';
    if(spec.profile==='thoroughbred')result.skin.roughness=.48;
  }
  return result;
}

/** Original repeatable fine surface detail. These ordinary texture maps survive
 * GLB export; they supplement anatomical geometry rather than drawing muscles. */
function createShortCoatDetail(seed) {
  const size=512,normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),heights=new Float32Array(size*size);
  // Random overlapping short fibres have no long coherent stripes. Periodic
  // lattice coordinates keep the half-metre tile seamless and reproducible.
  const field=(u,v,nx,ny,salt)=>{
    const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const sample=(a,b)=>hash(((a%nx+nx)%nx)*17+((b%ny+ny)%ny)*137+seed+salt);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(ix,iy),sample(ix+1,iy),sx),THREE.MathUtils.lerp(sample(ix,iy+1),sample(ix+1,iy+1),sx),sy);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)heights[y*size+x]=.7*field(x/size,y/size,32,256,3)+.23*field(x/size,y/size,91,173,13)+.07*field(x/size,y/size,11,13,71);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/size,v=y/size,i=(y*size+x)*4;
    const dx=(heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size])*1.8,dy=(heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x])*1.8;
    const n=new THREE.Vector3(-dx,-dy,1).normalize();
    normal[i]=Math.round((n.x*.5+.5)*255);normal[i+1]=Math.round((n.y*.5+.5)*255);normal[i+2]=Math.round((n.z*.5+.5)*255);normal[i+3]=255;
    const lay=field(u,v,17,19,101);
    const value=Math.round(234+9*lay+4*heights[y*size+x]);roughness[i]=255;roughness[i+1]=value;roughness[i+2]=0;roughness[i+3]=255;
  }
  const texture=(data,name)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.name=name;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(12,7);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  return {normal:texture(normal,'Original directional coat normal'),roughness:texture(roughness,'Original packed coat roughness and nonmetallic response')};
}

/** A seam-free oblique planar pigment projection. Unlike shader triplanar
 * effects, the resulting pixels and UVs are standard, portable glTF assets. */
export function createCoatTexture(spec,dimensions){
  if(spec.materials.pattern!=='piebald')return null;
  const width=1024,height=768,data=new Uint8Array(width*height*4),S=spec.proportions.scale;
  const colorAt=coatColorFunction(spec,dimensions);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const color=colorAt(new THREE.Vector3((x/(width-1)*6-3)*S,y/(height-1)*3.5*S,0)).convertLinearToSRGB(),i=(y*width+x)*4;
    data[i]=Math.round(clamp01(color.r)*255);data[i+1]=Math.round(clamp01(color.g)*255);data[i+2]=Math.round(clamp01(color.b)*255);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;texture.name='Original seeded coat pigment';
  // Fade the oblique projection before the muzzle so the hairless nose region
  // stays aligned on both sides of the face rather than shifting with side Z.
  const uvAt=p=>{const head=THREE.MathUtils.smoothstep(p.x,dimensions.muzzleStart-.35*S,dimensions.muzzleStart-.15*S);return new THREE.Vector2((p.x/S+p.z/S*.72*(1-head)+3)/6,p.y/S/3.5);};
  const sampleAt=p=>{const uv=uvAt(p);return colorAt(new THREE.Vector3((uv.x*6-3)*S,uv.y*3.5*S,0));};
  return {texture,uvAt,sampleAt};
}
const clamp01=x=>Math.max(0,Math.min(1,x));

function hash(x){const n=Math.sin(x*127.1+311.7)*43758.5453;return n-Math.floor(n);}
function noise(x,y,z,seed){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz;
  const s=t=>t*t*(3-2*t),sx=s(fx),sy=s(fy),sz=s(fz);let out=0;
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)out+=hash((ix+a)*17+(iy+b)*137+(iz+c)*59+seed)* (a?sx:1-sx)*(b?sy:1-sy)*(c?sz:1-sz);
  return out;
}

/** Solid pigment is portable GLB COLOR_0. Piebald boundaries follow a seeded
 * low-frequency field across torso and sewn limb surfaces without UV seams. */
export function coatColorFunction(spec,dimensions){
  const base=new THREE.Color(spec.materials.coatColor),second=new THREE.Color(spec.materials.secondaryColor),muzzle=new THREE.Color(spec.materials.muzzleColor),seed=spec.seed??1;
  const scale=spec.proportions.scale??1;
  return p=>{
    const x=p.x/scale,y=p.y/scale,z=p.z/scale;
    let c=base.clone();
    if(spec.materials.pattern==='piebald'){
      const field=noise(x*3.5,y*3.5,z*3.5,seed)+.21*noise(x*9,y*9,z*9,seed+7)+.035*(noise(x*38,y*38,z*38,seed+19)-.5);
      const t=THREE.MathUtils.smoothstep(field,.525,.555);c.lerp(second,t);
    }else{
      const ventral=THREE.MathUtils.smoothstep(y,.55,1.2);c.multiplyScalar(.80+.20*ventral);
      // Bay horses: black points below the carpus/hock, black mane and tail.
      if(spec.profile==='thoroughbred'){
        // Points reach the knee and hock; the boundary blends over a short
        // band rather than a long gradient through the forearm and gaskin.
        c.lerp(second,1-THREE.MathUtils.smoothstep(y,.50,.68));
        // Subtle coat value variation is separate from the sculpted anatomy.
        // The dorsal coat is darker; the field is broad, without drawn muscles.
        const back=THREE.MathUtils.smoothstep(y,1.32,1.62)*(1-THREE.MathUtils.smoothstep(x,.52,1.02));
        c.multiplyScalar((1-.19*back)*(.92+.16*noise(x*2.7,y*2.7,z*2.7,seed+41)));
      }
    }
    const nose=THREE.MathUtils.smoothstep(x,dimensions.muzzleStart/scale,dimensions.muzzleEnd/scale);c.lerp(muzzle,nose*.95);
    const fine=noise(x*62,y*62,z*62,seed+23);c.multiplyScalar(.96+.075*fine);return c;
  };
}
