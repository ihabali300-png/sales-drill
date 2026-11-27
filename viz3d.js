// 🧊 المعمل 3D — مشاهد تفاعلية ناعمة للدروس (Three.js)
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const MM = 1 / 120;                 // 1 مم بوحدات المشهد (الراس ≈ 24 سم)
const D2R = Math.PI / 180;
const LIME = 0xa3e635;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const fx = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const ltr = s => '<bdi dir="ltr">' + s + '</bdi>';

// ───── الأساس: رندر عند الحاجة + حركة ناعمة ─────
function base(host, {cam = [0, .3, 4], target = [0, 0, 0], min = 1.2, max = 9} = {}) {
  const wrap = document.createElement('div'); wrap.className = 'v3c';
  const hint = document.createElement('div'); hint.className = 'v3h'; hint.textContent = '👆 لفّ بصباعك • اقرص للتقريب';
  wrap.appendChild(hint); host.appendChild(wrap);
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  wrap.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
  camera.position.set(...cam);
  const ctl = new OrbitControls(camera, renderer.domElement);
  ctl.target.set(...target); ctl.enableDamping = true; ctl.dampingFactor = .09; ctl.enablePan = false;
  ctl.minDistance = min; ctl.maxDistance = max; ctl.rotateSpeed = .8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223322, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(2.5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(LIME, .55); rim.position.set(-3, 1, -3); scene.add(rim);

  let raf = 0, until = 0; const tweens = []; const frames = [];
  const tick = () => {
    raf = 0; const now = performance.now();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], k = Math.min(1, (now - tw.t0) / tw.ms), e = ease(k);
      for (const p in tw.to) tw.obj[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * e;
      if (k >= 1) tweens.splice(i, 1);
    }
    const moving = ctl.update();
    frames.forEach(f => f(now));
    renderer.render(scene, camera);
    if (moving || tweens.length || now < until) raf = requestAnimationFrame(tick);
  };
  const kick = (ms = 400) => { until = Math.max(until, performance.now() + ms); if (!raf) raf = requestAnimationFrame(tick); };
  const tween = (obj, to, ms = 650) => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj) tweens.splice(i, 1);
    const from = {}; for (const p in to) from[p] = obj[p];
    tweens.push({obj, from, to, ms, t0: performance.now()}); kick(ms + 50);
  };
  ctl.addEventListener('change', () => kick(250));
  ctl.addEventListener('start', () => { hint.style.opacity = 0; kick(1200); });
  const resize = () => { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); kick(50); };
  const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
  const camTo = (pos, tgt) => {
    const st = {x: camera.position.x, y: camera.position.y, z: camera.position.z, tx: ctl.target.x, ty: ctl.target.y, tz: ctl.target.z};
    const o = Object.assign({}, st);
    tween(o, {x: pos[0], y: pos[1], z: pos[2], tx: (tgt || target)[0], ty: (tgt || target)[1], tz: (tgt || target)[2]}, 900);
    frames.push(function f() { camera.position.set(o.x, o.y, o.z); ctl.target.set(o.tx, o.ty, o.tz); if (!tweens.some(t => t.obj === o)) frames.splice(frames.indexOf(f), 1); });
  };
  const dispose = () => {
    cancelAnimationFrame(raf); ro.disconnect(); ctl.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
    host.innerHTML = '';
  };
  return {scene, camera, ctl, renderer, kick, tween, frames, camTo, dispose, wrap};
}

// ───── أدوات الواجهة ─────
function panel(host) { const u = document.createElement('div'); u.className = 'v3u'; host.appendChild(u); return u; }
function chips(u, label, opts, cur, pick) {
  const row = document.createElement('div'); row.className = 'v3row';
  row.innerHTML = '<span class="v3l">' + label + '</span><div class="v3chips"></div>';
  const box = row.querySelector('.v3chips');
  opts.forEach(([v, t]) => { const b = document.createElement('button'); b.className = 'v3chip' + (v === cur ? ' on' : ''); b.innerHTML = t; b.onclick = () => { box.querySelectorAll('.v3chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); pick(v); }; box.appendChild(b); });
  u.appendChild(row); return row;
}
function stepper(u, label, val, step, min, max, fmt, set) {
  const row = document.createElement('div'); row.className = 'v3row';
  row.innerHTML = '<span class="v3l">' + label + '</span><div class="v3st"><button>−</button><b></b><button>+</button></div>';
  const [mi, pl] = row.querySelectorAll('button'), b = row.querySelector('b');
  let v = val; const show = () => b.innerHTML = fmt(v); show();
  const go = d => { v = Math.round(Math.min(max, Math.max(min, v + d)) * 100) / 100; show(); set(v); };
  mi.onclick = () => go(-step); pl.onclick = () => go(step);
  u.appendChild(row);
  return {set: x => { v = x; show(); }};
}
function readout(u) { const r = document.createElement('div'); r.className = 'v3r'; u.appendChild(r); return r; }

// ───── أشكال مساعدة ─────
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function rod(mat, r = .01) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat);
  m.userData.set = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); m.position.copy(a).addScaledVector(d, .5); m.scale.set(1, Math.max(L, 1e-4), 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
  return m;
}
function label(text, color = '#e8f5e0', size = 48) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold ' + size + 'px system-ui,Tahoma';
  const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = size + 20;
  g.font = 'bold ' + size + 'px system-ui,Tahoma'; g.fillStyle = 'rgba(11,19,13,.72)'; if (g.roundRect) { g.beginPath(); g.roundRect(0, 0, w, size + 20, 14); g.fill(); } else g.fillRect(0, 0, w, size + 20);
  g.fillStyle = color; g.textBaseline = 'middle'; g.direction = 'rtl'; g.textAlign = 'center'; g.fillText(text, w / 2, (size + 20) / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthTest: false, transparent: true}));
  sp.scale.set(w / 400, (size + 20) / 400, 1); sp.renderOrder = 10; return sp;
}
const skinMat = () => new THREE.MeshStandardMaterial({color: 0xd6a27c, roughness: .62});
const lensMat = () => new THREE.MeshPhysicalMaterial({color: 0xcff3ff, transparent: true, opacity: .28, roughness: .05, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false});

