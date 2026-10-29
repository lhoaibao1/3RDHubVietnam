// Các vật thể dùng lại trong nhiều cảnh 3D: toà nhà có cửa sổ phát sáng, trụ 3RDHub, màn hình, điện thoại, ngân hàng, hộp thư, tủ máy chủ, cây.
// Viết lại theo hướng "sứ mờ + chi tiết nhỏ + ánh sáng" thay cho các khối trơn trước đây.
import * as T from 'three'
import { FONT, MAT, M, C, RB, RBM, ctex, cyl, getMode, glow, mesh, onMode, rgeo, rr, screen, sph, type Mode } from './core'

function rnd(seed: number) {
  let s = seed || 1
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

/** Vật liệu tường có cửa sổ: bản đồ màu (kính xanh) + bản đồ phát sáng (cửa sổ bật đèn, sáng rõ hơn khi tối). */
function wallMat(cols: number, rows: number, seed: number, lit = 0.42) {
  const r = rnd(seed)
  const W = 256, H = 256 * Math.max(1, rows / cols)
  const lite: boolean[] = []
  for (let i = 0; i < cols * rows; i++) lite.push(r() < lit)
  const draw = (emissive: boolean) => ctex(W, H, (x: any, w: number, h: number) => {
    x.fillStyle = emissive ? '#000' : '#FFFFFF'
    x.fillRect(0, 0, w, h)
    if (!emissive) {
      const g = x.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#E4E0D8')
      x.fillStyle = g; x.fillRect(0, 0, w, h)
    }
    const cw = w / cols, ch = h / rows
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const px = i * cw + cw * 0.2, py = j * ch + ch * 0.18, pw = cw * 0.6, ph = ch * 0.62
      if (emissive) {
        if (lite[j * cols + i]) { x.fillStyle = '#FFD58A'; rr(x, px, py, pw, ph, 4); x.fill() }
      } else {
        const gg = x.createLinearGradient(px, py, px + pw, py + ph)
        gg.addColorStop(0, '#9FB8E8'); gg.addColorStop(1, '#5F7FC4')
        x.fillStyle = gg; rr(x, px, py, pw, ph, 4); x.fill()
        x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(px + 2, py + 2, pw * 0.4, 3)
      }
    }
  })
  const m = new T.MeshStandardMaterial({ map: draw(false), emissiveMap: draw(true), emissive: new T.Color(0xFFFFFF), emissiveIntensity: 0, roughness: 0.55, metalness: 0.05 })
  const paint = (k: Mode) => { m.color.copy(MAT.white.color); m.emissiveIntensity = k === 'dark' ? 1.25 : 0.0; m.needsUpdate = true }
  paint(getMode()); onMode(paint)
  return m
}

/** Toà nhà: thân có cửa sổ, đế, mái nhấn màu, cột ăng-ten / điều hoà trên mái. */
export function tower(parent: any, w: number, h: number, d: number, roof: number, x: number, y: number, z: number, seed: number, style = 0) {
  const g = new T.Group(); g.position.set(x, y, z); parent.add(g)
  const cols = Math.max(2, Math.round(w * 1.4)), rows = Math.max(3, Math.round(h * 1.5))
  const wm = wallMat(cols, rows, seed)
  const body = mesh(new T.BoxGeometry(w, h, d), wm, 0, h / 2, 0); g.add(body)
  RB(g, w + 0.28, 0.22, d + 0.28, 0.1, MAT.cream, 0, 0, 0)
  const rm = M(roof, { r: 0.4 })
  RB(g, w + 0.34, 0.34, d + 0.34, 0.14, rm, 0, h, 0)
  if (style === 1) { cyl(g, 0.05, 0.9, MAT.dark, 0.3, h + 0.34, 0.1, 8); glow(g, 0xFF6A2B, 0.7, 0.3, h + 1.3, 0.1, 0.8) }
  else if (style === 2) { RB(g, w * 0.42, 0.34, d * 0.42, 0.1, MAT.cream, -w * 0.18, h + 0.34, 0); const s2 = sph(g, 0.28, rm, w * 0.2, h + 0.62, 0) }
  else { RB(g, 0.5, 0.3, 0.4, 0.08, MAT.cream, -w * 0.2, h + 0.34, 0.1) }
  RB(g, 0.7, 0.8, 0.1, 0.05, MAT.dark, 0, 0.1, d / 2 + 0.01)
  return g
}

