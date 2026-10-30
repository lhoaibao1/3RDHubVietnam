// Bộ dựng chung cho các kiểu cảnh 3D "đêm công nghệ": sân khấu tối có hậu kỳ phát sáng (bloom), camera bay mượt,
// nhãn kính, biểu tượng, đường sáng có hạt dữ liệu chạy, hạt bụi sáng.
import * as T from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'
import { BRANDS, LUCIDE } from '../../lib/icons.generated'
import { dpr, meter, onQuality } from '../quality'
import { getMode, onMode, type Mode } from '../mode'

export const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const PAL = { cyan: 0x27D3FF, blue: 0x3B6BFF, violet: 0x8A5BFF, orange: 0xFF7A3C, mint: 0x2EE6A6, pink: 0xFF4D8D, gold: 0xFFC24D, white: 0xEAF2FF, deep: 0x07102B, panel: 0x0C1B45 }
export const FONT = '"Nunito",system-ui,sans-serif'
export const lin = (h: number) => new T.Color(h).convertSRGBToLinear()

export interface Key { pos: [number, number, number]; look: [number, number, number]; fov?: number }
export interface Stage {
  scene: T.Scene
  camera: T.PerspectiveCamera
  /** Pha lại màu vật liệu theo chế độ sáng/tối (gọi sau khi thêm nội dung mới vào cảnh). */
  regrade(): void
  /** Gọi mỗi khung hình với thời gian (giây). */
  onTick(fn: (t: number, dt: number) => void): void
  /** Bay camera tới khoá hình. */
  fly(key: Key, fast?: boolean): void
  /** Toạ độ màn hình (px, theo kích thước canvas) của một điểm trong cảnh. */
  project(p: T.Vector3): { x: number; y: number; behind: boolean }
  visible(): boolean
  dispose(): void
}

/** Texture nền gradient dọc, dùng làm trời của cảnh. */
function skyTex(top: string, mid: string, bot: string) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const x = c.getContext('2d') as CanvasRenderingContext2D
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot)
  x.fillStyle = g; x.fillRect(0, 0, 4, 256)
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t
}

/* ---------- đổi cảnh theo chế độ sáng/tối của trang ----------
   Mỗi kiểu cảnh được dựng theo một "bản gốc" (đêm hoặc ngày). Khi trang ở chế độ ngược lại, mọi vật liệu được pha lại
   (sáng lên hoặc tối đi), trời, sương và đèn đổi theo; giá trị gốc được giữ trong userData nên đổi qua lại không bị lệch. */
