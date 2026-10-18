import * as THREE from 'three';

export const V = a => new THREE.Vector3(...a);
export const mix = (a,b,t) => a.clone().lerp(b,t);

/** Indexed, manifold control cage with interpolated skin influences. */
export class Cage {
  constructor(){this.vertices=[];this.faces=[];}
  add(position,weights){this.vertices.push({p:position.clone(),w:{...weights}});return this.vertices.length-1;}
  face(...ids){this.faces.push(ids);}
  bridge(a,b){
    if(a.length!==b.length)throw new Error('Loft ring cardinality differs');
    for(let j=0;j<a.length;j++){const k=(j+1)%a.length;this.face(a[j],b[j],b[k],a[k]);}
  }
  cap(ring,reverse=false){this.faces.push(reverse?[...ring].reverse():[...ring]);}
  subdivide(){
    const old=this.vertices, faces=this.faces;
    const average=(items)=>{
      const p=new THREE.Vector3(), w={};let sum=0;
      for(const [v,s]of items){p.addScaledVector(v.p,s);sum+=s;for(const [k,n]of Object.entries(v.w))w[k]=(w[k]??0)+n*s;}
      p.divideScalar(sum);for(const k of Object.keys(w))w[k]/=sum;return{p,w};
    };
    const facePoints=faces.map(f=>average(f.map(i=>[old[i],1])));
    const edges=new Map(), neighbors=old.map(()=>new Set()), incidence=old.map(()=>[]);
    faces.forEach((f,fi)=>f.forEach((a,j)=>{const b=f[(j+1)%f.length],key=a<b?`${a}:${b}`:`${b}:${a}`;if(!edges.has(key))edges.set(key,{a,b,faces:[]});edges.get(key).faces.push(fi);neighbors[a].add(b);neighbors[b].add(a);incidence[a].push(fi);}));
    const next=old.map((v,i)=>{
      const n=neighbors[i].size;
      const boundary=[...neighbors[i]].filter(j=>edges.get(i<j?`${i}:${j}`:`${j}:${i}`).faces.length===1);
      if(boundary.length)return average([[v,6],...boundary.map(j=>[old[j],1])]);
      const f=average(incidence[i].map(j=>[facePoints[j],1]));
      const r=average([...neighbors[i]].map(j=>[average([[v,1],[old[j],1]]),1]));
      return average([[f,1],[r,2],[v,n-3]]);
    });
    for(const e of edges.values()){e.index=next.length;next.push(average([[old[e.a],1],[old[e.b],1],...e.faces.map(i=>[facePoints[i],1])]));}
    const faceStart=next.length;next.push(...facePoints);const newFaces=[];
    faces.forEach((f,fi)=>f.forEach((a,j)=>{const b=f[(j+1)%f.length],c=f[(j+f.length-1)%f.length];const edge=(u,v)=>edges.get(u<v?`${u}:${v}`:`${v}:${u}`).index;newFaces.push([a,edge(a,b),faceStart+fi,edge(c,a)]);}));
    this.vertices=next;this.faces=newFaces;return this;
  }
  toGeometry(colorAt){
    const positions=[],colors=[],indices=[],skinIndex=[],skinWeight=[];
    for(const v of this.vertices){positions.push(...v.p);const color=colorAt(v.p);colors.push(color.r,color.g,color.b);const ws=Object.entries(v.w).filter(([,n])=>n>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4);const sum=ws.reduce((s,[,n])=>s+n,0)||1;for(let k=0;k<4;k++){skinIndex.push(Number(ws[k]?.[0]??0));skinWeight.push((ws[k]?.[1]??0)/sum);}}
    for(const f of this.faces)for(let i=1;i<f.length-1;i++)indices.push(f[0],f[i],f[i+1]);
    const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  }
  topology(){
    const edges=new Map(),adj=this.vertices.map(()=>[]);for(const face of this.faces)for(let j=0;j<face.length;j++){const a=face[j],b=face[(j+1)%face.length],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);adj[a].push(b);adj[b].push(a);}
    let components=0;const seen=new Set();for(let i=0;i<adj.length;i++)if(!seen.has(i)){components++;const stack=[i];while(stack.length){const a=stack.pop();if(seen.has(a))continue;seen.add(a);for(const b of adj[a])if(!seen.has(b))stack.push(b);}}
    return {vertices:this.vertices.length,faces:this.faces.length,edges:edges.size,components,boundaryEdges:[...edges.values()].filter(n=>n===1).length,nonManifoldEdges:[...edges.values()].filter(n=>n>2).length,eulerCharacteristic:this.vertices.length-edges.size+this.faces.length};
  }
}

