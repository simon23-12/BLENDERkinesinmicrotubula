import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { ANNOTATIONS, PHASES, headStatus } from './content.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ------------------------------------------------------------------ renderer / scene
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const BG = new THREE.Color('#060c18');
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.FogExp2(BG, 0.0026);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.28;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 4000);
camera.position.set(0, 60, 220);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomToCursor = true;
controls.zoomSpeed = 1.1;
controls.minDistance = 5;
controls.maxDistance = 700;
controls.screenSpacePanning = true;

// lights
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x0d1018, 0.42));
const key = new THREE.DirectionalLight(0xfff0da, 2.1);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 420 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.04;
key.shadow.radius = 3;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x6fb6ff, 1.7);
rim.position.set(-60, 50, -120);
scene.add(rim);
const under = new THREE.DirectionalLight(0xf39a2e, 0.35);
under.position.set(40, -80, 60);
scene.add(under);

// drifting "cytoplasm" particles for depth
const particles = (() => {
  const n = 2600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = THREE.MathUtils.randFloatSpread(620);
    pos[i * 3 + 1] = THREE.MathUtils.randFloat(-160, 220);
    pos[i * 3 + 2] = THREE.MathUtils.randFloatSpread(420);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  const m = new THREE.PointsMaterial({ size: 1.3, map: new THREE.CanvasTexture(c), color: 0x86b6e8, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(g, m);
  scene.add(p);
  return p;
})();

// glow for nucleotide events (ATP binding / hydrolysis)
const glow = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,1)');
  gr.addColorStop(0.25, 'rgba(255,170,60,.55)');
  gr.addColorStop(1, 'rgba(255,120,20,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.scale.setScalar(8);
  scene.add(s);
  return s;
})();

// ------------------------------------------------------------------ post-processing
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(pixelRatio);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 2.6, distanceExponent: 1.6, thickness: 1.6, scale: 1.0, samples: 16 });
gtao.blendIntensity = 0.85;
composer.addPass(gtao);
const outline = new OutlinePass(new THREE.Vector2(innerWidth, innerHeight), scene, camera);
Object.assign(outline, { edgeStrength: 4.5, edgeGlow: 0.7, edgeThickness: 1.4, pulsePeriod: 0 });
outline.visibleEdgeColor.set('#ffb35c');
outline.hiddenEdgeColor.set('#5a2e08');
composer.addPass(outline);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.5, 0.97);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ state
const state = {
  t: 0, duration: 24, playing: true, speed: 1, follow: true, labels: true,
  fps: 30, framesPerStep: 72, steps: 10, phases: [],
  selected: null, trackFn: null, lastTrack: new THREE.Vector3(), hasTrack: false,
  flight: null, zoomGoal: null, startRootX: 0,
};
const nodes = {};
const pickables = [];
let mixer = null;
let root = null;

// ------------------------------------------------------------------ load
const loader = new GLTFLoader();
const timelineP = fetch('models/timeline.json').then((r) => r.json());
loader.load(
  'models/kinesin.glb',
  async (gltf) => {
    const tl = await timelineP;
    Object.assign(state, { fps: tl.fps, framesPerStep: tl.framesPerStep, steps: tl.steps, phases: tl.phases });
    setup(gltf);
    $('loadBar').style.width = '100%';
    $('loader').classList.add('done');
  },
  (e) => {
    if (e.total) {
      const p = Math.round((e.loaded / e.total) * 100);
      $('loadBar').style.width = p + '%';
      $('loadPct').textContent = p + ' %';
    }
  },
  (err) => { $('loadPct').textContent = 'Fehler beim Laden: ' + err.message; },
);