// ═════════ 1) وضع النظارة على الوش ═════════
function scenePOW(host, o = {}) {
  const B = base(host, {cam: [2.0, .5, 2.7], target: [0, .05, .6], min: .9, max: 7});
  const {scene} = B;
  const head = new THREE.Group(); scene.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skinMat()); skull.scale.set(.78, 1, .9); head.add(skull);
  const EY = .12, EX = 31.5 * MM, EZ = .765;   // PD 63
  const eyes = [];
  [-1, 1].forEach(s => {
    const g = new THREE.Group(); g.position.set(s * EX, EY, EZ); head.add(g);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.105, 32, 24), new THREE.MeshStandardMaterial({color: 0xf6f3ee, roughness: .3})));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(.05, 32), new THREE.MeshStandardMaterial({color: 0x5b3a1e})); iris.position.z = .104; g.add(iris);
    const pup = new THREE.Mesh(new THREE.CircleGeometry(.022, 24), new THREE.MeshBasicMaterial({color: 0x0a0a0a})); pup.position.z = .1045; g.add(pup);
    eyes.push(g);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.075, .26, 32), skinMat()); nose.rotation.x = Math.PI / 2 + .35; nose.position.set(0, -.04, .92); head.add(nose);
  [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.TorusGeometry(.1, .035, 12, 24, Math.PI * 1.3), skinMat()); ear.position.set(s * .78, .04, -.02); ear.rotation.y = s * Math.PI / 2; ear.rotation.z = -.6; head.add(ear); });
  // 🧑 راس واقعي (Higgsfield 3D) — بيتحمّل وبيحل محل الراس البسيط
  const ear = {x: .76, y: .14, z: -.05};
  new GLTFLoader().load(new URL('./assets/head.glb', import.meta.url).href, gl => {
    const m = gl.scene; m.scale.setScalar(2.15); m.rotation.y = -Math.PI / 2; m.position.set(0, -.065, .299);
    m.traverse(o => { if (o.isMesh && o.material) { o.material.roughness = .72; o.material.metalness = 0; } });
    head.visible = false; scene.add(m); Object.assign(ear, {x: .61, y: .11, z: .1}); B.kick(400);
  }, undefined, () => {});

  // الإطار
  const P = {panto: o.panto ?? 8, wrap: o.wrap ?? 5, vertex: o.vertex ?? 12, F: o.F ?? -4, low: o.low ?? false};
  const A = 50 * MM, Bh = 36 * MM, DBL = 18 * MM;
  const frameMat = new THREE.MeshStandardMaterial({color: 0x2b2420, roughness: .35, metalness: .25});
  const front = new THREE.Group(); scene.add(front);
  const lenses = [];
  [-1, 1].forEach(s => {
    const pivot = new THREE.Group(); pivot.position.x = s * DBL / 2; front.add(pivot);
    const lg = new THREE.Group(); lg.position.x = s * A / 2; pivot.add(lg);
    const outer = roundRect(A + 4 * MM, Bh + 4 * MM, 10 * MM); outer.holes.push(roundRect(A, Bh, 8 * MM));
    const rimG = new THREE.ExtrudeGeometry(outer, {depth: 3 * MM, bevelEnabled: true, bevelThickness: .6 * MM, bevelSize: .6 * MM, bevelSegments: 3, curveSegments: 24});
    rimG.translate(0, 0, -1.5 * MM); lg.add(new THREE.Mesh(rimG, frameMat));
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(A, Bh, 8 * MM), 24), lensMat()); lg.add(lens);
    const oc = new THREE.Group(); const cm = new THREE.MeshBasicMaterial({color: 0xffd166, depthTest: false});
    const c1 = new THREE.Mesh(new THREE.PlaneGeometry(.05, .006), cm), c2 = new THREE.Mesh(new THREE.PlaneGeometry(.006, .05), cm); c1.renderOrder = c2.renderOrder = 5; oc.add(c1, c2); oc.position.z = .004; lg.add(oc);
    lenses.push({pivot, lg, oc, s});
  });
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(DBL / 2, 1.6 * MM, 10, 24, Math.PI), frameMat); bridge.position.y = Bh / 2 - 6 * MM; front.add(bridge);
  const temples = [-1, 1].map(s => { const r = rod(frameMat, 1.8 * MM); scene.add(r); return r; });
  const gaze = [-1, 1].map(() => { const r = rod(new THREE.MeshBasicMaterial({color: LIME, transparent: true, opacity: .85}), .0045); scene.add(r); return r; });
  const hits = [-1, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(.011, 16, 12), new THREE.MeshBasicMaterial({color: LIME, depthTest: false})); m.renderOrder = 6; scene.add(m); return m; });

  const state = Object.assign({}, P);
  const layout = () => {
    front.position.set(0, EY, EZ + .105 + state.vertex * MM);
    front.rotation.set(state.panto * D2R, 0, 0);
    lenses.forEach(L => { L.pivot.rotation.y = L.s * state.wrap * D2R; L.oc.position.y = state.low ? -(state.panto / 2) * MM : 0; L.oc.position.x = -L.s * (A / 2 + DBL / 2 - EX); });
    front.updateMatrixWorld(true);
    lenses.forEach((L, i) => {
      const hinge = new THREE.Vector3(L.s * (A / 2 + 2 * MM), Bh / 2 - 4 * MM, -1 * MM); L.lg.localToWorld(hinge);
      temples[i].userData.set(hinge, new THREE.Vector3(L.s * ear.x, ear.y, ear.z));
      const eyeP = new THREE.Vector3(L.s * EX, EY, EZ + .105);
      const n = new THREE.Vector3(0, 0, 1).transformDirection(L.lg.matrixWorld), p0 = new THREE.Vector3().setFromMatrixPosition(L.lg.matrixWorld);
      const dir = new THREE.Vector3(0, 0, 1), t = n.dot(p0.clone().sub(eyeP)) / n.dot(dir);
      const hit = eyeP.clone().addScaledVector(dir, t); hits[i].position.copy(hit);
      gaze[i].userData.set(eyeP, eyeP.clone().addScaledVector(dir, t + .45));
    });
  };
  layout(); B.frames.push(layout);

  const u = panel(host), rd = readout(u);
  const n = 1.5;
  const calc = () => {
    const F = P.F, tp = (P.low ? 0 : P.panto) * D2R, tw = P.wrap * D2R;
    const fs = th => F * (1 + Math.sin(th) ** 2 / (2 * n)), fc = th => fs(th) * Math.tan(th) ** 2;
    const d = (P.vertex - 12) / 1000, fe = F / (1 - d * F);
    rd.innerHTML =
      '<div>↘️ البانتو ' + ltr(P.panto + '°') + (P.low ? ' — المركز نازل ' + ltr((P.panto / 2).toFixed(1) + ' mm') + ' ✅ فالنظر داخل في المركز والخطأ تقريباً صفر' : ' ← CYL مستحث ≈ ' + ltr(fx(fc(tp))) + ' والكروي يبقى ≈ ' + ltr(fx(fs(tp)))) + '</div>' +
      '<div>↪️ الوارب ' + ltr(P.wrap + '°') + ' ← CYL مستحث ≈ ' + ltr(fx(fc(tw))) + (P.wrap > 7 ? ' ⚠️ أكتر من 5–7° على العدسة العادية = تموّج' : P.wrap === 0 ? ' ⚠️ وارب مسطح = تعب على الجنب' : '') + '</div>' +
      '<div>📏 الفيرتكس ' + ltr(P.vertex + ' mm') + ' ← القوة الفعلية ≈ ' + ltr(fx(fe)) + (Math.abs(F) < 4 ? ' (تحت ±4 الفرق بسيط)' : '') + '</div>' +
      '<div class="mut">🟢 الخط الأخضر = اتجاه النظر • ✚ الأصفر = المركز البصري</div>';
  };
  const upd = to => { Object.assign(P, to); B.tween(state, to, 700); calc(); };
  chips(u, '🎥 الزاوية', [['side', 'من الجنب'], ['top', 'من فوق'], ['front', 'من قدام'], ['free', '3/4']], 'free', v => B.camTo({side: [3.1, .15, .7], top: [0, 3.2, 1.0], front: [0, .1, 3.5], free: [2.0, .5, 2.7]}[v], [0, .05, .6]));
  chips(u, '⚡ جاهز', [['std', 'القياسي 8/5/12'], ['rim', 'رمليس الأذرع متوسعة'], ['tip', 'على طرف الأنف'], ['bad', 'بانتو عالي']], null, v => { const p = {std: {panto: 8, wrap: 5, vertex: 12}, rim: {panto: 8, wrap: 0, vertex: 12}, tip: {panto: 6, wrap: 5, vertex: 18}, bad: {panto: 18, wrap: 5, vertex: 12}}[v]; sP.set(p.panto); sW.set(p.wrap); sV.set(p.vertex); upd(p); });
  const sP = stepper(u, '↘️ البانتو', P.panto, 2, 0, 20, v => ltr(v + '°'), v => upd({panto: v}));
  const sW = stepper(u, '↪️ الوارب', P.wrap, 1, 0, 20, v => ltr(v + '°'), v => upd({wrap: v}));
  const sV = stepper(u, '📏 الفيرتكس', P.vertex, 1, 8, 20, v => ltr(v + ' mm'), v => upd({vertex: v}));
  chips(u, '🔢 القوة', [[-4, ltr('−4.00')], [-6, ltr('−6.00')], [-8, ltr('−8.00')], [4, ltr('+4.00')]], P.F, v => { state.F = P.F = v; calc(); });
  chips(u, '📍 المركز البصري', [[false, 'عند البؤبؤ'], [true, 'نازل 1 مم لكل 2°']], P.low, v => { state.low = P.low = v; calc(); B.kick(300); });
  calc(); B.kick(100);
  return B;
}

