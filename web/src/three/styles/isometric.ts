// Kiểu "Vận hành đẳng cự": cả hệ thống là một hòn đảo nổi nhìn theo góc isometric, mỗi module là một khối công trình
// (Advertiser, Tracking, API, Publisher, Finance, AI) nối với trụ 3RDHub ở giữa bằng đường dữ liệu có hạt chạy.
import * as T from 'three'
import { PAL, createStage, dust, edges, glass, iconSprite, label, lin, metal, neon, nightEnv, nightLights, packets, rbox, winMat, type Key } from './kit'
import type { World } from './world'

interface NodeDef { id: string; name: string; sub: string; icon: string; color: number; x: number; z: number }
const NODES: NodeDef[] = [
  { id: 'advertiser', name: 'Advertiser', sub: 'Campaigns', icon: 'building-2', color: PAL.orange, x: -13, z: 0 },
  { id: 'tracking', name: 'Tracking', sub: 'Click · Postback', icon: 'radar', color: PAL.cyan, x: -6.5, z: -9 },
  { id: 'api', name: 'API', sub: 'Partner API', icon: 'workflow', color: PAL.violet, x: 6.5, z: -9 },
  { id: 'publisher', name: 'Publisher', sub: 'Share links', icon: 'megaphone', color: PAL.mint, x: 13, z: 0 },
  { id: 'finance', name: 'Finance', sub: 'Commission wallet', icon: 'wallet', color: PAL.gold, x: 6.5, z: 9 },
  { id: 'support', name: 'AI', sub: 'Smart support', icon: 'brain-circuit', color: PAL.pink, x: -6.5, z: 9 },
]
const ALIAS: Record<string, string> = { customer: 'tracking', commission: 'finance' }
const css = (c: number) => '#' + new T.Color(c).getHexString()

function floorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d') as CanvasRenderingContext2D
  x.fillStyle = '#0B1B4A'; x.fillRect(0, 0, 256, 256)
  x.fillStyle = '#10265E'; x.fillRect(0, 0, 128, 128); x.fillRect(128, 128, 128, 128)
  x.strokeStyle = 'rgba(90,150,255,.55)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 253, 253)
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.encoding = T.sRGBEncoding
  return t
}