function setup(gltf) {
  root = gltf.scene;
  scene.add(root);
  root.traverse((o) => { if (o.name) nodes[o.name] = o; });

  const seenGeo = new Set();
  const vesicleMat = new THREE.MeshPhysicalMaterial({
    color: '#8fdcbc', roughness: 0.18, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.2, iridescence: 0.9, iridescenceIOR: 1.35, sheen: 0.6, sheenColor: new THREE.Color('#d8fff0'),
    side: THREE.DoubleSide,
  });
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (!seenGeo.has(o.geometry)) {
      seenGeo.add(o.geometry);
      o.geometry.computeBoundingBox();
      o.geometry.computeBoundsTree();
    }
    const m = o.material;
    if (m.name === 'Vesicle_Membrane') {
      o.material = vesicleMat;
      o.castShadow = false;
      o.renderOrder = 10;
    } else if (m.name.startsWith('Tubulin')) {
      Object.assign(m, { roughness: 0.6, sheen: 0.18, sheenRoughness: 0.6 });
      m.sheenColor = new THREE.Color(m.name.endsWith('Alpha') ? '#e8fbff' : '#9fd0ff');
    } else if (m.name === 'Kinesin_Head') {
      Object.assign(m, { roughness: 0.45, sheen: 0.2, sheenRoughness: 0.45, clearcoat: 0.3 });
      m.sheenColor = new THREE.Color('#ffd7a0');
    } else if (m.name === 'Neck_Linker') {
      m.emissive = new THREE.Color('#ffc21a');
      m.emissiveIntensity = 0.35;
    } else if (m.name === 'Kinesin_Hinge') {
      m.color.set('#f2c98a');
      m.emissive?.set('#000000');
    } else if (m.name === 'Atom_P') {
      m.emissive = new THREE.Color('#ff8a00');
      m.emissiveIntensity = 0.35;
    }
    pickables.push(o);
  });

  mixer = new THREE.AnimationMixer(root);
  let dur = 0;
  for (const clip of gltf.animations) {
    mixer.clipAction(clip).play();
    dur = Math.max(dur, clip.duration);
  }
  state.duration = dur || 24;
  mixer.setTime(0);
  root.updateMatrixWorld(true);
  state.startRootX = nodes.Kinesin_Root.getWorldPosition(new THREE.Vector3()).x;

  buildUI();

  // intro camera: fly in from far away
  const r = nodes.Kinesin_Root.getWorldPosition(new THREE.Vector3());
  computeHome();
  const tgt = r.clone().add(state.homeTargetOffset);
  controls.target.copy(tgt);
  camera.position.copy(tgt).addScaledVector(state.homeOffset, 2.4);
  setTrack(rootTrack);
  state.zoomGoal = state.homeOffset.length();
}

// default framing, adapted to the viewport shape (portrait phones need more distance)
function computeHome() {
  const aspect = innerWidth / innerHeight;
  const dist = aspect >= 1.2 ? 166 : aspect >= 0.8 ? 200 : 290;
  state.homeOffset = new THREE.Vector3(66, 20, 150).setLength(dist);
  state.homeTargetOffset = aspect >= 0.8 ? new THREE.Vector3(-18, 27, 0) : new THREE.Vector3(-22, 34, 0);
}

const _v = new THREE.Vector3();
const rootTrack = (out) => nodes.Kinesin_Root.getWorldPosition(out);

function setTrack(fn) {
  state.trackFn = fn;
  state.hasTrack = false;
}