// ═════════ 2) سُمك العدسة ═════════
function sceneThick(host, o = {}) {
  const B = base(host, {cam: [2.3, -1.3, 3.1], target: [0, 0, 0], min: 1.5, max: 7});
  const S = {F: o.F ?? -6, n: o.n ?? 1.5, ED: o.ED ?? 54};
  const st = Object.assign({}, S);
  const lensM = new THREE.MeshPhysicalMaterial({color: 0xbfe9ff, transparent: true, opacity: .55, roughness: .08, clearcoat: 1, side: THREE.DoubleSide});
  const cutM = new THREE.MeshStandardMaterial({color: LIME, roughness: .5, side: THREE.DoubleSide});
  const g = new THREE.Group(); g.rotation.x = Math.PI / 2; B.scene.add(g);
  let mesh, cut1, cut2;
  const K = 1 / 30;   // مم → وحدة
  const sag = (r, R) => R - Math.sqrt(Math.max(0, R * R - r * r));
  const prof = () => {
    const F = st.F, n = st.n, R = st.ED / 2 + 1;
    const F1 = F < 0 ? Math.max(1, 4 + F * .35) : 4 + F * .75, F2 = F - F1;
    const Rf = (n - 1) / F1 * 1000, Rb = Math.abs(F2) < 1e-6 ? 1e9 : (n - 1) / Math.abs(F2) * 1000;
    const sgn = F2 < 0 ? 1 : -1;
    const t = (r, ct) => ct - sag(r, Rf) + sgn * sag(r, Rb);
    let ct = F < 0 ? 1.6 : 1.0 + sag(R, Rf) - sgn * sag(R, Rb);
    ct = Math.max(ct, F < 0 ? 1.6 : 1.0);
    const pts = [], N = 40;
    for (let i = 0; i <= N; i++) { const r = R * i / N; pts.push(new THREE.Vector2(r * K, -sag(r, Rf) * K)); }
    for (let i = N; i >= 0; i--) { const r = R * i / N; pts.push(new THREE.Vector2(r * K, (-sag(r, Rf) - t(r, ct)) * K)); }
    return {pts, ct, et: t(R, ct), R};
  };
  const rebuild = () => {
    const p = prof();
    [mesh, cut1, cut2].forEach(m => { if (m) { g.remove(m); m.geometry.dispose(); } });
    mesh = new THREE.Mesh(new THREE.LatheGeometry(p.pts, 96, Math.PI * .5, Math.PI * 1.5), lensM);
    const sh = new THREE.Shape(p.pts.map(v => new THREE.Vector2(v.x, v.y)));
    const sg = new THREE.ShapeGeometry(sh);
    cut1 = new THREE.Mesh(sg, cutM);
    cut2 = new THREE.Mesh(sg.clone(), cutM); cut2.rotation.y = -Math.PI * .5;
    g.add(mesh, cut1, cut2);
    g.position.y = 0; return p;
  };
  let last = rebuild();
  B.frames.push(() => { if (Math.abs(st.F - (last.F ?? 99)) > 1e-4 || Math.abs(st.n - last.n) > 1e-4 || Math.abs(st.ED - last.ED) > 1e-4) { last = Object.assign(rebuild(), {F: st.F, n: st.n, ED: st.ED}); } });
  last = Object.assign(last, {F: st.F, n: st.n, ED: st.ED});
  const u = panel(host), rd = readout(u);
  const calc = () => {
    const keep = Object.assign({}, st); Object.assign(st, S); const p = prof(); Object.assign(st, keep);
    rd.innerHTML = '<div>🔍 النص: ' + ltr(p.ct.toFixed(1) + ' mm') + ' • الطرف: ' + ltr(p.et.toFixed(1) + ' mm') + '</div><div>' + (S.F < 0 ? '➖ السالب: الطرف هو الأتخن' : S.F > 0 ? '➕ الموجب: النص هو الأتخن' : 'مستوي') + ' — جرّب تكبر الـ Index أو تصغر الإطار</div><div class="mut">🟩 الأخضر = قطاع في العدسة • الأرقام تقريبية للتوضيح</div>';
  };
  const upd = to => { Object.assign(S, to); B.tween(st, to, 650); calc(); };
  stepper(u, '🔢 القوة', S.F, .5, -10, 8, v => ltr(fx(v)), v => upd({F: v}));
  chips(u, '🧪 الـ Index', [[1.5, '1.50'], [1.6, '1.60'], [1.67, '1.67'], [1.74, '1.74']], S.n, v => upd({n: v}));
  chips(u, '🖼️ حجم الإطار', [[48, 'صغير'], [54, 'وسط'], [60, 'كبير']], S.ED, v => upd({ED: v}));
  calc(); B.kick(100);
  return B;
}