export function addLoft(cage,sections,{segments=20,weights=()=>({0:1}),capStart=true,capEnd=true}={}){
  const rings=sections.map((s,i)=>{
    const center=s.center??V(s.slice(0,3));
    const tangent=s.axis??(i===0?sections[1].center.clone().sub(center):i===sections.length-1?center.clone().sub(sections[i-1].center):sections[i+1].center.clone().sub(sections[i-1].center)).normalize();
    let u=new THREE.Vector3(0,0,1);if(Math.abs(u.dot(tangent))>.95)u.set(1,0,0);u.addScaledVector(tangent,-u.dot(tangent)).normalize();const v=u.clone().cross(tangent).normalize();
    return Array.from({length:segments},(_,j)=>{const a=j/segments*Math.PI*2;return cage.add(center.clone().addScaledVector(u,Math.cos(a)*(s.rz??s.radius)).addScaledVector(v,Math.sin(a)*(s.ry??s.radius)),weights(i,j));});
  });
  for(let i=1;i<rings.length;i++)cage.bridge(rings[i-1],rings[i]);if(capStart)cage.cap(rings[0]);if(capEnd)cage.cap(rings.at(-1),true);return rings;
}

/** A closed leaf-shaped pinna, authored as a flattened tapered loft. */
export function earGeometry(direction,width,depth=.012){
  const cage=new Cage(),axis=direction.clone().normalize(),length=direction.length();
  addLoft(cage,[0,.18,.48,.76,.94,1].map((t,i)=>({center:axis.clone().multiplyScalar(length*t),axis,radius:0,rz:width*[.24,.75,1,.7,.25,.035][i],ry:depth*[.6,1,1,.8,.4,.06][i]})),{segments:12});
  cage.subdivide();return cage.toGeometry(()=>new THREE.Color('white'));
}

export function tubeGeometry(points,radii,segments=10){
  const cage=new Cage();addLoft(cage,points.map((p,i)=>({center:p,radius:radii[i]})),{segments});return cage.toGeometry(()=>new THREE.Color('white'));
}

/** Rounded accessory digit with a buried root and a short caudal horn tip. */
export function dewclawGeometry(scale=1){
  const cage=new Cage();
  addLoft(cage,[
    [0,.004,.013,.012],[-.012,.002,.018,.016],[-.027,-.004,.018,.016],
    [-.039,-.010,.013,.012],[-.046,-.013,.006,.007],[-.048,-.014,.001,.002]
  ].map(([x,y,ry,rz])=>({center:new THREE.Vector3(x*scale,y*scale,0),axis:new THREE.Vector3(-1,-.2,0),ry:ry*scale,rz:rz*scale})),{segments:16});
  cage.subdivide();
  return cage.toGeometry(()=>new THREE.Color('white'));
}

export function hoofGeometry(length,width,height,cloven=false){
  // A centre fan gives every wall vertex one equal cap contribution. An n-gon
  // triangulated from its first rim vertex produces a false notch at the toe.
  const cap=(cage,ring,reverse=false)=>{
    const center=new THREE.Vector3();for(const i of ring)center.add(cage.vertices[i].p);center.divideScalar(ring.length);
    const middle=cage.add(center,{0:1});
    for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];reverse?cage.face(b,a,middle):cage.face(a,b,middle);}
  };
  if(!cloven) {
    const cage=new Cage(),rings=[],n=48;
    // A hoof is a sloping wall around a broad toe and narrower paired heels.
    // Fine growth rings are shallow geometry, not a bucket-like cylinder.
    for(let k=0;k<=12;k++) {
      const t=k/12,band=.0035*Math.sin(t*Math.PI*18)*Math.sin(t*Math.PI);
      rings.push(Array.from({length:n},(_,j)=>{
        const a=j/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
        const heel=c<0,quarterWidth=heel?(.77+.23*(1+c)):1;
        const taper=1-.22*t;
        const x=(c*.5*taper+.07-.24*t)*length;
        const z=s*.5*width*(taper+band)*quarterWidth;
        const crown=1-.18*Math.max(0,-c),y=(-.65+t*crown)*height;
        return cage.add(new THREE.Vector3(x,y,z),{0:1});
      }));
    }
    for(let i=1;i<rings.length;i++)cage.bridge(rings[i-1],rings[i]);cap(cage,rings[0]);cap(cage,rings.at(-1),true);
    const g=cage.toGeometry(p=>new THREE.Color().setScalar(.84+.16*THREE.MathUtils.smoothstep(p.y,-height*.65,height*.25)));
    g.userData.speciesHoof='single equine hoof';return g;
  }
  const cage=new Cage(),rings=[];const n=24;
  for(const [y,s,shift]of [[-.65,.96,.08],[-.52,1.02,.045],[.07,.90,-.05],[.35,.72,-.10]]){
    rings.push(Array.from({length:n},(_,j)=>{const a=j/n*Math.PI*2;const x=shift*length+Math.cos(a)*length*.5*s,z=Math.sin(a)*width*.5*s;return cage.add(new THREE.Vector3(x,y*height,z),{0:1});}));
  }
  for(let i=1;i<rings.length;i++)cage.bridge(rings[i-1],rings[i]);cap(cage,rings[0]);cap(cage,rings.at(-1),true);
  const geo=cage.toGeometry(()=>new THREE.Color('white'));geo.userData.speciesHoof=cloven?'cloven toe':'single equine hoof';return geo;
}