// ------------------------------------------------------------------ annotation helpers
function annotationForName(name) {
  for (const a of ANNOTATIONS) {
    for (const p of a.meshes) {
      if (p.endsWith('_') ? name.startsWith(p) : name === p) return a;
    }
  }
  return null;
}
function annotationForObject(o) {
  while (o) {
    const a = o.name && annotationForName(o.name);
    if (a) return a;
    o = o.parent;
  }
  return null;
}
function stepU() {
  const f = (state.t / state.duration) * state.steps * state.framesPerStep;
  const s = Math.min(Math.floor(f / state.framesPerStep), state.steps - 1);
  return { s, u: (f - s * state.framesPerStep) / state.framesPerStep, f };
}
function activeNucleotide() {
  const { s } = stepU();
  return nodes['ADP_' + String(s).padStart(2, '0')];
}
function resolveNode(name) {
  return name === '@activeNucleotide' ? activeNucleotide() : nodes[name];
}
const _off = new THREE.Vector3();
function anchorWorld(spec, out) {
  const node = resolveNode(spec.node);
  if (!node) return null;
  _off.fromArray(spec.offset || [0, 0, 0]);
  if (spec.node.startsWith('@')) {
    node.getWorldPosition(out);
    return out.add(_off);
  }
  if (spec.bbox && node.geometry) node.geometry.boundingBox.getCenter(out).add(_off);
  else out.copy(_off);
  return out.applyMatrix4(node.matrixWorld);
}
function nodeVisible(spec) {
  const node = resolveNode(spec.node);
  if (!node) return false;
  node.getWorldScale(_v);
  return _v.x > 0.35;
}
function meshesFor(a) {
  if (a.id === 'microtubule') return [nodes.Microtubule_Alpha, nodes.Microtubule_Beta].filter(Boolean);
  const out = [];
  for (const name in nodes) {
    const o = nodes[name];
    if (o.parent && annotationForName(o.parent.name) === a) continue;
    if (annotationForName(name) === a) out.push(o);
  }
  return out;
}

// ------------------------------------------------------------------ UI
const hotspots = [];
function buildUI() {
  const list = $('partList');
  const groups = [['heads', 'atp', 'necklinker', 'neckcoil', 'stalk', 'hinge', 'tail', 'klc', 'adaptor', 'cargo'], ['microtubule', 'alpha', 'beta', 'plusend', 'minusend', 'seam']];
  let n = 0;
  groups.forEach((g, gi) => {
    if (gi > 0) list.appendChild(Object.assign(document.createElement('li'), { className: 'sep' }));
    for (const id of g) {
      const a = ANNOTATIONS.find((x) => x.id === id);
      a.no = ++n;
      const li = document.createElement('li');
      li.innerHTML = `<button data-id="${a.id}"><span class="n">${String(a.no).padStart(2, '0')}</span><span class="dot" style="background:${a.color}"></span><span>${a.title}</span></button>`;
      li.firstChild.addEventListener('click', () => select(a.id, true));
      list.appendChild(li);
    }
  });
  $('partCount').textContent = `· ${n}`;
  $('indexToggle').addEventListener('click', () => {
    const c = $('index').classList.toggle('collapsed');
    $('indexToggle').setAttribute('aria-expanded', String(!c));
  });
  if (innerWidth < 1100 || innerHeight < 760) $('index').classList.add('collapsed');

  const host = $('hotspots');
  for (const a of ANNOTATIONS) {
    a.markers.forEach((m, i) => {
      const el = document.createElement('button');
      el.className = 'hs';
      el.style.setProperty('--c', a.color);
      el.setAttribute('aria-label', a.title);
      el.innerHTML = `<span class="ring">${a.no}</span><span class="lbl">${m.label || a.title}</span>`;
      el.addEventListener('click', (ev) => { ev.stopPropagation(); select(a.id); });
      host.appendChild(el);
      hotspots.push({ a, m, el, occluded: false, pos: new THREE.Vector3() });
    });
  }

  // timeline ticks
  const ticks = $('ticks');
  for (let s = 0; s <= state.steps; s++) {
    const x = (s / state.steps) * 100;
    ticks.insertAdjacentHTML('beforeend', `<i style="left:${x}%"></i>${s < state.steps ? `<span style="left:${x + 50 / state.steps}%">${s + 1}</span>` : ''}`);
  }
  // phase track
  const track = $('phaseTrack');
  track.innerHTML = state.phases.map((p) => `<i style="--w:${(p.to - p.from).toFixed(3)}"><b></b></i>`).join('');

  $('play').addEventListener('click', togglePlay);
  $('speed').addEventListener('change', (e) => { state.speed = parseFloat(e.target.value); });
  const scrub = $('scrub');
  scrub.addEventListener('input', () => { state.t = (scrub.value / 10000) * state.duration; });
  $('follow').addEventListener('click', () => {
    state.follow = !state.follow;
    $('follow').classList.toggle('on', state.follow);
    $('follow').setAttribute('aria-pressed', String(state.follow));
    if (state.follow) setTrack(state.selected && isMoving(state.selected) ? focusTrack(state.selected) : rootTrack);
  });
  $('labels').addEventListener('click', () => {
    state.labels = !state.labels;
    $('labels').classList.toggle('on', state.labels);
    $('labels').setAttribute('aria-pressed', String(state.labels));
    $('hotspots').classList.toggle('hide-labels', !state.labels);
  });
  $('reset').addEventListener('click', resetView);
  $('infoClose').addEventListener('click', () => select(null));
  $('infoFocus').addEventListener('click', () => state.selected && focusOn(state.selected));
  const order = [...ANNOTATIONS].sort((x, y) => x.no - y.no);
  const cycle = (d) => {
    const i = state.selected ? order.indexOf(state.selected) : -1;
    select(order[(i + d + order.length) % order.length].id, true);
  };
  $('infoPrev').addEventListener('click', () => cycle(-1));
  $('infoNext').addEventListener('click', () => cycle(1));

  // zoom
  const slider = $('zoomSlider');
  slider.addEventListener('input', () => { state.zoomGoal = sliderToDist(+slider.value); state.sliderActive = true; });
  slider.addEventListener('change', () => { state.sliderActive = false; });
  $('zoomIn').addEventListener('click', () => { state.zoomGoal = clamp(currentDist() / 1.7, controls.minDistance, controls.maxDistance); });
  $('zoomOut').addEventListener('click', () => { state.zoomGoal = clamp(currentDist() * 1.7, controls.minDistance, controls.maxDistance); });

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.key === 'Escape') select(null);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const stepDur = state.duration / state.steps;
      const cur = Math.floor(state.t / stepDur + 1e-4);
      const next = e.key === 'ArrowRight' ? cur + 1 : (state.t - cur * stepDur < 0.3 ? cur - 1 : cur);
      state.t = ((next % state.steps) + state.steps) % state.steps * stepDur;
    }
    if (e.key === '+' || e.key === '=') $('zoomIn').click();
    if (e.key === '-') $('zoomOut').click();
  });
}