// ═════════ 3) مناطق البروقرسف ═════════
function sceneProg(host, o = {}) {
  const B = base(host, {cam: [0, .2, 3.3], target: [0, -.05, 0], min: 1.6, max: 6});
  const S = {corr: o.corr ?? 14, design: o.design ?? 2, SH: o.SH ?? 22, gaze: 0};
  const st = Object.assign({}, S);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.CircleGeometry(1, 96); const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, -(x * x + y * y) * .12); } geo.computeVertexNormals();
  const disc = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({map: tex, transparent: true, opacity: .95, roughness: .15, clearcoat: 1, side: THREE.DoubleSide}));
  B.scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .02, 12, 96), new THREE.MeshStandardMaterial({color: 0x1f2a22, metalness: .3})); B.scene.add(ring);
  const U = 1 / 35, FIT = 4 * U;   // صليب التركيب 4 مم فوق المرجع
  const frameLine = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .012), new THREE.MeshBasicMaterial({color: 0xff6b6b, depthTest: false})); frameLine.renderOrder = 4; B.scene.add(frameLine);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.16, 32, 24), new THREE.MeshStandardMaterial({color: 0xf6f3ee})); eye.position.set(0, FIT, 1.3); B.scene.add(eye);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.035, 16, 12), new THREE.MeshBasicMaterial({color: 0xffffff, depthTest: false})); dot.renderOrder = 6; B.scene.add(dot);
  const ray = rod(new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .7}), .006); B.scene.add(ray);
  const lab = [['🏞️ بعيد', .62], ['💻 شاشة', 0], ['📱 قريب', -.55]].map(([t]) => { const s = label(t); B.scene.add(s); return s; });
  const draw = () => {
    const g = cv.getContext('2d'), im = g.createImageData(256, 256), d = im.data;
    const L = st.corr * U, w0 = [.05, .08, .12, .17][Math.round(st.design)] ?? .1, wn = [.28, .36, .44, .55][Math.round(st.design)] ?? .4;
    const nearY = FIT - L;
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const x = (i - 128) / 128, y = (128 - j) / 128, k = (j * 256 + i) * 4;
      if (x * x + y * y > 1) { d[k + 3] = 0; continue; }
      let hw, c;
      if (y > FIT + .12) { hw = .95; c = [150, 230, 140]; }
      else if (y > FIT) { const t = (y - FIT) / .12; hw = w0 + (.95 - w0) * t * t; c = [150, 230, 140]; }
      else if (y > nearY) { const t = (FIT - y) / L; hw = w0 + (wn - w0) * t * t * .2; c = [235, 220, 120]; }
      else { hw = wn; c = [130, 190, 245]; }
      const b = Math.min(1, Math.max(0, (Math.abs(x) - hw) / .22));
      d[k] = c[0] * (1 - b) + 235 * b; d[k + 1] = c[1] * (1 - b) + 90 * b; d[k + 2] = c[2] * (1 - b) + 80 * b; d[k + 3] = 200;
    }
    g.putImageData(im, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; const fy = 128 - FIT * 128;
    g.beginPath(); g.moveTo(118, fy); g.lineTo(138, fy); g.moveTo(128, fy - 10); g.lineTo(128, fy + 10); g.stroke();
    tex.needsUpdate = true;
    const bottom = FIT - st.SH * U; frameLine.position.set(0, bottom, .02);
    lab[0].position.set(0, .62, .1); lab[1].position.set(.55, FIT - L * .5, .1); lab[2].position.set(0, Math.max(nearY - .2, -.85), .1);
    const gy = [.45, FIT - L * .55, nearY - .1][Math.round(st.gaze)] ?? 0;
    dot.position.set(0, gy, .02); ray.userData.set(eye.position, dot.position);
    eye.lookAt(dot.position);
  };
  let sig = ''; B.frames.push(() => { const s = [st.corr, st.design, st.SH, st.gaze].map(v => v.toFixed(3)).join(); if (s !== sig) { sig = s; draw(); } });
  draw();
  const u = panel(host), rd = readout(u);
  const calc = () => {
    const L = S.corr, nearBottom = 4 - L - 4, frameBottom = 4 - S.SH;
    const ok = nearBottom >= frameBottom;
    rd.innerHTML = '<div>🛣️ الممر ' + ltr(L + ' mm') + ' • الـ SH ' + ltr(S.SH + ' mm') + '</div><div>' + (ok ? '✅ منطقة القراية جوه الإطار (الخط الأحمر = أسفل الإطار)' : '⚠️ منطقة القراية نازلة تحت الإطار — ممر أقصر أو إطار أعمق') + '</div><div class="mut">🟢 بعيد • 🟡 متوسط • 🔵 قريب • 🔴 تشويش جانبي — التصميم الأعلى يوسّع المناطق</div>';
  };
  const upd = to => { Object.assign(S, to); B.tween(st, to, 750); calc(); };
  chips(u, '👀 بص على', [[0, 'بعيد'], [1, 'شاشة'], [2, 'قريب']], 0, v => upd({gaze: v}));
  chips(u, '🛣️ الممر', [[11, 'قصير'], [14, 'متوسط'], [17, 'طويل']], S.corr, v => upd({corr: v}));
  chips(u, '💎 التصميم', [[0, 'Spheric'], [1, 'Aspheric'], [2, 'Double'], [3, 'FreeForm']], S.design, v => upd({design: v}));
  stepper(u, '📏 الـ SH', S.SH, 1, 16, 28, v => ltr(v + ' mm'), v => upd({SH: v}));
  calc(); B.kick(100);
  return B;
}