const WHITE = lin(0xF4F6FC), NIGHT = lin(0x101A40)
const luma = (c: T.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
type Grade = 'native' | 'light' | 'dark'
function gradeMat(m: any, g: Grade) {
  const u = m.userData
  if (!u.o) u.o = { map: m.map, color: m.color ? m.color.clone() : null, ei: m.emissiveIntensity, bl: m.blending, op: m.opacity, tr: m.transparent, env: m.envMapIntensity, em: m.emissive ? m.emissive.clone() : null }
  const o = u.o
  if (o.color) m.color.copy(o.color)
  if (o.ei != null) m.emissiveIntensity = o.ei
  if (o.em) m.emissive.copy(o.em)
  if (m.isMeshStandardMaterial) m.map = o.map
  m.blending = o.bl; m.opacity = o.op; m.transparent = o.tr
  if (o.env != null) m.envMapIntensity = o.env
  if (g === 'light' && m.color) {
    const std = m.isMeshStandardMaterial
    if (std) {
      /* toà nhà có cửa sổ sáng: bỏ lớp vân tối, chỉ giữ cửa sổ phát sáng nhẹ trên thân sáng */
      if (m.map && m.emissiveMap) m.map = null
      m.color.lerp(WHITE, luma(o.color) < 0.03 ? 0.74 : 0.58); m.emissiveIntensity = (o.ei || 0) * (m.emissiveMap ? 0.55 : 0.3); if (o.env != null) m.envMapIntensity = o.env * 0.6
    } else {
      if (m.blending === T.AdditiveBlending) m.blending = T.NormalBlending
      const L = luma(o.color)
      /* nền tối (sàn, tường, trời giả) chuyển sang sáng; màu neon giữ sắc nhưng bớt chói cho hợp nền sáng */
      if (m.map && !o.tr && !m.isSpriteMaterial) { m.transparent = true; m.opacity = o.op * 0.3; m.color.lerp(WHITE, 0.5) }
      else if (m.map && o.tr && m.isMeshBasicMaterial && o.op > 0.8) m.opacity = o.op * 0.7
      else if (L < 0.08) m.color.lerp(WHITE, 0.86)
      else if (L > 1) m.color.multiplyScalar(0.85 / L)
      if (m.isPointsMaterial) m.color.lerp(lin(0x3B6BFF), 0.6)
    }
  } else if (g === 'dark' && m.color) {
    if (m.isMeshStandardMaterial) { m.color.lerp(NIGHT, m.map ? 0.8 : 0.55); m.emissiveIntensity = Math.max(o.ei || 0, 0.12) * 1.6; if (o.em && luma(o.em) === 0) m.emissive.copy(m.color).multiplyScalar(0.25) }
    else if (luma(o.color) > 0.5) m.color.lerp(NIGHT, 0.6)
  }
  m.needsUpdate = true
}

export function createStage(canvas: HTMLCanvasElement, o: { fov?: number; fog?: [number, number]; sky?: [string, string, string]; bloom?: number; offsetX?: number; fogColor?: number; day?: boolean }): Stage {
  /* điện thoại: tắt hậu kỳ phát sáng cho nhẹ máy, đỡ nóng và tốn pin (bù lại bật khử răng cưa) */
  const phone = innerWidth <= 640
  const R = new T.WebGLRenderer({ canvas, antialias: o.bloom === 0 || phone, alpha: false, powerPreference: 'high-performance' })
  R.outputEncoding = T.sRGBEncoding
  const scene = new T.Scene()
  const sky = o.sky || ['#040A1C', '#0A1B45', '#0E2A63']
  const fogN = o.fog || [40, 130]
  const nativeSky = skyTex(sky[0], sky[1], sky[2])
  const nativeFog = lin(o.fogColor == null ? 0x0A1B45 : o.fogColor)
  scene.background = nativeSky
  scene.fog = new T.Fog(nativeFog.clone(), fogN[0], fogN[1])
  /* đèn phụ chỉ bật khi cảnh đang ở chế độ ngược với bản gốc */
  const fill = new T.HemisphereLight(0xFFFFFF, 0xDCE3F2, 0); scene.add(fill)
  const sun = new T.DirectionalLight(0xFFF4E6, 0); sun.position.set(-20, 40, 30); scene.add(sun)
  let grade: Grade = 'native', gradeAt = 2, bloomK = 1
  const lightSky = skyTex('#DDE7FA', '#EEF1F7', '#F3F1EC'), darkSky = skyTex('#060B22', '#0C1638', '#0E1426')
  function setGrade(m: Mode) {
    grade = m === 'dark' ? (o.day ? 'dark' : 'native') : (o.day ? 'native' : 'light')
    scene.background = grade === 'light' ? lightSky : grade === 'dark' ? darkSky : nativeSky
    ;(scene.fog as T.Fog).color.copy(grade === 'light' ? lin(0xEEF1F7) : grade === 'dark' ? lin(0x0E1426) : nativeFog)
    fill.intensity = grade === 'light' ? 1.15 : grade === 'dark' ? 0.25 : 0
    sun.intensity = grade === 'light' ? 0.9 : 0
    bloomK = grade === 'light' ? 0.22 : 1
    gradeAt = Math.max(gradeAt, 1)
  }
  function regrade() { const seen = new Set<any>(); scene.traverse((ob: any) => {
    if (ob.isLight && ob !== fill && ob !== sun) { if (ob.userData.i0 == null) ob.userData.i0 = ob.intensity; ob.intensity = ob.userData.i0 * (grade === 'dark' ? 0.45 : grade === 'light' ? 0.75 : 1) } const ms = ob.material; if (!ms) return; (Array.isArray(ms) ? ms : [ms]).forEach((x: any) => { if (!seen.has(x)) { seen.add(x); gradeMat(x, grade) } }) }) }
  setGrade(getMode())
  const offMode = onMode(setGrade)
  const camera = new T.PerspectiveCamera(o.fov || 30, 1, 0.5, 400)

  let W = 1, H = 1
  let rt = new T.WebGLMultisampleRenderTarget(2, 2, { format: T.RGBAFormat }); rt.samples = dpr() >= 1.75 ? 2 : 4
  const composer = new EffectComposer(R, rt)
  composer.addPass(new RenderPass(scene, camera))
  const bloomS = o.bloom == null ? 0.85 : o.bloom
  const bloom = new UnrealBloomPass(new T.Vector2(2, 2), bloomS, 0.65, 0.22)
  composer.addPass(bloom)
  composer.addPass(new ShaderPass(GammaCorrectionShader))
  scene.userData.sky = true
  let bloomOn = o.bloom !== 0 && !phone

  const ticks: ((t: number, dt: number) => void)[] = []
  const clock = new T.Clock()
  const cur = { pos: new T.Vector3(0, 10, 40), look: new T.Vector3(), fov: o.fov || 30 }
  const tgt = { pos: new T.Vector3(0, 10, 40), look: new T.Vector3(), fov: o.fov || 30 }
  let vis = true, raf = 0, last = 0, flying = 0
  /* lớp nhãn HTML */
  const overlay = document.createElement('div'); overlay.className = 'gl-labels'; overlay.setAttribute('aria-hidden', 'true')
  let lbls: T.Object3D[] = [], scan = 0
  const lv = new T.Vector3()
  function syncLabels() {
    const par = canvas.parentElement
    if (par && overlay.parentElement !== par) par.insertBefore(overlay, canvas.nextSibling)
    overlay.style.left = canvas.offsetLeft + 'px'; overlay.style.top = canvas.offsetTop + 'px'
    overlay.style.width = W + 'px'; overlay.style.height = H + 'px'
    if (scan-- <= 0) {
      scan = 20
      const now: T.Object3D[] = []
      scene.traverse((o) => { if (o.userData.lbl) now.push(o) })
      for (const o of lbls) if (!now.includes(o)) { (o.userData.el as HTMLElement | undefined)?.remove(); delete o.userData.el }
      lbls = now
    }
    /* đặt nhãn rồi đẩy những nhãn chồng nhau lên trên để không che nhau */
    const placed: { x: number; y: number; w: number; h: number }[] = []
    const items: { el: HTMLElement; x: number; y: number; z: number }[] = []
    for (const o of lbls) {
      let el = o.userData.el as HTMLElement | undefined
      if (!el) {
        const d = o.userData.lbl
        el = document.createElement('div'); el.className = 'gl-lb'; el.style.setProperty('--c', d.color)
        const b = document.createElement('b'); b.textContent = d.text; el.appendChild(b)
        if (d.sub) { const sp = document.createElement('span'); sp.textContent = d.sub; el.appendChild(sp) }
        overlay.appendChild(el); o.userData.el = el
      }
      o.getWorldPosition(lv); lv.project(camera)
      const x = (lv.x * 0.5 + 0.5) * W, y = (-lv.y * 0.5 + 0.5) * H
      const show = lv.z < 1 && x > -60 && x < W + 60 && y > -20 && y < H + 40
      el.style.opacity = show ? '1' : '0'
      if (show) items.push({ el, x, y, z: lv.z })
    }
    items.sort((a, b) => a.z - b.z) // gần camera đặt trước, giữ đúng chỗ
    for (const it of items) {
      const w = it.el.offsetWidth || 90, h = it.el.offsetHeight || 34
      let y = it.y
      for (let n = 0; n < 6; n++) {
        const hit = placed.find((p) => Math.abs(p.x - it.x) < (p.w + w) / 2 + 4 && y > p.y - p.h - 4 && y - h < p.y + 4)
        if (!hit) break
        y = hit.y - hit.h - 6
      }
      placed.push({ x: it.x, y, w, h })
      it.el.style.transform = `translate(${it.x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`
    }
  }
  const mt = meter()

  function size() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(1, r.width); H = Math.max(1, r.height)
    const pr = dpr()
    R.setPixelRatio(pr); R.setSize(W, H, false)
    composer.setPixelRatio(pr); composer.setSize(W, H)
    bloom.setSize(Math.round(W * pr * 0.5), Math.round(H * pr * 0.5))
    camera.aspect = W / H
    if (W > 900 && o.offsetX !== 0) camera.setViewOffset(W, H, -W * (o.offsetX == null ? 0.17 : o.offsetX), 0, W, H); else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  size()

  const offQ = onQuality(() => { size(); if (!RM && o.bloom !== 0 && !phone) bloomOn = true })
  const ro = new ResizeObserver(size); ro.observe(canvas)
  const io = new IntersectionObserver((e) => { vis = e[0].isIntersecting }); io.observe(canvas)
  let slow = 0

  function frame() {
    raf = requestAnimationFrame(frame)
    if (!vis) return
    const now = performance.now()
    if (now - last < 15) return
    const dt = Math.min(0.05, (now - last) / 1000); mt(now - last); last = now
    const t = clock.getElapsedTime()
    const k = RM ? 1 : Math.min(1, dt * (flying > 0 ? 3.2 : 2.4))
    cur.pos.lerp(tgt.pos, k); cur.look.lerp(tgt.look, k); cur.fov += (tgt.fov - cur.fov) * k
    if (flying > 0) flying -= dt
    const sway = RM ? 0 : 1
    camera.position.set(cur.pos.x + Math.sin(t * 0.21) * 0.9 * sway, cur.pos.y + Math.sin(t * 0.17) * 0.4 * sway, cur.pos.z)
    camera.lookAt(cur.look)
    if (Math.abs(camera.fov - cur.fov) > 0.01) { camera.fov = cur.fov; camera.updateProjectionMatrix() }
    for (const f of ticks) f(t, dt)
    if (gradeAt > 0 && --gradeAt === 0) regrade()
    bloom.strength = bloomS * bloomK
    if (bloomOn) composer.render(dt); else R.render(scene, camera)
    syncLabels()
    // máy quá chậm: tắt bloom (giữ cảnh mượt), mức giảm độ nét đã do quality.ts lo
    if (dt * 1000 > 40) slow++; else slow = Math.max(0, slow - 1)
    if (slow > 40 && bloomOn) { bloomOn = false; R.setPixelRatio(Math.min(R.getPixelRatio(), 1)) }
  }
  frame()

  return {
    scene, camera,
    regrade() { gradeAt = 2 },
    onTick(fn) { ticks.push(fn) },
    fly(key, fast) {
      tgt.pos.set(...key.pos); tgt.look.set(...key.look); tgt.fov = key.fov || o.fov || 30; flying = 2.5
      if (fast || RM) { cur.pos.copy(tgt.pos); cur.look.copy(tgt.look); cur.fov = tgt.fov }
    },
    project(p) {
      const v = p.clone().project(camera)
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, behind: v.z > 1 }
    },
    visible: () => vis,
    dispose() { offMode(); overlay.remove(); cancelAnimationFrame(raf); offQ(); ro.disconnect(); io.disconnect(); rt.dispose(); R.dispose(); scene.traverse((m: any) => { if (m.geometry) m.geometry.dispose() }) },
  }
}