/** Trụ 3RDHub: đế xanh đêm, thân sứ trắng, hai vòng sáng, chớp đèn và tia sáng đi lên. Trả về { g, tick(t) }. */
export function hub(parent: any, s: number, x: number, y: number, z: number, accent = 0xFF6A2B) {
  const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g)
  const ac = M(accent, { r: 0.3, e: accent, ei: 0.25 })
  cyl(g, 2.6, 0.34, MAT.navy, 0, 0, 0, 64)
  cyl(g, 2.2, 0.2, ac, 0, 0.34, 0, 64)
  const core = cyl(g, 1.7, 2.4, MAT.white, 0, 0.5, 0, 64)
  const bands: any[] = []
  for (let k = 0; k < 3; k++) {
    const b = new T.Mesh(new T.TorusGeometry(1.72, 0.07, 10, 80), new T.MeshBasicMaterial({ color: C(accent), toneMapped: false }))
    b.rotation.x = Math.PI / 2; b.position.y = 0.95 + k * 0.7; g.add(b); bands.push(b)
  }
  const glass = new T.MeshPhysicalMaterial({ color: C(0xBFD6FF), roughness: 0.05, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2 })
  const dome = new T.Mesh(new T.SphereGeometry(1.7, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass); dome.position.y = 2.9; g.add(dome)
  const orb = new T.Mesh(new T.SphereGeometry(0.85, 32, 20), new T.MeshBasicMaterial({ color: C(accent), toneMapped: false })); orb.position.y = 3.55; g.add(orb)
  glow(g, accent, 3.4, 0, 3.6, 0, 0.6)
  const sign = ctex(512, 160, (x2: any, w: number, h: number) => { x2.fillStyle = '#0B2A6F'; rr(x2, 0, 0, w, h, 40); x2.fill(); x2.fillStyle = '#fff'; x2.font = '900 82px ' + FONT; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText('3RDHub', w / 2, h / 2 + 4) })
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const p = screen(g, 2.2, 0.69, sign, Math.sin(a) * 1.76, 1.6, Math.cos(a) * 1.76, a)
    void p
  }
  /* tia sáng lên trời */
  const beam = ctex(64, 256, (x2: any, w: number, h: number) => { const gr = x2.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, w, h) })
  const bm = new T.MeshBasicMaterial({ map: beam, color: C(accent), transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide, opacity: 0.5, fog: false })
  const bmesh = new T.Mesh(new T.CylinderGeometry(0.75, 1.5, 6, 40, 1, true), bm); bmesh.position.y = 6; bmesh.renderOrder = 2; g.add(bmesh)
  onMode((k: Mode) => { bm.blending = k === 'dark' ? T.AdditiveBlending : T.NormalBlending; bm.opacity = k === 'dark' ? 0.7 : 0.32; bm.needsUpdate = true; ac.emissiveIntensity = k === 'dark' ? 0.7 : 0.25 })
  bm.blending = getMode() === 'dark' ? T.AdditiveBlending : T.NormalBlending; bm.opacity = getMode() === 'dark' ? 0.7 : 0.32
  glow(g, accent, 5, 0, 3.2, 0, 0.4)
  void core
  return { g, tick(t: number) { orb.scale.setScalar(1 + 0.06 * Math.sin(t * 2.4)); orb.position.y = 3.55 + 0.08 * Math.sin(t * 1.6); bands.forEach((b, i) => { b.scale.setScalar(1 + 0.012 * Math.sin(t * 3 + i)); (b.material as any).opacity = 1 }); bmesh.rotation.y = t * 0.4 } }
}

/** Màn hình máy tính mỏng: viền tối, kính có vệt phản chiếu, chân đế elip, quầng sáng nhẹ. */
export function monitor(parent: any, w: number, h: number, tex: any, x: number, y: number, z: number, ry = 0) {
  const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g)
  RB(g, w, h, 0.22, 0.16, RBM.joint, 0, 0, 0)
  screen(g, w - 0.34, h - 0.34, tex, 0, h / 2, 0.125)
  const sheen = ctex(128, 128, (c: any, W: number, H: number) => { const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, H) })
  const sh = new T.Mesh(new T.PlaneGeometry(w - 0.34, h - 0.34), new T.MeshBasicMaterial({ map: sheen, transparent: true, depthWrite: false, toneMapped: false }))
  sh.position.set(0, h / 2, 0.13); g.add(sh)
  cyl(g, 0.18, h * 0.32, RBM.joint, 0, -h * 0.32, 0, 16)
  const base = cyl(g, 0.9, 0.1, RBM.joint, 0, -h * 0.34, 0.1, 40); base.scale.set(1, 1, 0.62)
  glow(g, 0x9FB8FF, w * 1.5, 0, h / 2, -0.4, 0.28)
  return g
}