// ═════════ 4) البريزم وبرنتيس ═════════
function scenePrism(host, o = {}) {
  const B = base(host, {cam: [.5, .5, 3.4], target: [0, 0, 0], min: 1.6, max: 7});
  const S = {mode: o.mode ?? 'prism', P: 6, F: -5, dx: o.dx ?? 3, dy: o.dy ?? 0};
  const st = Object.assign({}, S);
  // البريزم
  const pg = new THREE.Group(); B.scene.add(pg);
  const tri = new THREE.Shape(); tri.moveTo(0, .55); tri.lineTo(-.42, -.45); tri.lineTo(.42, -.45); tri.closePath();
  const prism = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, {depth: .7, bevelEnabled: false}), new THREE.MeshPhysicalMaterial({color: 0xbfe9ff, transparent: true, opacity: .45, roughness: .05, clearcoat: 1}));
  prism.geometry.translate(0, 0, -.35); pg.add(prism);
  const rm = new THREE.MeshBasicMaterial({color: 0xfff3a0}); const r1 = rod(rm, .012), r2 = rod(rm, .012), r3 = rod(new THREE.MeshBasicMaterial({color: 0xfff3a0, transparent: true, opacity: .35}), .006);
  pg.add(r1, r2, r3);
  const obj = new THREE.Mesh(new THREE.OctahedronGeometry(.09), new THREE.MeshStandardMaterial({color: 0xff8a5b})); obj.position.set(-1.6, 0, 0); pg.add(obj);
  const ghost = new THREE.Mesh(new THREE.OctahedronGeometry(.09), new THREE.MeshStandardMaterial({color: 0xff8a5b, transparent: true, opacity: .35})); pg.add(ghost);
  const eyeP = new THREE.Mesh(new THREE.SphereGeometry(.12, 24, 16), new THREE.MeshStandardMaterial({color: 0xf6f3ee})); eyeP.position.set(1.5, 0, 0); pg.add(eyeP);
  const lBase = label('القاعدة'), lApex = label('القمة'); pg.add(lBase, lApex); lBase.position.set(0, -.62, .4); lApex.position.set(0, .72, .4);
  // برنتيس
  const lgp = new THREE.Group(); B.scene.add(lgp);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(.06, 32), new THREE.MeshBasicMaterial({color: 0x111111})); pupil.position.z = -.25; lgp.add(pupil);
  const iris = new THREE.Mesh(new THREE.RingGeometry(.06, .14, 32), new THREE.MeshBasicMaterial({color: 0x6b4423})); iris.position.z = -.251; lgp.add(iris);
  let lensMesh; const lensMatP = new THREE.MeshPhysicalMaterial({color: 0xbfe9ff, transparent: true, opacity: .5, roughness: .06, clearcoat: 1, side: THREE.DoubleSide});
  const buildLens = F => {
    if (lensMesh) { lgp.remove(lensMesh); lensMesh.geometry.dispose(); }
    const pts = [], R = .9, ct = F < 0 ? .03 : .03 + .0045 * Math.abs(F) * 9, k = .0045 * Math.abs(F);
    for (let i = 0; i <= 30; i++) { const r = R * i / 30; pts.push(new THREE.Vector2(r, F < 0 ? 0 : -k * (r / R) ** 2 * 9)); }
    for (let i = 30; i >= 0; i--) { const r = R * i / 30; pts.push(new THREE.Vector2(r, F < 0 ? -ct - k * (r / R) ** 2 * 9 : -ct)); }
    lensMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), lensMatP); lensMesh.rotation.x = Math.PI / 2; lgp.add(lensMesh);
  };
  const cross = new THREE.Group(); const cm = new THREE.MeshBasicMaterial({color: 0xffd166, depthTest: false});
  cross.add(new THREE.Mesh(new THREE.PlaneGeometry(.18, .02), cm), new THREE.Mesh(new THREE.PlaneGeometry(.02, .18), cm)); cross.children.forEach(c => c.renderOrder = 5); lgp.add(cross);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.06, .16, 16), new THREE.MeshBasicMaterial({color: LIME, depthTest: false})); arrow.renderOrder = 6; lgp.add(arrow);
  const sightL = rod(new THREE.MeshBasicMaterial({color: LIME, transparent: true, opacity: .8}), .006); lgp.add(sightL);
  let lastF = null;
  const layout = () => {
    pg.visible = st.mode === 'prism'; lgp.visible = st.mode !== 'prism';
    if (pg.visible) {
      const dev = Math.atan(st.P / 100) * 3;   // مضخّم ×3 للتوضيح
      const a = obj.position.clone(), b = new THREE.Vector3(-.3, 0, 0), c = new THREE.Vector3(.3, -Math.tan(dev) * .3, 0), e = eyeP.position.clone();
      const out = new THREE.Vector3(1.5, c.y - Math.tan(dev) * 1.2, 0); r1.userData.set(a, b); r2.userData.set(b, c); r3.userData.set(c, out);
      ghost.position.set(-1.6, Math.tan(dev) * 1.6 * .9, 0); eyeP.position.y = out.y;
    } else {
      if (lastF !== st.F) { buildLens(st.F); lastF = st.F; }
      const MMu = .9 / 30;  // نص قطر العدسة = 30 مم
      cross.position.set(-st.dx * MMu, -st.dy * MMu, .05);
      sightL.userData.set(new THREE.Vector3(0, 0, -.25), new THREE.Vector3(0, 0, .8));
      const d = new THREE.Vector3(st.dx, st.dy, 0);   // اتجاه البؤبؤ من المركز
      const dirBase = (st.F < 0 ? d.clone() : d.clone().negate()); const L = dirBase.length();
      arrow.visible = L > .05;
      if (L > .05) { dirBase.normalize(); arrow.position.set(dirBase.x * .45, dirBase.y * .45, .08); arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirBase); }
    }
  };
  layout(); B.frames.push(layout);
  const u = panel(host), rd = readout(u);
  const calc = () => {
    if (S.mode === 'prism') { rd.innerHTML = '<div>🔺 بريزم ' + ltr(S.P + 'Δ') + ': الضوء بيميل ناحية <b>القاعدة</b>، والعين بتشوف الحاجة مزاحة ناحية <b>القمة</b> (الشكل الباهت)</div><div class="mut">الميل مضخّم 3 مرات عشان يبان</div>'; return; }
    const c = Math.hypot(S.dx, S.dy) / 10, P = c * Math.abs(S.F);
    const h = S.dx === 0 ? '' : ((S.F < 0) === (S.dx > 0) ? 'Base In' : 'Base Out');
    const v = S.dy === 0 ? '' : ((S.F < 0) === (S.dy > 0) ? 'Base Up' : 'Base Down');
    rd.innerHTML = '<div>🧮 برنتيس: ' + ltr((c).toFixed(2) + ' cm × ' + Math.abs(S.F).toFixed(2) + ' = ' + P.toFixed(2) + 'Δ') + '</div><div>🧭 القاعدة: ' + ltr([h, v].filter(Boolean).join(' + ') || '—') + (S.dy ? ' ⚠️ الرأسي العين بتستحمله أقل' : '') + '</div><div class="mut">✚ الأصفر = المركز البصري • السهم الأخضر = اتجاه القاعدة • البؤبؤ ثابت والمركز هو اللي اتحرك (الأنف ناحية اليمين في الصورة)</div>';
  };
  const upd = to => { Object.assign(S, to); B.tween(st, Object.fromEntries(Object.entries(to).filter(([k, v]) => typeof v === 'number')), 600); if (to.mode) st.mode = to.mode; if (to.F !== undefined) st.F = to.F; calc(); B.kick(700); };
  chips(u, '🔀 الوضع', [['prism', 'البريزم'], ['prentice', 'قاعدة برنتيس']], S.mode, v => { upd({mode: v}); B.camTo(v === 'prism' ? [0, .4, 3.4] : [.8, .5, 2.6]); });
  stepper(u, '🔺 قوة البريزم', S.P, 2, 2, 12, v => ltr(v + 'Δ'), v => upd({P: v}));
  chips(u, '🔢 قوة العدسة', [[-5, ltr('−5.00')], [-8, ltr('−8.00')], [4, ltr('+4.00')], [6, ltr('+6.00')]], S.F, v => upd({F: v}));
  stepper(u, '↔️ إزاحة أفقية', S.dx, 1, -6, 6, v => ltr(v + ' mm') + (v > 0 ? ' (البؤبؤ ناحية الأنف)' : v < 0 ? ' (البؤبؤ ناحية الصدغ)' : ''), v => upd({dx: v}));
  stepper(u, '↕️ إزاحة رأسية', S.dy, 1, -4, 4, v => ltr(v + ' mm') + (v > 0 ? ' (البؤبؤ فوق المركز)' : v < 0 ? ' (البؤبؤ تحت المركز)' : ''), v => upd({dy: v}));
  calc(); B.kick(100);
  if (S.mode !== 'prism') B.camera.position.set(.8, .5, 2.6);
  return B;
}