function togglePlay() {
  state.playing = !state.playing;
  $('play').classList.toggle('paused', !state.playing);
  $('play').setAttribute('aria-label', state.playing ? 'Pause' : 'Abspielen');
}

const isMoving = (a) => {
  const n = a.focus.node;
  return n.startsWith('@') || !n.startsWith('ANCHOR_');
};
const focusTrack = (a) => (out) => anchorWorld({ node: a.focus.node, offset: a.focus.offset || [0, 0, 0] }, out);

function select(id, fly = false) {
  const a = id ? ANNOTATIONS.find((x) => x.id === id) : null;
  state.selected = a;
  document.querySelectorAll('#partList button').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  hotspots.forEach((h) => h.el.classList.toggle('active', h.a === a));
  outline.selectedObjects = a ? meshesFor(a) : [];
  const info = $('info');
  if (!a) {
    info.classList.remove('open');
    info.setAttribute('aria-hidden', 'true');
    if (state.follow) setTrack(rootTrack);
    return;
  }
  info.style.setProperty('--c', a.color);
  $('infoKicker').textContent = a.kicker;
  $('infoTitle').textContent = a.title;
  $('infoText').textContent = a.text;
  $('infoFacts').innerHTML = a.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('infoLive').hidden = !a.live;
  info.classList.add('open');
  info.setAttribute('aria-hidden', 'false');
  info.scrollTop = 0;
  if (fly) focusOn(a);
}

function currentDist() { return camera.position.distanceTo(controls.target); }
const LOG_MIN = Math.log(5), LOG_MAX = Math.log(700);
const sliderToDist = (v) => Math.exp(LOG_MAX - (v / 1000) * (LOG_MAX - LOG_MIN));
const distToSlider = (d) => ((LOG_MAX - Math.log(d)) / (LOG_MAX - LOG_MIN)) * 1000;