/** Điện thoại: thân mỏng bo tròn, màn hình kính, tai thỏ, nút bên hông. */
export function phoneDev(parent: any, w: number, h: number, tex: any, x: number, y: number, z: number, ry = 0) {
  const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.rotation.x = -0.05; parent.add(g)
  RB(g, w, h, 0.3, 0.3, RBM.joint, 0, 0, 0)
  screen(g, w - 0.26, h - 0.3, tex, 0, h / 2, 0.165)
  const sheen = ctex(128, 256, (c: any, W: number, H: number) => { const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,.3)'); gr.addColorStop(0.4, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, H) })
  const sh = new T.Mesh(new T.PlaneGeometry(w - 0.26, h - 0.3), new T.MeshBasicMaterial({ map: sheen, transparent: true, depthWrite: false, toneMapped: false })); sh.position.set(0, h / 2, 0.17); g.add(sh)
  RB(g, w * 0.3, 0.1, 0.06, 0.04, MAT.dark, 0, h - 0.34, 0.18)
  RB(g, 0.06, 0.5, 0.06, 0.02, RBM.joint, w / 2 + 0.01, h * 0.62, 0)
  return g
}

/** Ngân hàng: bậc thềm, cột có đầu cột, mặt tiền nhấn vàng, cửa sổ sáng đèn, cột cờ. */
export function bankB(parent: any, s = 1) {
  const b = new T.Group(); b.scale.setScalar(s); parent.add(b)
  RB(b, 6.4, 0.22, 5, 0.1, MAT.cream, 0, 0, 0); RB(b, 5.9, 0.22, 4.5, 0.1, MAT.white, 0, 0.22, 0); RB(b, 5.4, 0.22, 4.0, 0.1, MAT.cream, 0, 0.44, 0)
  const wm = wallMat(6, 5, 21, 0.5)
  b.add(mesh(new T.BoxGeometry(5, 3, 3.2), wm, 0, 0.66 + 1.5, -0.5))
  for (let k = 0; k < 4; k++) {
    const x = -1.9 + k * 1.27
    cyl(b, 0.27, 2.55, MAT.white, x, 0.88, 1.5, 24); RB(b, 0.78, 0.16, 0.78, 0.05, MAT.cream, x, 3.43, 1.5); RB(b, 0.78, 0.16, 0.78, 0.05, MAT.cream, x, 0.84, 1.5)
  }
  RB(b, 5.8, 0.4, 4.2, 0.14, MAT.navy, 0, 3.6, 0.3)
  const g1 = new T.Shape(); g1.moveTo(-3, 0); g1.lineTo(3, 0); g1.lineTo(0, 1.6); g1.lineTo(-3, 0)
  const ped = mesh(new T.ExtrudeGeometry(g1, { depth: 3.9, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }), MAT.orange, 0, 4.0, 0.3 - 1.95); b.add(ped)
  const em = ctex(128, 128, (c: any, W: number, H: number) => { c.fillStyle = '#FFE9B8'; c.beginPath(); c.arc(W / 2, H / 2, 54, 0, 7); c.fill(); c.fillStyle = '#C47A00'; c.font = '900 70px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('₫', W / 2, H / 2 + 4) })
  screen(b, 0.8, 0.8, em, 0, 4.55, 2.26)
  RB(b, 1.0, 1.7, 0.12, 0.05, RBM.joint, 0, 0.66, 2.1)
  cyl(b, 0.04, 2.2, MAT.dark, 2.6, 0.5, 1.7, 8)
  const flag = mesh(new T.BoxGeometry(0.9, 0.5, 0.04), MAT.orange, 3.05, 2.4, 1.7); b.add(flag)
  glow(b, 0xFFD58A, 2.4, 0, 1.5, 2.3, 0.18)
  return b
}

/** Hộp thư: thân bán trụ, cửa, cờ cam, cột đỡ. */
export function mailbox(parent: any, x: number, y: number, z: number, ry = 0) {
  const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g)
  cyl(g, 0.2, 2.6, MAT.dark, 0, 0, 0, 16); cyl(g, 0.55, 0.14, MAT.navy, 0, 0, 0, 32)
  const tube = mesh(new T.CylinderGeometry(1.05, 1.05, 3.1, 40), MAT.navy, 0, 3.15, 0); tube.rotation.x = Math.PI / 2; g.add(tube)
  RB(g, 2.1, 1.1, 3.1, 0.3, MAT.navy, 0, 2.05, 0)
  const door = mesh(new T.CircleGeometry(1.0, 40), MAT.navyL, 0, 3.15, 1.56); g.add(door)
  RB(g, 1.4, 0.18, 0.06, 0.05, MAT.white, 0, 3.5, 1.58)
  const hd = mesh(new T.TorusGeometry(0.16, 0.04, 8, 20), MAT.gold, 0, 2.85, 1.6); g.add(hd)
  const flag = new T.Group(); flag.position.set(1.12, 3.0, 0.2); g.add(flag)
  RB(flag, 0.12, 1.8, 0.12, 0.05, MAT.orange, 0, 0, 0); RB(flag, 0.9, 0.55, 0.1, 0.05, MAT.orange, 0.45, 1.25, 0)
  return { g, flag }
}

/** Tủ máy chủ: mặt trước có khe thoáng, đèn trạng thái phát sáng. */
export function rack(parent: any, x: number, y: number, z: number, units = 3) {
  const g = new T.Group(); g.position.set(x, y, z); parent.add(g)
  const leds: any[] = []
  const front = ctex(256, 128, (c: any, W: number, H: number) => { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(11,42,111,.22)'; for (let i = 0; i < 6; i++) c.fillRect(24, 26 + i * 12, 120, 5) })
  for (let i = 0; i < units; i++) {
    RB(g, 2.8, 1.4, 2.8, 0.3, MAT.navy, 0, i * 1.5, 0)
    const fm = new T.Mesh(new T.PlaneGeometry(2.3, 1.0), new T.MeshBasicMaterial({ map: front, color: C(0x6E86D8), toneMapped: false, transparent: true, opacity: 0.35 })); fm.position.set(0, i * 1.5 + 0.7, 1.43); g.add(fm)
    for (let j = 0; j < 3; j++) {
      const col = j === 1 ? 0xFF6A2B : 0x3CC48B
      const led = new T.Mesh(new T.BoxGeometry(0.4, 0.1, 0.05), new T.MeshBasicMaterial({ color: C(col), toneMapped: false })); led.position.set(-0.85 + j * 0.85, i * 1.5 + 0.32, 1.45); g.add(led); leds.push(led)
      glow(g, col, 0.9, -0.85 + j * 0.85, i * 1.5 + 0.32, 1.6, 0.5)
    }
  }
  return { g, leds }
}

/** Cây tròn xinh: thân + tán nhiều tầng. */
export function tree(parent: any, x: number, y: number, z: number, s = 1, col = 0x2BAE73) {
  const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g)
  cyl(g, 0.12, 0.7, MAT.wood, 0, 0, 0, 10)
  const lm = M(col, { r: 0.6, cc: 0.1 })
  sph(g, 0.62, lm, 0, 1.0, 0); sph(g, 0.46, lm, 0.18, 1.55, 0.05)
  return g
}

/** Cột biểu đồ bo tròn, đầu có quầng sáng. */
export function bars(parent: any, x: number, y: number, z: number, n = 5) {
  const g = new T.Group(); g.position.set(x, y, z); parent.add(g)
  const items: any[] = []
  for (let i = 0; i < n; i++) {
    const m = i % 2 ? MAT.navy : MAT.orange
    const b = RB(g, 0.8, 3, 0.8, 0.3, m, i * 1.0, 0, i * 0.1)
    items.push(b)
    glow(g, i % 2 ? 0x4C6BD0 : 0xFF8A4C, 1.2, i * 1.0, 3.2 * (0.3 + 0.1 * i), i * 0.1, 0.3)
  }
  return { g, items }
}