// ═════════ 5) العين وعيوب الإبصار ═════════
function sceneEye(host, o = {}) {
  const B = base(host, {cam: [0, .6, 3.6], target: [.2, 0, 0], min: 1.8, max: 7});
  const S = {type: o.type ?? 'myo', fix: 0};
  const len = {norm: 1.6, myo: 1.95, hyp: 1.3};
  const st = {L: len[S.type], fix: 0};
  const eyeG = new THREE.Group(); B.scene.add(eyeG);
  const scl = new THREE.MeshStandardMaterial({color: 0xf3efe8, roughness: .4, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false});
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48, 0, Math.PI * 2, 0, Math.PI), scl); eyeG.add(ball);
  const retina = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, Math.PI * .5, Math.PI * .5), new THREE.MeshStandardMaterial({color: 0xd9534f, side: THREE.DoubleSide, transparent: true, opacity: .55})); eyeG.add(retina);
  retina.rotation.z = Math.PI / 2;
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(.42, 48, 24, 0, Math.PI * 2, 0, Math.PI * .32), new THREE.MeshPhysicalMaterial({color: 0xcff3ff, transparent: true, opacity: .4, clearcoat: 1, side: THREE.DoubleSide})); cornea.rotation.z = Math.PI / 2; B.scene.add(cornea);
  const crys = new THREE.Mesh(new THREE.SphereGeometry(.28, 32, 24), new THREE.MeshPhysicalMaterial({color: 0xfff6d6, transparent: true, opacity: .55, clearcoat: 1})); crys.scale.set(.45, 1, 1); B.scene.add(crys);
  const specLens = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .05, 48), new THREE.MeshPhysicalMaterial({color: 0xbfe9ff, transparent: true, opacity: .45, clearcoat: 1})); specLens.rotation.z = Math.PI / 2; B.scene.add(specLens);
  const rays = [-.45, -.22, 0, .22, .45].map(h => ({h, a: rod(new THREE.MeshBasicMaterial({color: 0xfff3a0}), .008), b: rod(new THREE.MeshBasicMaterial({color: 0xfff3a0}), .008), c: rod(new THREE.MeshBasicMaterial({color: 0xfff3a0, transparent: true, opacity: .55}), .006)}));
  rays.forEach(r => B.scene.add(r.a, r.b, r.c));
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .85, side: THREE.DoubleSide, depthTest: false})); spot.rotation.y = Math.PI / 2; spot.renderOrder = 5; B.scene.add(spot);
  const FOC = 1.6;   // البؤرة الطبيعية من القرنية
  const layout = () => {
    const L = st.L, cx = -.9;   // القرنية عند x = -0.9
    eyeG.position.set(cx + L / 2, 0, 0); eyeG.scale.set(L / 2, .9, .9);
    cornea.position.set(cx + .3, 0, 0);
    crys.position.set(cx + .28, 0, 0);
    const retX = cx + L, need = len.norm;   // عدسة التصحيح بتنقل البؤرة لمكان الشبكية
    const focal = FOC + (L - FOC) * st.fix;
    const fX = cx + focal;
    specLens.position.set(cx - .55, 0, 0); specLens.scale.set(1, st.fix, 1); specLens.visible = st.fix > .02;
    rays.forEach(r => {
      const p0 = new THREE.Vector3(-2.6, r.h * .9, 0), p1 = new THREE.Vector3(cx, r.h * .9, 0), f = new THREE.Vector3(fX, 0, 0);
      r.a.userData.set(p0, p1);
      const dir = f.clone().sub(p1).normalize();
      const tRet = (retX - p1.x) / dir.x; const pr = p1.clone().addScaledVector(dir, tRet);
      if (fX <= retX) { r.b.userData.set(p1, f); r.c.userData.set(f, pr); r.c.visible = true; } else { r.b.userData.set(p1, pr); r.c.visible = false; }
    });
    const blur = Math.abs(retX - fX) * .32 + .015; spot.position.set(retX - .01, 0, 0); spot.scale.set(blur, blur, 1);
    void need;
  };
  layout(); B.frames.push(layout);
  const u = panel(host), rd = readout(u);
  const calc = () => {
    const t = {norm: ['👁️ عين طبيعية', 'الضوء بيتجمع على الشبكية بالظبط ← صورة واضحة'], myo: ['➖ قصر نظر', 'العين أطول ← الضوء بيتجمع قدام الشبكية' + (S.fix ? ' — العدسة السالب فرّقت الضوء فرجعت البؤرة على الشبكية ✅' : ' ← البعيد مغبّش')], hyp: ['➕ طول نظر', 'العين أقصر ← البؤرة ورا الشبكية' + (S.fix ? ' — العدسة الموجب جمّعت الضوء أسرع فرجعت البؤرة على الشبكية ✅' : ' ← العين بتتعب عشان تعوّض')]}[S.type];
    rd.innerHTML = '<div><b>' + t[0] + '</b>: ' + t[1] + '</div><div class="mut">⚪ الدايرة البيضا على الشبكية = حجم الزغللة</div>';
  };
  chips(u, '👁️ العين', [['norm', 'طبيعية'], ['myo', 'قصر نظر'], ['hyp', 'طول نظر']], S.type, v => { S.type = v; B.tween(st, {L: len[v]}, 800); calc(); });
  chips(u, '🔧 العدسة', [[0, 'من غير نظارة'], [1, 'بالعدسة المصححة']], 0, v => { S.fix = v; B.tween(st, {fix: v}, 800); calc(); });
  calc(); B.kick(100);
  return B;
}

const SCENES = {pow: scenePOW, thick: sceneThick, prog: sceneProg, prism: scenePrism, eye: sceneEye};
export function mount(kind, host, opts) {
  try { return (SCENES[kind] || scenePOW)(host, opts || {}); }
  catch (e) { host.innerHTML = '<div class="mut">⚠️ المشهد 3D مش متاح على الجهاز ده</div>'; return {dispose() {}}; }
}
export const LIST = [['pow', '🕶️ وضع النظارة'], ['thick', '🔪 سُمك العدسة'], ['prog', '🌊 مناطق البروقرسف'], ['prism', '🔺 البريزم وبرنتيس'], ['eye', '👁️ العين وعيوب الإبصار']];