/* ---------------- biểu tượng và nhãn ---------------- */
const iconCache: Record<string, T.CanvasTexture> = {}
/** Biểu tượng (lucide hoặc logo thương hiệu) vẽ lên canvas, trắng/nhuộm màu, nền trong suốt. */
export function iconTex(name: string, color = '#EAF2FF', size = 256): T.CanvasTexture {
  const key = name + color + size
  if (iconCache[key]) return iconCache[key]
  const c = document.createElement('canvas'); c.width = c.height = size
  const x = c.getContext('2d') as CanvasRenderingContext2D
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4
  iconCache[key] = t
  if (name.startsWith('brand:')) {
    const b = BRANDS[name.slice(6)]
    if (b) { x.save(); x.scale(size / 24, size / 24); x.fillStyle = color; x.fill(new Path2D(b.p)); x.restore(); t.needsUpdate = true }
  } else if (LUCIDE[name]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${LUCIDE[name]}</svg>`
    const img = new Image()
    img.onload = () => { x.clearRect(0, 0, size, size); x.drawImage(img, size * 0.08, size * 0.08, size * 0.84, size * 0.84); t.needsUpdate = true }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }
  return t
}


/** Nhãn của một khu vực trong cảnh. Vẽ bằng HTML phủ lên canvas (chữ luôn nét, không bị nhoè vì hiệu ứng phát sáng);
 *  vật thể trả về chỉ là điểm neo, sân khấu (createStage) tự đặt nhãn theo vị trí của nó mỗi khung hình. */
export function label(text: string, color: number, _h = 1.5, sub = ''): T.Object3D {
  const o = new T.Object3D()
  o.userData.lbl = { text, sub, color: '#' + new T.Color(color).getHexString() }
  return o
}

/* ---------------- vật liệu phát sáng ---------------- */
export const neon = (c: number, k = 1) => new T.MeshBasicMaterial({ color: lin(c).multiplyScalar(k), toneMapped: false })
export function glass(c = PAL.panel, emissive = 0x0B2A6F, ei = 0.5) {
  return new T.MeshStandardMaterial({ color: lin(c), roughness: 0.28, metalness: 0.55, emissive: lin(emissive), emissiveIntensity: ei, envMapIntensity: 1 })
}
export function metal(c = 0x1B2A55, r = 0.35) { return new T.MeshStandardMaterial({ color: lin(c), roughness: r, metalness: 0.7 }) }

export function rbox(w: number, h: number, d: number, r = 0.2, seg = 3): T.BufferGeometry {
  r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.01)
  const s = new T.Shape(), x = -w / 2 + r, y = -d / 2 + r, W = w - 2 * r, D = d - 2 * r
  s.moveTo(x, y - r); s.lineTo(x + W, y - r); s.quadraticCurveTo(x + W + r, y - r, x + W + r, y); s.lineTo(x + W + r, y + D); s.quadraticCurveTo(x + W + r, y + D + r, x + W, y + D + r); s.lineTo(x, y + D + r); s.quadraticCurveTo(x - r, y + D + r, x - r, y + D); s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r)
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * r * 0.4), bevelEnabled: true, bevelThickness: r * 0.4, bevelSize: r * 0.4, bevelSegments: seg, curveSegments: 6 })
  g.rotateX(-Math.PI / 2); g.translate(0, r * 0.4, 0)
  return g
}

/** Khung cạnh sáng bao quanh một hình hộp (tạo cảm giác kính phát sáng khi có bloom). */
export function edges(geo: T.BufferGeometry, color: number, k = 1.2): T.LineSegments {
  return new T.LineSegments(new T.EdgesGeometry(geo, 25), new T.LineBasicMaterial({ color: lin(color).multiplyScalar(k), toneMapped: false }))
}

/** Ống sáng đi qua các điểm. Trả về đường cong để thả hạt dữ liệu. */
export function beam(parent: T.Object3D, pts: T.Vector3[], color: number, r = 0.07, closed = false) {
  const curve = new T.CatmullRomCurve3(pts, closed, 'catmullrom', 0.3)
  const m = new T.Mesh(new T.TubeGeometry(curve, Math.max(24, pts.length * 14), r, 8, closed), neon(color, 0.9))
  parent.add(m)
  return curve
}

/** Các hạt dữ liệu chạy dọc đường cong; trả về hàm cập nhật. */
export function packets(parent: T.Object3D, curve: T.Curve<T.Vector3>, n: number, color: number, size = 0.28, speed = 0.08, geo?: T.BufferGeometry) {
  const items: T.Mesh[] = []
  for (let i = 0; i < n; i++) { const m = new T.Mesh(geo || new T.SphereGeometry(size, 10, 8), neon(color, 1.6)); parent.add(m); items.push(m) }
  return (t: number) => items.forEach((m, i) => { const u = (t * speed + i / n) % 1; m.position.copy(curve.getPointAt(u)); const e = Math.min(1, u * 10, (1 - u) * 10); m.scale.setScalar(Math.max(0.001, e)) })
}

/** Sàn lưới neon mờ dần ra xa. */
export function grid(parent: T.Object3D, size: number, color: number, y = 0, step = 2) {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const x = c.getContext('2d') as CanvasRenderingContext2D
  x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 512, 512)
  const col = '#' + new T.Color(color).getHexString()
  x.strokeStyle = col; x.lineWidth = 2; x.globalAlpha = 0.55
  const n = Math.round(size / step)
  for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke() }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(n / 8, n / 8); t.anisotropy = 4; t.encoding = T.sRGBEncoding
  const fade = document.createElement('canvas'); fade.width = fade.height = 256
  const fx = fade.getContext('2d') as CanvasRenderingContext2D
  const g = fx.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(1, '#000'); fx.fillStyle = g; fx.fillRect(0, 0, 256, 256)
  const a = new T.CanvasTexture(fade)
  const m = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ map: t, alphaMap: a, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9, fog: false }))
  m.rotation.x = -Math.PI / 2; m.position.y = y; parent.add(m)
  return m
}

/** Bụi sáng lơ lửng; trả về hàm cập nhật. */
export function dust(parent: T.Object3D, n: number, spread: [number, number, number], center: [number, number, number], color = 0x8FB4FF, size = 5) {
  const pos = new Float32Array(n * 3); let s = 5
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < n; i++) { pos[i * 3] = center[0] + (rnd() - 0.5) * spread[0]; pos[i * 3 + 1] = center[1] + (rnd() - 0.5) * spread[1]; pos[i * 3 + 2] = center[2] + (rnd() - 0.5) * spread[2] }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3))
  const c = document.createElement('canvas'); c.width = c.height = 32
  const x = c.getContext('2d') as CanvasRenderingContext2D
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32)
  const mat = new T.PointsMaterial({ map: new T.CanvasTexture(c), color: lin(color), size, sizeAttenuation: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, opacity: 0.8, fog: false })
  const pts = new T.Points(geo, mat); parent.add(pts)
  return (t: number) => { pts.rotation.y = t * 0.012; mat.opacity = 0.6 + 0.2 * Math.sin(t * 1.3) }
}

/** Ánh sáng chung: trời xanh đêm + đèn viền cam / xanh lơ. */
export function nightLights(scene: T.Scene) {
  scene.add(new T.HemisphereLight(0x5E7CFF, 0x0A1030, 0.9))
  const key = new T.DirectionalLight(0xBFD4FF, 1.1); key.position.set(-20, 40, 25); scene.add(key)
  const a = new T.DirectionalLight(0xFF7A3C, 1.3); a.position.set(-30, 12, -26); scene.add(a)
  const b = new T.DirectionalLight(0x27D3FF, 1.4); b.position.set(34, 14, -30); scene.add(b)
  return { key, a, b }
}

/** Môi trường phản chiếu tối có dải sáng cyan / cam để kim loại và kính có viền sáng. */
export function nightEnv(): T.CubeTexture {
  const F: HTMLCanvasElement[] = []
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const x = c.getContext('2d') as CanvasRenderingContext2D
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#1B2A66'); g.addColorStop(1, '#070D26'); x.fillStyle = g; x.fillRect(0, 0, 128, 128)
    const box = (a: number, b: number, w: number, h: number, col: string, bl: number) => { x.save(); x.shadowColor = col; x.shadowBlur = bl; x.fillStyle = col; x.fillRect(a, b, w, h); x.restore() }
    if (i === 0) box(52, 10, 24, 100, '#27D3FF', 20)
    if (i === 1) box(52, 10, 24, 100, '#FF7A3C', 20)
    if (i === 2) box(30, 30, 68, 68, '#7C8CFF', 26)
    if (i === 4) box(20, 30, 88, 24, '#9AB4FF', 18)
    if (i === 5) box(20, 60, 88, 20, '#27D3FF', 18)
    F.push(c)
  }
  const t = new T.CubeTexture(F as any); t.encoding = T.sRGBEncoding; t.needsUpdate = true
  return t
}

/** Texture cửa sổ sáng đèn (toà nhà, tủ máy chủ). */
export function winTex(seed = 3, cols = 4, rows = 16, warm = 0.3) {
  const c = document.createElement('canvas'); c.width = cols * 16; c.height = rows * 8
  const x = c.getContext('2d') as CanvasRenderingContext2D
  x.fillStyle = '#05102C'; x.fillRect(0, 0, c.width, c.height)
  let s = seed; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (r() < 0.5) { x.fillStyle = r() < warm ? '#FF9A5C' : '#4FD8FF'; x.fillRect(i * 16 + 3, j * 8 + 2, 10, 4) }
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.magFilter = T.NearestFilter; return t
}

/** Vật liệu thân toà nhà phát sáng cửa sổ. */
export function winMat(seed = 3, cols = 4, rows = 16, base = 0x0B1740, warm = 0.3) {
  const t = winTex(seed, cols, rows, warm)
  return new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new T.Color(0xFFFFFF), emissiveIntensity: 1.1, color: lin(base), roughness: 0.5, metalness: 0.3 })
}

/** Biểu tượng phát sáng lơ lửng (sprite). */
export function iconSprite(name: string, size = 1.8, color = '#FFFFFF') {
  const sp = new T.Sprite(new T.SpriteMaterial({ map: iconTex(name, color), transparent: true, depthWrite: false, toneMapped: false, fog: false }))
  sp.scale.set(size, size, 1); sp.renderOrder = 9
  return sp
}
