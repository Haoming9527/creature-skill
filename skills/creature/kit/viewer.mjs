import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createCreature } from './creature.mjs';
import { validateSpec } from './spec.mjs';
import { createStudioEnvironment, createStudioRenderer } from './studio.mjs';
import { canonicalizeGLB } from './glb.mjs';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const fixed = params.has('capture');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { pose: 'idle', speed: 1, jaw: 0, lookX: 0, lookY: 0, breathing: true, paused: reduced, clay: false, labels: true, part: '', time: 0, locomotion:'world' };
const viewNames = ['three-quarter', 'side', 'front', 'rear', 'above'];
const errorList = [];
addEventListener('error', (event) => errorList.push(event.message));
addEventListener('unhandledrejection', (event) => errorList.push(String(event.reason)));
const pretty = (text) => text.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

async function main() {
  const loadMetrics={generationMilliseconds:null,readyAfterNavigationMilliseconds:null};
  const response = await fetch('./creature.json');
  if (!response.ok) throw new Error(`Cannot load the creature specification (${response.status}). Serve this folder over HTTP.`);
  const spec = await response.json();
  const validation = validateSpec(spec);
  if (!validation.valid) throw new Error(validation.errors.map((e) => e.message).join('\n'));
  const generationStart=performance.now(),model = createCreature(spec);
  loadMetrics.generationMilliseconds=performance.now()-generationStart;
  const stage = $('canvas');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 800 ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e2e5e0');
  const environment = createStudioEnvironment(renderer); scene.environment = environment.texture; scene.environmentIntensity = 1.1;
  scene.add(model.root); model.update(0, state); model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root); const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3()); const span = Math.max(size.x, size.y, size.z);
  const camera = new THREE.PerspectiveCamera(32, 1, .01, 150);
  const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true;
  orbit.dampingFactor = .08; orbit.minDistance = span * .35; orbit.maxDistance = span * 5; orbit.maxPolarAngle = Math.PI * .495;
  const key = new THREE.DirectionalLight('#fffaf4', 2.1); key.position.set(-span * .3, span * 4, span * 2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -span * 1.2; key.shadow.camera.right = span * 1.2; key.shadow.camera.top = span * 1.2; key.shadow.camera.bottom = -span * 1.2;
  key.shadow.camera.near = .1; key.shadow.camera.far = span * 10; key.shadow.bias = -.00015; key.shadow.normalBias = .006; key.shadow.radius = 18; key.shadow.blurSamples = 12;
  key.target.position.copy(center); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#dbe8f4', .9); fill.position.set(-span, span, -span); scene.add(fill);
  const ambient=new THREE.HemisphereLight('#ffffff', '#aaaaaa', .28);scene.add(ambient);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 200, span * 200), new THREE.MeshStandardMaterial({ color: '#b5b7b5', roughness: 1, metalness: 0 }));
  floor.name = 'Ground'; floor.rotation.x = -Math.PI / 2; floor.position.y = 0; floor.receiveShadow = true; scene.add(floor);
  scene.fog = new THREE.Fog('#e2e5e0', span * 6, span * 18);
  const studioRenderer=createStudioRenderer(renderer,scene,camera,spec.proportions.scale);
  const clay = new THREE.MeshStandardMaterial({ color: '#818779', roughness: .83 });
  const clayInterior = clay.clone(); clayInterior.side = THREE.DoubleSide;
  const originals = new Map();
  model.root.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; originals.set(object, object.material); } });
  const anchors = model.attachments || model.anchors || {};
  const selected = new THREE.Vector3();
  let trackedRootX = 0;
  let activeSpeed = 1;
  const setView = (name) => {
    const directions = { 'three-quarter': [1.7, .8, 2.7], 'three-quarter-rear': [-1.7,.8,2.7], side: [0, .22, 3], front: [3, .25, 0], rear: [-3, .25, 0], above: [0, 3, .01] };
    const direction = new THREE.Vector3(...(directions[name] || directions['three-quarter'])).normalize();
    orbit.target.copy(center); orbit.target.x += trackedRootX;
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const corner = new THREE.Vector3(x, y, z).sub(center);
      distance = Math.max(distance, Math.abs(corner.dot(right)) / (tanY * aspect) + corner.dot(direction), Math.abs(corner.dot(up)) / tanY + corner.dot(direction));
    }
    distance *= 1.3;
    camera.position.copy(orbit.target).addScaledVector(direction, distance); orbit.update();
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === name));
  };
  let renderOnResize = () => {};
  let lastWidth = 0, lastHeight = 0;
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === lastWidth && h === lastHeight)) return; lastWidth = w; lastHeight = h; renderer.setSize(w, h); studioRenderer.resize(w,h); camera.aspect = w / h; camera.updateProjectionMatrix(); renderOnResize(); };
  new ResizeObserver(resize).observe(stage); resize(); setView('three-quarter');
  const updateLabel = () => {
    const label = $('part-label'), anchor = anchors[state.part];
    if (!state.labels || !anchor?.getWorldPosition) { label.hidden = true; return; }
    anchor.getWorldPosition(selected); selected.project(camera);
    label.hidden = selected.z > 1 || selected.z < -1 || Math.abs(selected.x) > 1 || Math.abs(selected.y) > 1;
    label.style.left = `${(selected.x * .5 + .5) * stage.clientWidth}px`;
    label.style.top = `${(-selected.y * .5 + .5) * stage.clientHeight}px`;
    label.firstElementChild.textContent = pretty(state.part); label.lastElementChild.textContent = spec.identity.breed;
  };
  const render = (time = state.time) => {
    state.time = time; model.update(time, {...state,speed:state.speed===0?activeSpeed:state.speed});
    const rootX = model.root.getObjectByName('Root')?.position.x || 0, delta = rootX-trackedRootX;
    camera.position.x += delta; orbit.target.x += delta; key.position.x += delta; key.target.position.x += delta; fill.position.x += delta; floor.position.x = rootX; trackedRootX = rootX;
    orbit.update(); model.root.updateMatrixWorld(true); studioRenderer.render(); updateLabel();
  };
  renderOnResize = () => { setView('three-quarter'); render(); };
  const focusPart = (part, direction = [.6,.28,1]) => {
    const anchor = model.anchors[part] || anchors[part]; if (!anchor) throw new Error(`Unknown attachment: ${part}`);
    const region=spec.attachments.find(a=>a.id===part)?.region??part;
    const facing=new THREE.Vector3(...direction).normalize();
    let distance=span*(region.includes('foot')?.26:.72);
    anchor.getWorldPosition(orbit.target);
    if(region==='head'||region==='jaw'){
      // Frame the actual posed head, including ears and the open lower jaw.
      // A fixed offset from its pivot can hide the chin behind view controls.
      const headBox=new THREE.Box3(),point=new THREE.Vector3();
      const isHead=name=>name==='Head'||name==='Jaw'||name.startsWith('Ear_');
      model.root.traverse(o=>{
        if(!o.isMesh)return;
        const positions=o.geometry.attributes.position;
        if(o.isSkinnedMesh){
          const indices=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;
          const include=o.skeleton.bones.map(b=>isHead(b.name));
          for(let i=0;i<positions.count;i++){
            let weight=0;for(let j=0;j<4;j++)if(include[indices.getComponent(i,j)])weight+=weights.getComponent(i,j);
            if(weight>.5)headBox.expandByPoint(o.getVertexPosition(i,point).applyMatrix4(o.matrixWorld));
          }
        }else{
          let parent=o.parent;while(parent&&!parent.isBone)parent=parent.parent;
          if(parent&&isHead(parent.name))for(let i=0;i<positions.count;i++)headBox.expandByPoint(point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld));
        }
      });
      if(!headBox.isEmpty()){
        headBox.getCenter(orbit.target);
        const right=new THREE.Vector3().crossVectors(camera.up,facing).normalize(),up=new THREE.Vector3().crossVectors(facing,right).normalize();
        const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),aspect=stage.clientWidth/Math.max(1,stage.clientHeight);
        distance=0;
        for(const x of [headBox.min.x,headBox.max.x])for(const y of [headBox.min.y,headBox.max.y])for(const z of [headBox.min.z,headBox.max.z]){
          point.set(x,y,z).sub(orbit.target);
          distance=Math.max(distance,Math.abs(point.dot(right))/(tanY*aspect)+point.dot(facing),Math.abs(point.dot(up))/tanY+point.dot(facing));
        }
        distance*=1.4;
      }
    }
    camera.position.copy(orbit.target).addScaledVector(facing,distance);
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
    orbit.update(); render();
  };
  const applySurface = () => {
    for (const [object, material] of originals) object.material = state.clay ? (material.side === THREE.DoubleSide ? clayInterior : clay) : material;
    renderer.toneMapping=state.clay?THREE.ACESFilmicToneMapping:THREE.NeutralToneMapping;
    renderer.toneMappingExposure=state.clay?.9:1;
    studioRenderer.setOcclusion(!state.clay);
    scene.environmentIntensity=state.clay?.9:1.1;
    ambient.intensity=state.clay?.4:.28;
    key.intensity=state.clay?2.5:2.1;
    key.position.set(span*(state.clay?1.4:-.3)+trackedRootX,span*(state.clay?2.3:4),span*(state.clay?1.8:2));
    floor.material.color.set(state.clay?'#dce1d6':'#b5b7b5');
    $('material-view').setAttribute('aria-pressed', String(!state.clay)); $('clay-view').setAttribute('aria-pressed', String(state.clay));
  };
  const setControl = (name, value) => {
    if (!(name in state)) throw new Error(`Unknown control: ${name}`);
    if (name === 'speed' && value > 0) { if (state.pose === 'walk') state.time *= activeSpeed / value; activeSpeed = value; }
    if (name === 'pose' && value !== state.pose) state.time = 0;
    state[name] = value;
    if (name === 'clay') applySurface();
    const input = $(name);
    if (input) { if (input.type === 'checkbox') input.checked = !!value; else input.value = value; }
    if (name === 'speed') $('speed-value').textContent = `${Number(value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}×`;
    if (name === 'jaw') $('jaw-value').textContent = `${Math.round(value * 100)}%`;
    if (name === 'lookX' || name === 'lookY') $(`${name}-value`).textContent = `${Math.round(value * spec.behavior[name === 'lookX' ? 'headYawLimit' : 'headPitchLimit'] * 180 / Math.PI)}°`;
    render();
  };
  for (const name of ['pose', 'speed', 'jaw', 'lookX', 'lookY', 'breathing', 'paused', 'labels', 'part']) {
    $(name).addEventListener('input', (event) => {
      const input = event.target;
      setControl(name, input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value);
    });
  }
  $('material-view').onclick = () => setControl('clay', false); $('clay-view').onclick = () => setControl('clay', true);
  $('reset-view').onclick = () => { setView('three-quarter'); render(); };
  for (const button of document.querySelectorAll('[data-view]')) button.onclick = () => { setView(button.dataset.view); render(); };
  $('paused').checked = reduced;
  for (const name of Object.keys(anchors)) { const option = document.createElement('option'); option.value = name; option.textContent = pretty(name); $('part').appendChild(option); }
  $('part').disabled = $('labels').disabled = Object.keys(anchors).length === 0;
  for (const [name, limit] of [['jaw','jawLimit'],['lookX','headYawLimit'],['lookY','headPitchLimit']]) {
    $(name).disabled = spec.behavior[limit] === 0;
    if ($(name).disabled) $(name).title = 'This movement is disabled by the specimen specification.';
  }
  $('part').addEventListener('change', () => { $('part-description').textContent = state.part ? `${pretty(state.part)} follows its attachment as the creature moves.` : 'Choose a body part to locate it as the creature moves.'; });
  document.title = `${spec.name} · Creature`; $('name').textContent = spec.name;
  $('identity').textContent = `${spec.identity.scientificName} · ${spec.identity.lifeStage}`;
  $('description').textContent = `${spec.identity.breed} · ${spec.identity.sex}. Explore the shape in clay, follow its movement, and inspect individual body parts.`;
  $('category').textContent = { living: 'Living animal study', extinct: 'Extinct reconstruction', fictional: 'Fictional creature' }[spec.category];
  const facts = [['Profile', spec.identity.breed], ['Sex', spec.identity.sex], ['Body condition', spec.identity.bodyCondition], ['Seed', spec.seed]];
  for (const [name, value] of facts) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; $('facts').append(dt, dd); }
  const sourceList = document.createElement('ul');
  for (const source of spec.sources || []) { const li = document.createElement('li'), a = document.createElement('a'); a.textContent = source.title; a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); sourceList.appendChild(li); } $('references').appendChild(sourceList);
  $('interpretation').textContent = (spec.notes || []).join(' ');
  let triangles = 0, vertices = 0, meshes = 0, bones = 0;
  model.root.traverse((object) => { if (object.isMesh) { meshes++; vertices += object.geometry.attributes.position.count; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; } if (object.isBone) bones++; });
  $('model-stat').textContent = `${Math.round(triangles).toLocaleString()} triangles · ${bones} rig joints`;
  const exportGLB = async () => {
    const previous = { ...state }; for (const [object, material] of originals) object.material = material;
    model.reset(); model.root.updateMatrixWorld(true);
    // An array exports the body's mesh at scene root without reparenting the live rig.
    try { return canonicalizeGLB(await new GLTFExporter().parseAsync([...model.root.children], { binary: true, animations: model.clips, onlyVisible: true })); }
    finally { model.update(previous.time, previous); applySurface(); render(previous.time); }
  };
  const exportBase64 = async () => { const bytes = new Uint8Array(await exportGLB()); let out = ''; for (let i = 0; i < bytes.length; i += 32768) out += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(out); };
  $('download-glb').onclick = async () => {
    $('download-glb').disabled = true; $('status').textContent = 'Preparing the animated model…';
    try { download(new Blob([await exportGLB()], { type: 'model/gltf-binary' }), `${spec.id}.glb`); $('status').textContent = 'Animated model saved.'; }
    catch (error) { $('status').textContent = `Export failed: ${error.message}`; }
    finally { $('download-glb').disabled = false; }
  };
  $('download-spec').onclick = () => download(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), `${spec.id}.json`);
  $('download-preview').onclick = () => { render(); renderer.domElement.toBlob((blob) => blob && download(blob, `${spec.id}.png`)); };
  const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debug ? { vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) } : { renderer: gl.getParameter(gl.RENDERER) };
  const metrics = () => ({ triangles: Math.round(triangles), vertices, meshes, bones, drawCalls: renderer.info.render.calls, gpu, load:loadMetrics, viewport: { width: stage.clientWidth, height: stage.clientHeight, dpr: renderer.getPixelRatio() }, model: model.metrics, diagnostics: model.diagnostics, errors: [...errorList], review: { visual: 'pending', anatomy: 'pending', physicalMobile: 'not-tested' } });
  window.creatureStudio = { ready: true, spec, model, scene, renderer, camera, state, setControl, setView, focusPart, step: render, exportBase64, metrics, views: viewNames, getAnchorPositions: () => Object.fromEntries(Object.entries(anchors).map(([name, anchor]) => [name, anchor.getWorldPosition(new THREE.Vector3()).toArray()])) };
  render(0); loadMetrics.readyAfterNavigationMilliseconds=performance.now(); $('loading').hidden = true;
  let last = performance.now();
  const loop = (now) => { const dt = Math.min((now - last) / 1000, .05); last = now; if (!fixed) render(state.time + (state.paused || (state.pose==='walk' && state.speed===0) ? 0 : dt)); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  addEventListener('pagehide', () => { model.dispose(); clay.dispose(); clayInterior.dispose(); studioRenderer.dispose(); renderer.dispose(); environment.dispose(); });
}
main().catch((error) => { console.error(error); $('loading').textContent = error.message; $('loading').classList.add('error'); window.creatureStudioError = error.message; });
