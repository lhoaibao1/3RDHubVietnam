// Kiểu "Nhà máy tự động": dữ liệu là những thùng hàng chạy trên băng chuyền qua các trạm xử lý
// (Advertiser → 3RDHub → Tracking → AI → Finance → Publisher), cánh tay robot, máy dập, cổng quét và đèn trạng thái.
import * as T from 'three'
import { PAL, createStage, dust, edges, glass, grid, iconSprite, label, lin, metal, neon, nightEnv, nightLights, rbox, winMat, type Key } from './kit'
import { chartTex } from './ecosystem'
import type { World } from './world'

interface St { id: string; name: string; sub: string; icon: string; color: number; x: number }
const STATIONS: St[] = [
  { id: 'advertiser', name: 'Advertiser', sub: 'Campaign intake', icon: 'building-2', color: PAL.orange, x: -18.75 },
  { id: 'hub', name: '3RDHub', sub: 'Core processing', icon: 'workflow', color: PAL.cyan, x: -11.25 },
  { id: 'tracking', name: 'Tracking', sub: 'Click · Postback scan', icon: 'radar', color: PAL.violet, x: -3.75 },
  { id: 'support', name: 'AI', sub: 'Smart routing', icon: 'brain-circuit', color: PAL.pink, x: 3.75 },
  { id: 'finance', name: 'Finance', sub: 'Reconcile · Commission', icon: 'wallet', color: PAL.gold, x: 11.25 },
  { id: 'publisher', name: 'Publisher', sub: 'Link distribution', icon: 'megaphone', color: PAL.mint, x: 18.75 },
]
const ALIAS: Record<string, string> = { customer: 'tracking', commission: 'finance', api: 'hub' }
const BELT_Y = 1.25