function focusOn(a) {
  const spec = { node: a.focus.node, offset: a.focus.offset || [0, 0, 0] };
  state.flight = {
    fromTarget: controls.target.clone(),
    fromDist: currentDist(),
    toDist: a.focus.distance,
    spec, t: 0, dur: 1.6,
  };
  state.zoomGoal = null;
  if (state.follow) setTrack(isMoving(a) ? focusTrack(a) : rootTrack);
}

function resetView() {
  select(null);
  const r = nodes.Kinesin_Root.getWorldPosition(new THREE.Vector3());
  computeHome();
  state.flight = null;
  state.zoomGoal = null;
  const fromT = controls.target.clone(), fromP = camera.position.clone();
  const toT = r.clone().add(state.homeTargetOffset);
  const toP = toT.clone().add(state.homeOffset);
  state.flight = { reset: true, fromT, fromP, toT, toP, t: 0, dur: 1.4 };
  if (!state.follow) { state.follow = true; $('follow').classList.add('on'); }
  setTrack(rootTrack);
}

// ------------------------------------------------------------------ picking / hover
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.firstHitOnly = true;
  const hits = raycaster.intersectObjects(pickables, false);
  for (const h of hits) {
    const a = annotationForObject(h.object);
    if (a) return a;
  }
  return null;
}
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || !root) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 5 && performance.now() - down.t < 500) {
    const a = pick(e.clientX, e.clientY);
    select(a ? a.id : null);
  }
  down = null;
});
let hoverReq = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !root || e.buttons) { $('hoverTip').classList.remove('on'); return; }
  if (hoverReq) return;
  hoverReq = requestAnimationFrame(() => {
    hoverReq = null;
    const a = pick(e.clientX, e.clientY);
    const tip = $('hoverTip');
    canvas.style.cursor = a ? 'pointer' : 'grab';
    if (a) {
      tip.textContent = a.title;
      tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`;
      tip.classList.add('on');
    } else tip.classList.remove('on');
  });
});
canvas.addEventListener('pointerleave', () => $('hoverTip').classList.remove('on'));

// ------------------------------------------------------------------ per-frame UI updates
let lastPhaseKey = '';
function updatePhaseUI() {
  const { s, u } = stepU();
  const ph = state.phases.find((p) => u >= p.from && u < p.to) || state.phases[state.phases.length - 1];
  const key = s + ph.key;
  if (key !== lastPhaseKey) {
    lastPhaseKey = key;
    const c = PHASES[ph.key];
    const h3 = $('phaseTitle');
    h3.textContent = c.title;
    h3.classList.remove('swap'); void h3.offsetWidth; h3.classList.add('swap');
    $('phaseText').textContent = c.text;
    $('phaseNo').textContent = String(state.phases.indexOf(ph) + 1).padStart(2, '0') + ' / ' + String(state.phases.length).padStart(2, '0');
    $('phaseStep').textContent = `Schritt ${s + 1} von ${state.steps}`;
  }
  const bars = $('phaseTrack').children;
  state.phases.forEach((p, i) => {
    const v = u >= p.to ? 100 : u <= p.from ? 0 : ((u - p.from) / (p.to - p.from)) * 100;
    bars[i].style.setProperty('--p', v.toFixed(1) + '%');
  });

  // readouts
  const r = nodes.Kinesin_Root.getWorldPosition(_v);
  $('rStep').textContent = `${s + 1} / ${state.steps}`;
  $('rDist').textContent = `${(r.x - state.startRootX).toFixed(1).replace('.', ',')} nm`;
  $('rAtp').textContent = String(s + (u >= 0.76 ? 1 : 0));
  const realStep = 0.01; // s (≈100 Schritte/s)
  $('rSlow').textContent = '×' + Math.round((state.duration / state.steps / state.speed) / realStep).toLocaleString('de-DE');

  // live status in info panel
  if (state.selected && state.selected.live) {
    const frontIsA = s % 2 === 0;
    let html = '';
    if (state.selected.live === 'heads') {
      html = `<b>Kopf A</b> · ${headStatus(frontIsA, u)}<br><b>Kopf B</b> · ${headStatus(!frontIsA, u)}`;
    } else {
      const st = u < 0.2 ? 'ATP nähert sich dem vorderen Kopf' : u < 0.72 ? 'ATP gebunden (vorderer Kopf)' : u < 0.8 ? 'Hydrolyse: ATP → ADP + Pᵢ' : u < 0.86 ? 'Pᵢ verlässt den Kopf' : 'ADP bleibt gebunden bis zum nächsten Andocken';
      html = `<b>Jetzt</b> · ${st}<br><b>Bilanz</b> · ${s + (u >= 0.76 ? 1 : 0)} ATP für ${(r.x - state.startRootX).toFixed(0)} nm`;
    }
    $('infoLive').innerHTML = html;
  }
  // nucleotide glow
  const n = activeNucleotide();
  if (n) {
    n.getWorldPosition(glow.position);
    const pulse = Math.max(Math.exp(-Math.pow((u - 0.2) / 0.035, 2)), Math.exp(-Math.pow((u - 0.76) / 0.03, 2)) * 1.2);
    glow.material.opacity = 0.9 * pulse;
    glow.scale.setScalar(6 + 5 * pulse);
  }
}

const _p = new THREE.Vector3();
let occlusionClock = 0;
function updateHotspots(dt) {
  occlusionClock += dt;
  const doOcc = occlusionClock > 0.15;
  if (doOcc) occlusionClock = 0;
  const w = innerWidth, h = innerHeight;
  const placed = [];
  for (const hs of hotspots) hs.visible = false;
  for (const hs of hotspots) {
    if (!anchorWorld(hs.m, hs.pos) || !nodeVisible(hs.m)) { hs.el.classList.add('gone'); continue; }
    _p.copy(hs.pos).project(camera);
    if (_p.z > 1 || Math.abs(_p.x) > 1.2 || Math.abs(_p.y) > 1.2) { hs.el.classList.add('gone'); continue; }
    hs.el.classList.remove('gone');
    hs.sx = ((_p.x + 1) / 2) * w;
    hs.sy = ((1 - _p.y) / 2) * h;
    hs.depth = _p.z;
    hs.visible = true;
    hs.el.style.transform = `translate(${hs.sx}px, ${hs.sy}px)`;
    if (doOcc) {
      const dir = _v.copy(hs.pos).sub(camera.position);
      const dist = dir.length();
      raycaster.set(camera.position, dir.normalize());
      raycaster.far = dist - 0.8;
      raycaster.firstHitOnly = false;
      const hits = raycaster.intersectObjects(pickables, false);
      raycaster.far = Infinity;
      hs.occluded = hits.some((x) => x.object.name !== 'Vesicle' && annotationForObject(x.object) !== hs.a);
      hs.el.classList.toggle('occluded', hs.occluded);
    }
  }
}

// hide labels (not the numbered rings) that would overlap a closer / selected one
function declutter() {
  const vis = hotspots.filter((x) => x.visible).sort((p, q) => (q.a === state.selected) - (p.a === state.selected) || (p.occluded - q.occluded) || p.depth - q.depth);
  const boxes = vis.map((x) => [x.sx - 14, x.sy - 14, x.sx + 14, x.sy + 14]);
  const labels = [];
  for (const x of vis) {
    if (!x.lw) x.lw = x.el.querySelector('.lbl').offsetWidth || 90;
    const b = [x.sx + 12, x.sy - 13, x.sx + 20 + x.lw, x.sy + 13];
    const clash = labels.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) || boxes.some((o, i) => vis[i] !== x && b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    x.el.classList.toggle('nolabel', clash);
    if (!clash) labels.push(b);
  }
}

function updateScale() {
  const d = currentDist();
  const nmPerPx = (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / innerHeight;
  const nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  let L = nice[0];
  for (const n of nice) if (n / nmPerPx <= 140) L = n;
  $('scaleBar').style.width = (L / nmPerPx).toFixed(1) + 'px';
  $('scaleLabel').textContent = `${String(L).replace('.', ',')} nm`;
  const mag = (1 / nmPerPx) * 0.2646e-3 / 1e-9;
  $('rMag').textContent = '×' + (mag >= 1e6 ? (mag / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.' : Math.round(mag).toLocaleString('de-DE'));
  if (!state.sliderActive) $('zoomSlider').value = distToSlider(d);
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let fpsAcc = 0, fpsFrames = 0, degraded = false;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!root) { renderer.render(scene, camera); return; }

  if (state.playing) state.t = (state.t + dt * state.speed) % state.duration;
  mixer.setTime(state.t);
  root.updateMatrixWorld(true);

  // dip to black on wrap when the camera isn't following
  const edge = Math.min(state.t, state.duration - state.t);
  $('dip').style.opacity = state.follow ? 0 : (1 - smooth(edge / 0.35)) * 0.85;

  // follow the tracked point
  if (state.trackFn) {
    const p = state.trackFn(new THREE.Vector3());
    if (state.hasTrack && state.follow) {
      const delta = p.clone().sub(state.lastTrack);
      camera.position.add(delta);
      controls.target.add(delta);
    }
    state.lastTrack.copy(p);
    state.hasTrack = true;
  }

  // camera flights
  const f = state.flight;
  if (f) {
    f.t += dt / f.dur;
    const k = easeInOut(clamp(f.t, 0, 1));
    if (f.reset) {
      controls.target.lerpVectors(f.fromT, f.toT, k);
      camera.position.lerpVectors(f.fromP, f.toP, k);
    } else {
      const live = anchorWorld(f.spec, new THREE.Vector3());
      const dir = camera.position.clone().sub(controls.target).normalize();
      controls.target.lerpVectors(f.fromTarget, live, k);
      const d = Math.exp(Math.log(f.fromDist) + (Math.log(f.toDist) - Math.log(f.fromDist)) * k);
      camera.position.copy(controls.target).addScaledVector(dir, d);
    }
    if (f.t >= 1) state.flight = null;
  } else if (state.zoomGoal) {
    const d = currentDist();
    const nd = Math.exp(Math.log(d) + (Math.log(state.zoomGoal) - Math.log(d)) * (1 - Math.exp(-dt * 6)));
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, nd);
    if (Math.abs(nd - state.zoomGoal) / state.zoomGoal < 0.002) state.zoomGoal = null;
  }
  controls.update();

  // key light follows the motor so shadows stay crisp
  const r = nodes.Kinesin_Root.getWorldPosition(_p);
  key.target.position.copy(r);
  key.position.copy(r).add(new THREE.Vector3(45, 110, 60));
  particles.rotation.y += dt * 0.004;
  particles.position.y = Math.sin(clock.elapsedTime * 0.15) * 2;

  updatePhaseUI();
  updateHotspots(dt);
  declutter();
  updateScale();
  const sc = $('scrub');
  if (document.activeElement !== sc) sc.value = (state.t / state.duration) * 10000;
  sc.style.setProperty('--p', ((state.t / state.duration) * 100).toFixed(2) + '%');

  composer.render(dt);

  // adaptive quality
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 3) {
    const fps = fpsFrames / fpsAcc;
    fpsAcc = 0; fpsFrames = 0;
    if (!degraded && fps < 28) {
      degraded = true;
      gtao.enabled = false;
      pixelRatio = Math.min(pixelRatio, 1.25);
      renderer.setPixelRatio(pixelRatio);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(innerWidth, innerHeight);
    }
  }
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
});

// debugging handle
window.__kinesin = { state, gtao, composer, renderer, outline, bloom, camera, controls, nodes };