export function createIsometric(canvas: HTMLCanvasElement): World {
  const st = createStage(canvas, { fov: 16, fog: [150, 380], bloom: 0.55, sky: ['#030816', '#0A1B45', '#14337A'] })
  const { scene } = st
  scene.environment = nightEnv()
  nightLights(scene)
  const root = new T.Group(); scene.add(root)

  /* ---- hòn đảo nổi ---- */
  const slabGeo = rbox(42, 1.4, 32, 1.4)
  const slab = new T.Mesh(slabGeo, glass(0x0A1840, 0x0B2A6F, 0.5)); slab.position.y = -1.4; root.add(slab)
  const slabEdge = edges(slabGeo, PAL.cyan, 1.1); slabEdge.position.y = -1.4; root.add(slabEdge)
  const ft = floorTex(); ft.repeat.set(21 / 2, 16 / 2)
  const floor = new T.Mesh(new T.PlaneGeometry(40.4, 30.4), new T.MeshBasicMaterial({ map: ft, color: new T.Color(0.55, 0.62, 0.8), toneMapped: false }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; root.add(floor)
  const under = new T.Mesh(new T.ConeGeometry(22, 14, 4, 1), glass(0x081333, 0x0B2A6F, 0.35)); under.rotation.y = Math.PI / 4; under.rotation.x = Math.PI; under.position.y = -9.2; under.scale.set(1.05, 1, 0.8); root.add(under)
  const underEdge = new T.LineSegments(new T.EdgesGeometry(under.geometry), new T.LineBasicMaterial({ color: lin(PAL.blue).multiplyScalar(1.1), toneMapped: false })); underEdge.rotation.copy(under.rotation); underEdge.position.copy(under.position); underEdge.scale.copy(under.scale); root.add(underEdge)

  /* ---- đường dữ liệu: trục ngang z=0 + bốn nhánh ---- */
  const strip = (a: T.Vector3, b: T.Vector3, color: number) => {
    const d = b.clone().sub(a), len = d.length()
    const m = new T.Mesh(new T.BoxGeometry(Math.abs(d.x) > Math.abs(d.z) ? len + 0.5 : 0.5, 0.1, Math.abs(d.x) > Math.abs(d.z) ? 0.5 : len + 0.5), neon(color, 0.5))
    m.position.copy(a.clone().add(b).multiplyScalar(0.5)); m.position.y = 0.08; root.add(m)
    const core = m.clone(); core.material = neon(color, 1.2); core.scale.set(Math.abs(d.x) > Math.abs(d.z) ? 1 : 0.28, 1.2, Math.abs(d.x) > Math.abs(d.z) ? 0.28 : 1); root.add(core)
  }
  const v = (x: number, z: number, y = 0.4) => new T.Vector3(x, y, z)
  const path = (pts: T.Vector3[]) => { const p = new T.CurvePath<T.Vector3>(); for (let i = 1; i < pts.length; i++) p.add(new T.LineCurve3(pts[i - 1], pts[i])); return p }
  strip(v(-13, 0), v(13, 0), PAL.blue)
  const flows: ((t: number) => void)[] = []
  for (const n of NODES) {
    if (n.z !== 0) strip(v(n.x, n.z), v(n.x, 0), n.color)
    const inbound = n.id === 'advertiser' || n.id === 'tracking' || n.id === 'api'
    const pts = n.z === 0 ? [v(n.x, 0), v(0, 0)] : [v(n.x, n.z), v(n.x, 0), v(0, 0)]
    const p = inbound ? path(pts) : path(pts.slice().reverse())
    flows.push(packets(root, p, 3, n.color, 0.3, 0.1, new T.BoxGeometry(0.6, 0.6, 0.6)))
  }

  /* ---- trụ 3RDHub ---- */
  const hub = new T.Group(); root.add(hub)
  const hp = new T.Mesh(new T.CylinderGeometry(4.2, 4.6, 0.5, 8), glass(0x0A1840, 0x0B2A6F, 0.5)); hp.position.y = 0.2; hub.add(hp)
  const hpr = new T.Mesh(new T.TorusGeometry(4.3, 0.07, 8, 8), neon(PAL.cyan, 1.1)); hpr.rotation.x = Math.PI / 2; hpr.rotation.z = Math.PI / 8; hpr.position.y = 0.46; hub.add(hpr)
  const tw = new T.Mesh(new T.CylinderGeometry(1.5, 2.2, 6, 8), glass(0x0C1E55, PAL.cyan, 0.25)); tw.position.y = 3.4; hub.add(tw)
  const twe = edges(tw.geometry, PAL.cyan, 1.3); twe.position.copy(tw.position); hub.add(twe)
  for (const y of [1.6, 3.2, 4.8]) { const r = new T.Mesh(new T.TorusGeometry(1.5 + (6.4 - y) * 0.11, 0.05, 6, 8), neon(PAL.cyan, 1)); r.rotation.x = Math.PI / 2; r.rotation.z = Math.PI / 8; r.position.y = y; hub.add(r) }
  const crystal = new T.Mesh(new T.OctahedronGeometry(1.5, 0), new T.MeshStandardMaterial({ color: lin(0x1B3C9A), emissive: lin(PAL.cyan), emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.4, flatShading: true })); crystal.position.y = 8.6; crystal.scale.y = 1.4; hub.add(crystal)
  const cw = new T.LineSegments(new T.EdgesGeometry(new T.OctahedronGeometry(1.9, 0)), new T.LineBasicMaterial({ color: lin(PAL.white).multiplyScalar(1.4), toneMapped: false })); cw.position.y = 8.6; cw.scale.y = 1.4; hub.add(cw)
  const hubRings = [PAL.orange, PAL.violet].map((c, i) => { const m = new T.Mesh(new T.TorusGeometry(2.6 + i * 0.7, 0.06, 8, 80), neon(c, 1)); m.position.y = 8.6; m.rotation.x = Math.PI / 2.6; hub.add(m); return m })
  const hl = new T.PointLight(PAL.cyan, 2, 24); hl.position.set(0, 8, 0); hub.add(hl)
  const hlb = label('3RDHub', PAL.cyan, 1.7, 'Core platform'); hlb.position.set(0, 12.2, 0); hub.add(hlb)

  /* ---- các khối module ---- */
  const anchors: Record<string, T.Vector3> = { hub: new T.Vector3(0, 13.2, 0) }
  const spinners: ((t: number) => void)[] = []
  const wedgeTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d') as CanvasRenderingContext2D; const g = x.createLinearGradient(0, 32, 64, 32); g.addColorStop(0, 'rgba(39,211,255,.85)'); g.addColorStop(1, 'rgba(39,211,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c) })()
  for (const n of NODES) {
    const g = new T.Group(); g.position.set(n.x, 0, n.z); root.add(g)
    const pad = new T.Mesh(rbox(6.6, 0.5, 6.6, 0.45), glass(0x0A1840, 0x0B2A6F, 0.5)); pad.position.y = 0.02; g.add(pad)
    const pe = edges(pad.geometry, n.color, 1.4); pe.position.y = 0.02; g.add(pe)
    let top = 3
    if (n.id === 'advertiser') {
      const b1 = new T.Mesh(new T.BoxGeometry(2.6, 5, 2.6), winMat(5, 4, 16)); b1.position.set(-0.8, 3, 0); g.add(b1)
      const b2 = new T.Mesh(new T.BoxGeometry(1.8, 3, 2.2), winMat(8, 3, 9)); b2.position.set(1.5, 2, 0.4); g.add(b2)
      const cap = new T.Mesh(new T.BoxGeometry(2.9, 0.18, 2.9), neon(n.color, 1.3)); cap.position.set(-0.8, 5.6, 0); g.add(cap)
      top = 6
    } else if (n.id === 'tracking') {
      const tr = new T.Mesh(new T.CylinderGeometry(0.8, 1.1, 2.6, 12), metal(0x16275E)); tr.position.y = 1.55; g.add(tr)
      const dish = new T.Mesh(new T.CylinderGeometry(1.7, 0.25, 0.5, 20, 1, true), glass(0x0C1E55, n.color, 0.5)); dish.position.y = 3.2; dish.material.side = T.DoubleSide; g.add(dish)
      const sweep = new T.Mesh(new T.CircleGeometry(3, 20, 0, 0.9), new T.MeshBasicMaterial({ map: wedgeTex, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false }))
      sweep.rotation.x = -Math.PI / 2; sweep.position.y = 0.4; g.add(sweep)
      const ring = new T.Mesh(new T.TorusGeometry(3, 0.04, 6, 60), neon(n.color, 1)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; g.add(ring)
      spinners.push((t) => { sweep.rotation.z = -t * 1.6 })
      top = 4
    } else if (n.id === 'api') {
      for (let i = 0; i < 4; i++) {
        const s = new T.Mesh(rbox(3.4, 0.7, 2.6, 0.2), glass(0x14216B, n.color, 0.25)); s.position.y = 0.8 + i * 0.95; g.add(s)
        const e = edges(s.geometry, n.color, 1.2); e.position.copy(s.position); g.add(e)
        for (let j = 0; j < 3; j++) { const led = new T.Mesh(new T.BoxGeometry(0.22, 0.12, 0.05), neon(j === 0 ? PAL.mint : n.color, 1.6)); led.position.set(-1.1 + j * 0.45, s.position.y + 0.1, 1.33); g.add(led) }
        const plug = new T.Mesh(new T.BoxGeometry(0.5, 0.35, 0.6), metal(0x2A3C7A)); plug.position.set(i % 2 ? 1.9 : -1.9, s.position.y, 0); g.add(plug)
      }
      top = 4.8
    } else if (n.id === 'publisher') {
      const bs = new T.Mesh(new T.BoxGeometry(2.4, 1.4, 2.4), winMat(12, 3, 5, 0x0B1740, 0.1)); bs.position.set(0, 1, 0.9); g.add(bs)
      const mast = new T.Mesh(new T.CylinderGeometry(0.1, 0.22, 5, 8), metal(0x6F86C9, 0.3)); mast.position.set(0, 3, -0.6); g.add(mast)
      const tip = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), neon(n.color, 1.6)); tip.position.set(0, 5.6, -0.6); g.add(tip)
      const waves = [0, 1, 2].map(() => { const m = new T.Mesh(new T.TorusGeometry(1, 0.05, 6, 40), new T.MeshBasicMaterial({ color: lin(n.color).multiplyScalar(1.4), transparent: true, toneMapped: false, depthWrite: false })); m.rotation.x = Math.PI / 2; m.position.set(0, 5.6, -0.6); g.add(m); return m })
      spinners.push((t) => waves.forEach((w, i) => { const u = (t * 0.45 + i / 3) % 1; w.scale.setScalar(0.5 + u * 3.2); (w.material as T.MeshBasicMaterial).opacity = 1 - u }))
      top = 6.4
    } else if (n.id === 'finance') {
      const bank = new T.Mesh(new T.BoxGeometry(3.4, 2, 2.4), glass(0x1A2A66, n.color, 0.2)); bank.position.set(-0.4, 1.3, -0.3); g.add(bank)
      for (let i = 0; i < 4; i++) { const c = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 2, 10), neon(n.color, 0.9)); c.position.set(-1.6 + i * 0.95, 1.3, 1.0); g.add(c) }
      const roof = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 3.8, 3), glass(0x1A2A66, n.color, 0.4)); roof.rotation.z = Math.PI / 2; roof.rotation.y = 0; roof.scale.set(0.35, 1, 0.8); roof.position.set(-0.4, 2.7, -0.3); roof.rotation.set(0, 0, Math.PI / 2); g.add(roof)
      for (let i = 0; i < 3; i++) { const cs = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.14 * (3 + i), 18), new T.MeshStandardMaterial({ color: lin(PAL.gold), metalness: 0.9, roughness: 0.25, emissive: lin(PAL.gold), emissiveIntensity: 0.25 })); cs.position.set(1.9, 0.35 + 0.07 * (3 + i), -1.6 + i * 1.1); g.add(cs) }
      const coin = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 0.14, 24), new T.MeshStandardMaterial({ color: lin(PAL.gold), metalness: 0.9, roughness: 0.2, emissive: lin(PAL.gold), emissiveIntensity: 0.5 })); coin.position.set(0, 4.6, 0); coin.rotation.z = Math.PI / 2; g.add(coin)
      spinners.push((t) => { coin.rotation.y = t * 2; coin.position.y = 4.6 + Math.sin(t * 1.6) * 0.2 })
      top = 5.4
    } else {
      const chip = new T.Mesh(rbox(4.4, 0.45, 4.4, 0.25), metal(0x16275E, 0.4)); chip.position.y = 0.55; g.add(chip)
      const ce = edges(chip.geometry, n.color, 1.2); ce.position.copy(chip.position); g.add(ce)
      for (let i = 0; i < 9; i++) for (const sd of [-1, 1]) { const p1 = new T.Mesh(new T.BoxGeometry(0.16, 0.1, 0.36), neon(n.color, 0.8)); p1.position.set(-1.8 + i * 0.45, 0.6, sd * 2.4); g.add(p1); const p2 = new T.Mesh(new T.BoxGeometry(0.36, 0.1, 0.16), neon(n.color, 0.8)); p2.position.set(sd * 2.4, 0.6, -1.8 + i * 0.45); g.add(p2) }
      const core = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), new T.MeshStandardMaterial({ color: lin(0x3A1650), emissive: lin(n.color), emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 })); core.position.y = 2.4; g.add(core)
      const cw2 = edges(core.geometry, PAL.white, 1.5); core.add(cw2)
      const orb = new T.Mesh(new T.TorusGeometry(1.5, 0.05, 6, 50), neon(n.color, 1)); orb.position.y = 2.4; g.add(orb)
      spinners.push((t) => { core.rotation.set(t * 0.7, t * 0.9, 0); core.position.y = 2.4 + Math.sin(t * 1.5) * 0.15; orb.rotation.set(t * 0.6, t * 0.4, 0) })
      top = 4.4
    }
    const ic = iconSprite(n.icon, 1.5); ic.position.y = top + 0.9; g.add(ic)
    const lb = label(n.name, n.color, 1.05, n.sub); lb.position.y = top + 2.6; g.add(lb)
    anchors[n.id] = new T.Vector3(n.x, top + 3.6, n.z)
  }

  const dustTick = dust(root, 160, [90, 40, 70], [0, 10, 0], 0x8FB4FF, 4)
  st.onTick((t) => {
    crystal.rotation.y = t * 0.8; cw.rotation.y = t * 0.8; crystal.position.y = cw.position.y = 8.6 + Math.sin(t * 1.3) * 0.2
    hubRings.forEach((m, i) => { m.rotation.z = t * (0.4 + i * 0.25); m.position.y = crystal.position.y })
    spinners.forEach((f) => f(t)); flows.forEach((f) => f(t)); dustTick(t)
  })

  const D = new T.Vector3(1, 0.82, 1).normalize()
  const at = (look: [number, number, number], L: number, fov: number): Key => ({ pos: [look[0] + D.x * L, look[1] + D.y * L, look[2] + D.z * L], look, fov })
  const keys: Record<string, Key> = { overview: at([0, 2, 0], 150, 16), hub: at([0, 5, 0], 92, 16) }
  for (const n of NODES) keys[n.id] = at([n.x * 0.97, 2.4, n.z * 0.97], 92, 16)
  st.fly(keys.overview, true)

  return {
    focus(k, fast) { st.fly(keys[ALIAS[k] || k] || keys.overview, fast) },
    anchor(k) { return anchors[ALIAS[k] || k] || null },
    project: st.project, visible: st.visible, dispose: st.dispose,
  }
}