export function createFactory(canvas: HTMLCanvasElement): World {
  const st = createStage(canvas, { fov: 34, fog: [60, 190], bloom: 0.6, sky: ['#040A1C', '#0A1B45', '#10265E'] })
  const { scene } = st
  scene.environment = nightEnv()
  nightLights(scene)
  const root = new T.Group(); scene.add(root)
  grid(root, 200, PAL.blue, 0.01, 2)
  const hall = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshBasicMaterial({ color: lin(0x070E26), toneMapped: false })); hall.rotation.x = -Math.PI / 2; hall.position.y = -0.02; root.add(hall)

  /* ---- băng chuyền ---- */
  const beltTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d') as CanvasRenderingContext2D
    x.fillStyle = '#0C1738'; x.fillRect(0, 0, 128, 64); x.strokeStyle = '#2F7BFF'; x.lineWidth = 6; x.lineCap = 'round'
    for (const o of [0, 64]) { x.beginPath(); x.moveTo(o + 14, 12); x.lineTo(o + 40, 32); x.lineTo(o + 14, 52); x.stroke() }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(26, 1); t.encoding = T.sRGBEncoding; return t
  })()
  const belt = new T.Mesh(new T.BoxGeometry(52, 0.5, 3.2), new T.MeshStandardMaterial({ map: beltTex, emissiveMap: beltTex, emissive: new T.Color(0.6, 0.8, 1), emissiveIntensity: 0.8, roughness: 0.6, metalness: 0.2, color: lin(0xFFFFFF) }))
  belt.position.y = BELT_Y - 0.25; root.add(belt)
  for (const sz of [-1, 1]) {
    const rail = new T.Mesh(new T.BoxGeometry(52, 0.5, 0.3), metal(0x22336E, 0.3)); rail.position.set(0, BELT_Y, sz * 1.75); root.add(rail)
    const st2 = new T.Mesh(new T.BoxGeometry(52, 0.06, 0.08), neon(PAL.cyan, 1)); st2.position.set(0, BELT_Y + 0.28, sz * 1.75); root.add(st2)
    const fl = new T.Mesh(new T.BoxGeometry(52, 0.04, 0.35), neon(PAL.orange, 0.8)); fl.position.set(0, 0.04, sz * 4.4); root.add(fl)
  }
  for (let i = -4; i <= 4; i++) for (const sz of [-1, 1]) { const leg = new T.Mesh(new T.BoxGeometry(0.4, BELT_Y - 0.3, 0.4), metal(0x16275E)); leg.position.set(i * 6, (BELT_Y - 0.3) / 2, sz * 1.5); root.add(leg) }

  /* ---- thùng dữ liệu chạy trên băng chuyền, đổi màu sau mỗi trạm ---- */
  const zoneColors = [PAL.orange, PAL.cyan, PAL.cyan, PAL.violet, PAL.pink, PAL.gold, PAL.mint]
  const zoneAt = (x: number) => { let z = 0; for (const s of STATIONS) if (x > s.x) z++; return z }
  const boxGeo = new T.BoxGeometry(1.2, 1.2, 1.2), boxEdge = new T.EdgesGeometry(boxGeo)
  const crates = Array.from({ length: 16 }, (_, i) => {
    const mat = new T.MeshStandardMaterial({ color: lin(PAL.orange), emissive: lin(PAL.orange), emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 })
    const m = new T.Mesh(boxGeo, mat), lm = new T.LineBasicMaterial({ color: lin(PAL.white).multiplyScalar(1.3), toneMapped: false })
    m.add(new T.LineSegments(boxEdge, lm)); root.add(m)
    return { m, mat, off: i / 16 }
  })

  /* ---- các trạm ---- */
  const anchors: Record<string, T.Vector3> = {}
  const anim: ((t: number) => void)[] = []
  const lights: { mat: T.MeshBasicMaterial; ph: number }[] = []
  for (const s of STATIONS) {
    const g = new T.Group(); g.position.x = s.x; root.add(g)
    const big = s.id === 'hub'
    const H = big ? 8.4 : 6.2
    for (const sz of [-1, 1]) {
      const p = new T.Mesh(new T.BoxGeometry(1.1, H, 1.1), metal(0x1C2D66, 0.3)); p.position.set(0, H / 2, sz * 2.7); g.add(p)
      const cab = new T.Mesh(rbox(2.6, 2.4, 1.7, 0.3), glass(0x14216B, s.color, 0.3)); cab.position.set(0, 0, sz * 4.2); g.add(cab); const ce = edges(cab.geometry, s.color, 1.2); ce.position.copy(cab.position); g.add(ce)
      const led = new T.Mesh(new T.BoxGeometry(1.6, 0.12, 0.05), neon(s.color, 1.5)); led.position.set(0, 1.6, sz * 4.2 + (sz > 0 ? 0.88 : -0.88)); g.add(led)
      const pe = new T.Mesh(new T.BoxGeometry(0.1, H - 0.4, 0.1), neon(s.color, 1)); pe.position.set(0.6, H / 2, sz * 2.7); g.add(pe)
    }
    const beam = new T.Mesh(rbox(1.6, 1.3, 7, 0.4), glass(0x14216B, s.color, 0.35)); beam.rotation.y = 0; beam.position.y = H - 0.2; g.add(beam)
    const be = edges(beam.geometry, s.color, 1.3); be.position.copy(beam.position); g.add(be)
    const lamp = new T.MeshBasicMaterial({ color: lin(PAL.mint).multiplyScalar(1.6), toneMapped: false })
    const lm = new T.Mesh(new T.SphereGeometry(0.3, 12, 10), lamp); lm.position.set(0, H + 0.9, 0); g.add(lm); lights.push({ mat: lamp, ph: s.x })
    const ic = iconSprite(s.icon, 1.6); ic.position.y = H + 2.4; g.add(ic)
    const lb = label(s.name, s.color, 1.15, s.sub); lb.position.y = H + 4.2; g.add(lb)
    anchors[s.id] = new T.Vector3(s.x, H + 5.2, 0)

    if (s.id === 'advertiser') {
      const fun = new T.Mesh(new T.CylinderGeometry(2, 0.7, 2.4, 4, 1, true), glass(0x1A2A66, s.color, 0.5)); fun.material.side = T.DoubleSide; fun.rotation.y = Math.PI / 4; fun.position.y = 3.6; g.add(fun)
      const fe = new T.LineSegments(new T.EdgesGeometry(fun.geometry), new T.LineBasicMaterial({ color: lin(s.color).multiplyScalar(1.4), toneMapped: false })); fe.rotation.copy(fun.rotation); fe.position.copy(fun.position); g.add(fe)
      for (let i = 0; i < 6; i++) { const b = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: lin(0x3A2A1A), emissive: lin(s.color), emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.3 })); b.position.set(-1.2 + (i % 3) * 1.3, 0.6 + Math.floor(i / 3) * 1.25, -5.2); g.add(b); const e = new T.LineSegments(boxEdge, new T.LineBasicMaterial({ color: lin(s.color).multiplyScalar(1.3), toneMapped: false })); b.add(e) }
    } else if (s.id === 'hub') {
      const core = new T.Mesh(new T.IcosahedronGeometry(1.5, 1), new T.MeshStandardMaterial({ color: lin(0x1B3C9A), emissive: lin(PAL.cyan), emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.4, flatShading: true })); core.position.y = 4.8; g.add(core)
      const cw = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(1.95, 1)), new T.LineBasicMaterial({ color: lin(PAL.white).multiplyScalar(1.4), toneMapped: false })); cw.position.y = 4.8; g.add(cw)
      const rs = [PAL.orange, PAL.violet, PAL.cyan].map((c, i) => { const r = new T.Mesh(new T.TorusGeometry(2.4 + i * 0.4, 0.05, 6, 70), neon(c, 1)); r.position.y = 4.8; g.add(r); return r })
      const cone = new T.Mesh(new T.CylinderGeometry(0.2, 1.6, 3.2, 20, 1, true), new T.MeshBasicMaterial({ color: lin(PAL.cyan), transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false })); cone.position.y = 2.8; g.add(cone)
      const pl = new T.PointLight(PAL.cyan, 2, 18); pl.position.set(0, 4.8, 0); g.add(pl)
      anim.push((t) => { core.rotation.set(t * 0.5, t * 0.8, 0); cw.rotation.y = -t * 0.4; rs.forEach((r, i) => r.rotation.set(t * (0.5 + i * 0.3), t * (0.3 + i * 0.2), 0)) })
    } else if (s.id === 'tracking') {
      const plane = new T.Mesh(new T.PlaneGeometry(4.4, 3.6), new T.MeshBasicMaterial({ color: lin(PAL.violet).multiplyScalar(1.3), transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false }))
      plane.rotation.y = Math.PI / 2; plane.position.y = BELT_Y + 1.9; g.add(plane)
      const line = new T.Mesh(new T.BoxGeometry(0.06, 0.06, 4.4), neon(PAL.white, 1.6)); line.position.y = BELT_Y + 0.1; g.add(line)
      const cam = new T.Mesh(new T.SphereGeometry(0.5, 16, 12), metal(0x24377A, 0.25)); cam.position.set(0, H - 1, 0); g.add(cam)
      const eye = new T.Mesh(new T.CircleGeometry(0.22, 16), neon(PAL.violet, 1.8)); eye.position.set(0, H - 1.5, 0.0); eye.rotation.x = Math.PI / 2; g.add(eye)
      anim.push((t) => { const u = Math.sin(t * 1.8) * 1.5; plane.position.x = u; line.position.x = u })
    } else if (s.id === 'support') {
      const base = new T.Mesh(new T.CylinderGeometry(1, 1.3, 0.8, 20), metal(0x22336E, 0.3)); base.position.set(0, 0.4, -4.4); g.add(base)
      const sh = new T.Group(); sh.position.set(0, 1.2, -4.4); g.add(sh)
      const ball = new T.Mesh(new T.SphereGeometry(0.55, 16, 12), neon(PAL.pink, 1.2)); sh.add(ball)
      const up = new T.Group(); sh.add(up)
      const a1 = new T.Mesh(new T.BoxGeometry(0.55, 3.2, 0.55), metal(0x2B3F8A, 0.3)); a1.position.y = 1.6; up.add(a1)
      const el = new T.Group(); el.position.y = 3.2; up.add(el)
      el.add(new T.Mesh(new T.SphereGeometry(0.48, 16, 12), neon(PAL.pink, 1.2)))
      const a2 = new T.Mesh(new T.BoxGeometry(0.45, 3, 0.45), metal(0x2B3F8A, 0.3)); a2.position.y = 1.5; el.add(a2)
      const claw = new T.Mesh(new T.BoxGeometry(1.1, 0.25, 0.5), neon(PAL.pink, 1)); claw.position.y = 3.1; el.add(claw)
      const core = new T.Mesh(new T.BoxGeometry(1.3, 1.3, 1.3), new T.MeshStandardMaterial({ color: lin(0x3A1650), emissive: lin(PAL.pink), emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 })); core.position.set(0, H - 2.2, 0); g.add(core); core.add(edges(core.geometry, PAL.white, 1.4))
      anim.push((t) => { const k = 0.5 + 0.5 * Math.sin(t * 1.4); sh.rotation.x = -(0.2 + k * 0.85); el.rotation.x = -0.4 + k * 1.0 - 0.3; core.rotation.set(t * 0.8, t * 0.6, 0) })
    } else if (s.id === 'finance') {
      const press = new T.Mesh(rbox(3.2, 1.4, 3.2, 0.3), glass(0x1A2A66, s.color, 0.6)); g.add(press)
      const rod = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 3, 10), metal(0x7C91D6, 0.2)); g.add(rod)
      const coins: T.Mesh[] = []
      for (let i = 0; i < 8; i++) { const c = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 0.16, 20), new T.MeshStandardMaterial({ color: lin(PAL.gold), metalness: 0.9, roughness: 0.22, emissive: lin(PAL.gold), emissiveIntensity: 0.3 })); c.position.set(0, 0.1 + i * 0.17, 5.4); coins.push(c); g.add(c) }
      anim.push((t) => { const k = 0.5 + 0.5 * Math.sin(t * 2.2); press.position.y = BELT_Y + 1.1 + k * 2.4; rod.position.y = press.position.y + 1.8; coins.forEach((c, i) => { c.visible = i < 3 + Math.floor(((t * 0.8) % 1) * 5); c.rotation.y = t + i }) })
    } else if (s.id === 'publisher') {
      const mast = new T.Mesh(new T.CylinderGeometry(0.1, 0.25, 5, 8), metal(0x6F86C9, 0.3)); mast.position.set(0, 2.5, -4.6); g.add(mast)
      const tip = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), neon(PAL.mint, 1.6)); tip.position.set(0, 5.2, -4.6); g.add(tip)
      const waves = [0, 1, 2].map(() => { const m = new T.Mesh(new T.TorusGeometry(1, 0.05, 6, 40), new T.MeshBasicMaterial({ color: lin(PAL.mint).multiplyScalar(1.4), transparent: true, toneMapped: false, depthWrite: false })); m.position.set(0, 5.2, -4.6); g.add(m); return m })
      const ship: T.Mesh[] = Array.from({ length: 6 }, () => { const m = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), neon(PAL.mint, 1.5)); g.add(m); return m })
      anim.push((t) => { waves.forEach((w, i) => { const u = (t * 0.45 + i / 3) % 1; w.scale.setScalar(0.5 + u * 3.2); (w.material as T.MeshBasicMaterial).opacity = 1 - u }); ship.forEach((m, i) => { const u = (t * 0.25 + i / 6) % 1; m.position.set(Math.sin(i * 2.1) * 0.6 + u * 4, BELT_Y + 1 + u * 7, 0); m.scale.setScalar(1 - u * 0.8) }) })
    }
  }

  /* ---- phông nền: tường nhà xưởng, cột, bảng số liệu ---- */
  const wm = winMat(2, 48, 14, 0x08122E, 0.2); wm.emissiveIntensity = 0.4
  const wall = new T.Mesh(new T.BoxGeometry(150, 34, 1), wm); wall.position.set(0, 16, -20); root.add(wall)
  const wallTex = (wall.material as T.MeshStandardMaterial).map as T.Texture; wallTex.repeat.set(1, 1)
  for (const [i, x] of [-24, -8, 8, 24].entries()) {
    const c = [PAL.cyan, PAL.violet, PAL.orange, PAL.mint][i]
    const p = new T.Mesh(new T.PlaneGeometry(11, 6.4), new T.MeshBasicMaterial({ map: chartTex('#' + new T.Color(c).getHexString(), 5 + i), transparent: true, opacity: 0.95, toneMapped: false, fog: false })); p.position.set(x, 12 + (i % 2) * 2, -19); root.add(p)
    p.add(new T.LineSegments(new T.EdgesGeometry(p.geometry), new T.LineBasicMaterial({ color: lin(c).multiplyScalar(1.4), toneMapped: false })))
  }
  for (let i = 0; i < 11; i++) { const p = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 34, 10), metal(0x1C2D66, 0.4)); p.position.set(-50 + i * 10, 17, -18.5); root.add(p); const s = new T.Mesh(new T.BoxGeometry(0.1, 34, 0.1), neon(PAL.cyan, 0.8)); s.position.set(-50 + i * 10, 17, -17.9); root.add(s) }
  const dustTick = dust(root, 160, [90, 20, 40], [0, 8, 0], 0x8FB4FF, 4)

  st.onTick((t, dt) => {
    beltTex.offset.x -= dt * 0.07
    crates.forEach((c) => {
      const x = -25 + ((t * 3 / 50 + c.off) % 1) * 50
      c.m.position.set(x, BELT_Y + 0.6, 0); c.m.rotation.y = 0
      const col = zoneColors[zoneAt(x)]; c.mat.color.copy(lin(col).multiplyScalar(0.5)); c.mat.emissive.copy(lin(col))
    })
    lights.forEach((l) => l.mat.color.copy(lin(Math.sin(t * 3 + l.ph) > 0.7 ? PAL.orange : PAL.mint)).multiplyScalar(1.6))
    anim.forEach((f) => f(t)); dustTick(t)
  })

  const keys: Record<string, Key> = { overview: { pos: [1, 9.5, 47], look: [0, 3, 0], fov: 36 } }
  for (const s of STATIONS) keys[s.id] = { pos: [s.x + 3, 8, 22], look: [s.x, 3.4, 0], fov: 32 }
  keys.hub = { pos: [-11.25 + 3, 10, 27], look: [-11.25, 4.5, 0], fov: 32 }
  st.fly(keys.overview, true)

  return {
    focus(k, fast) { st.fly(keys[ALIAS[k] || k] || keys.overview, fast) },
    anchor(k) { return anchors[ALIAS[k] || k] || null },
    project: st.project, visible: st.visible, dispose: st.dispose,
  }
}
