// Kiểu "Hệ sinh thái số": 3RDHub là lõi phát sáng ở giữa, xung quanh là các nút Advertiser, Publisher, Tracking, Finance, API, AI
// nối bằng tia sáng có hạt dữ liệu chạy, nền trung tâm dữ liệu và bảng điều khiển hình ba chiều.
import * as T from 'three'
import { PAL, beam, createStage, dust, edges, glass, grid, iconTex, label, lin, metal, nightEnv, nightLights, neon, packets, rbox, type Key } from './kit'
import type { World } from './world'

interface NodeDef { id: string; name: string; sub: string; icon: string; color: number; pos: [number, number, number] }
const NODES: NodeDef[] = [
  { id: 'advertiser', name: 'Advertiser', sub: 'Campaigns', icon: 'building-2', color: PAL.orange, pos: [-13, 2.2, 0] },
  { id: 'tracking', name: 'Tracking', sub: 'Click · Postback', icon: 'radar', color: PAL.cyan, pos: [-6.5, 3.4, -11.3] },
  { id: 'api', name: 'API', sub: 'Partner API', icon: 'workflow', color: PAL.violet, pos: [6.5, 3.4, -11.3] },
  { id: 'publisher', name: 'Publisher', sub: 'Share links', icon: 'megaphone', color: PAL.mint, pos: [13, 2.2, 0] },
  { id: 'finance', name: 'Finance', sub: 'Commission wallet', icon: 'wallet', color: PAL.gold, pos: [6.5, 2.6, 11.3] },
  { id: 'support', name: 'AI', sub: 'Smart support', icon: 'brain-circuit', color: PAL.pink, pos: [-6.5, 2.6, 11.3] },
]
/** Các bước ở trang chủ ánh xạ vào nút: khách hàng → Tracking, hoa hồng → Finance. */
const ALIAS: Record<string, string> = { customer: 'tracking', commission: 'finance' }

export function chartTex(color: string, seed: number) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 300
  const x = c.getContext('2d') as CanvasRenderingContext2D
  x.fillStyle = 'rgba(8,20,60,.85)'; x.fillRect(0, 0, 512, 300)
  x.strokeStyle = 'rgba(120,160,255,.25)'; x.lineWidth = 2
  for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(20, i * 55); x.lineTo(492, i * 55); x.stroke() }
  x.strokeStyle = color; x.lineWidth = 6; x.lineJoin = 'round'; x.beginPath()
  let s = seed; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < 12; i++) { const px = 24 + i * 40, py = 240 - (40 + i * 11 + r() * 50); i ? x.lineTo(px, py) : x.moveTo(px, py) }
  x.stroke()
  x.fillStyle = color; x.globalAlpha = 0.14; x.lineTo(464, 260); x.lineTo(24, 260); x.fill(); x.globalAlpha = 1
  x.fillStyle = '#EAF2FF'; x.font = '800 34px "Nunito",sans-serif'; x.fillText('+18%  ·  12.450.000đ', 24, 44)
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t
}

export function createEcosystem(canvas: HTMLCanvasElement): World {
  const st = createStage(canvas, { fov: 32, fog: [45, 150], bloom: 0.6 })
  const { scene } = st
  scene.environment = nightEnv()
  nightLights(scene)
  const root = new T.Group(); scene.add(root)
  grid(root, 120, PAL.blue, -0.6, 3)

  /* ---- lõi 3RDHub ---- */
  const hub = new T.Group(); root.add(hub)
  const base = new T.Mesh(new T.CylinderGeometry(6.2, 6.8, 0.7, 64), glass(0x0A1840, 0x0B2A6F, 0.6)); base.position.y = -0.2; hub.add(base)
  for (const [r, c, k] of [[6.15, PAL.cyan, 1], [4.6, PAL.violet, 0.8]] as [number, number, number][]) {
    const ring = new T.Mesh(new T.TorusGeometry(r, 0.06, 8, 120), neon(c, k)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; hub.add(ring)
  }
  const core = new T.Mesh(new T.IcosahedronGeometry(2.1, 1), new T.MeshStandardMaterial({ color: lin(0x1B3C9A), emissive: lin(PAL.cyan), emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.4, flatShading: true }))
  core.position.y = 4; hub.add(core)
  const wire = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(2.6, 1)), new T.LineBasicMaterial({ color: lin(PAL.white).multiplyScalar(1.4), toneMapped: false })); wire.position.y = 4; hub.add(wire)
  const rings: T.Mesh[] = []
  ;([[3.7, PAL.cyan, 0], [4.5, PAL.orange, 1], [5.3, PAL.violet, 2]] as [number, number, number][]).forEach(([r, c, i]) => {
    const m = new T.Mesh(new T.TorusGeometry(r, 0.07, 8, 100), neon(c, 1)); m.position.y = 4; m.rotation.set(i * 1.1, i * 0.7, 0); hub.add(m); rings.push(m)
  })
  const beamTex = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d') as CanvasRenderingContext2D; const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(120,220,255,.9)'); g.addColorStop(1, 'rgba(120,220,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); return new T.CanvasTexture(c) })()
  const col = new T.Mesh(new T.CylinderGeometry(1.1, 2.6, 18, 32, 1, true), new T.MeshBasicMaterial({ map: beamTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false, opacity: 0.28, fog: false })); col.position.y = 9; hub.add(col)
  const hubLabel = label('3RDHub', PAL.cyan, 1.9, 'Core platform'); hubLabel.position.set(0, 9.6, 0); hub.add(hubLabel)
  const hl = new T.PointLight(PAL.cyan, 2.2, 30); hl.position.set(0, 4, 0); hub.add(hl)

  /* ---- các nút ---- */
  const anchors: Record<string, T.Vector3> = { hub: new T.Vector3(0, 11, 0) }
  const floaters: { g: T.Group; y0: number; ph: number; cube: T.Mesh }[] = []
  const flows: ((t: number) => void)[] = []
  for (const n of NODES) {
    const g = new T.Group(); g.position.set(...n.pos); root.add(g)
    const plate = new T.Mesh(new T.CylinderGeometry(2.6, 2.9, 0.4, 40), glass(0x0A1840, 0x0B2A6F, 0.5)); plate.position.y = -n.pos[1] + 0.2 - 0.6; g.add(plate)
    const ringP = new T.Mesh(new T.TorusGeometry(2.7, 0.05, 8, 60), neon(n.color, 1)); ringP.rotation.x = Math.PI / 2; ringP.position.y = plate.position.y + 0.22; g.add(ringP)
    const stem = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, n.pos[1] + 0.2, 6), neon(n.color, 0.6)); stem.position.y = -n.pos[1] / 2 - 0.4; g.add(stem)
    const geo = rbox(2.8, 2.8, 2.8, 0.45)
    const cube = new T.Mesh(geo, glass(0x0C1E55, n.color, 0.35)); cube.position.y = -1.4; g.add(cube)
    const ed = edges(geo, n.color, 1.5); ed.position.y = -1.4; cube.add(ed); ed.position.set(0, 0, 0)
    const ic = new T.Sprite(new T.SpriteMaterial({ map: iconTex(n.icon, '#FFFFFF'), transparent: true, depthWrite: false, toneMapped: false, fog: false })); ic.scale.set(1.9, 1.9, 1); ic.position.y = 0.0; g.add(ic)
    const lb = label(n.name, n.color, 1.25, n.sub); lb.position.y = 2.7; g.add(lb)
    anchors[n.id] = new T.Vector3(n.pos[0], n.pos[1] + 3.6, n.pos[2])
    floaters.push({ g, y0: n.pos[1], ph: n.pos[0], cube })
    /* tia nối từ nút về lõi, hạt chạy hai chiều */
    const a = new T.Vector3(n.pos[0] * 0.8, n.pos[1] - 1.2, n.pos[2] * 0.8)
    const mid = new T.Vector3(n.pos[0] * 0.45, 7 + Math.abs(n.pos[2]) * 0.08, n.pos[2] * 0.45)
    const dir = new T.Vector3(n.pos[0], 0, n.pos[2]).normalize(); const b = new T.Vector3(dir.x * 2.9, 4 + 0.3, dir.z * 2.9)
    const curve = beam(root, [a, mid, b], n.color, 0.05)
    flows.push(packets(root, curve, 4, n.color, 0.2, 0.09))
    const back = new T.CatmullRomCurve3([b, mid, a])
    flows.push(packets(root, back, 2, PAL.white, 0.14, 0.07))
  }

  /* ---- nền: trung tâm dữ liệu, cột dữ liệu, bảng điều khiển ---- */
  const winTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d') as CanvasRenderingContext2D; x.fillStyle = '#05102C'; x.fillRect(0, 0, 64, 128); let s = 3; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280); for (let j = 0; j < 16; j++) for (let i = 0; i < 4; i++) if (r() < 0.45) { x.fillStyle = r() < 0.3 ? '#FF9A5C' : '#4FD8FF'; x.fillRect(4 + i * 15, 4 + j * 8, 9, 3) } const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t })()
  const rackMat = new T.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: new T.Color(0xFFFFFF), emissiveIntensity: 1.1, color: lin(0x0B1740), roughness: 0.5, metalness: 0.3 })
  let s0 = 11; const rn = () => ((s0 = (s0 * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < 46; i++) {
    const a = Math.PI * (0.92 + (i / 46) * 1.16), r = 46 + rn() * 14, h = 8 + rn() * 22
    const m = new T.Mesh(new T.BoxGeometry(3.2 + rn() * 2, h, 3.2), rackMat); m.position.set(Math.cos(a) * r, h / 2 - 0.6, Math.sin(a) * r - 6); m.rotation.y = -a; root.add(m)
  }
  const cols: T.Mesh[] = []
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (1.05 + rn() * 0.9), r = 24 + rn() * 16
    const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 30, 4), neon(rn() < 0.5 ? PAL.cyan : PAL.violet, 0.7)); m.position.set(Math.cos(a) * r, 14, Math.sin(a) * r - 4); root.add(m); cols.push(m)
  }
  const panels: T.Mesh[] = []
  ;([[-24, 12, -20, 0.5, '#27D3FF'], [24, 13, -22, -0.5, '#FF7A3C'], [0, 17, -34, 0, '#8A5BFF']] as [number, number, number, number, string][]).forEach(([x, y, z, ry, c], i) => {
    const p = new T.Mesh(new T.PlaneGeometry(10, 5.9), new T.MeshBasicMaterial({ map: chartTex(c, 7 + i), transparent: true, opacity: 0.92, toneMapped: false, fog: false })); p.position.set(x, y, z); p.rotation.y = ry; root.add(p); panels.push(p)
    const fr = new T.LineSegments(new T.EdgesGeometry(p.geometry), new T.LineBasicMaterial({ color: lin(new T.Color(c).getHex()).multiplyScalar(1.4), toneMapped: false })); p.add(fr)
  })
  const dustTick = dust(root, 220, [90, 40, 90], [0, 12, 0])

  st.onTick((t) => {
    core.rotation.y = t * 0.5; core.rotation.x = Math.sin(t * 0.4) * 0.2; wire.rotation.y = -t * 0.3
    rings.forEach((m, i) => { m.rotation.x += 0.004 * (i + 1); m.rotation.y += 0.003 * (3 - i) })
    col.rotation.y = t * 0.3
    floaters.forEach((f) => { f.g.position.y = f.y0 + Math.sin(t * 1.2 + f.ph) * 0.35; f.cube.rotation.y = t * 0.4 + f.ph })
    flows.forEach((f) => f(t)); dustTick(t)
    cols.forEach((m, i) => { (m.material as T.MeshBasicMaterial).opacity = 1 })
    panels.forEach((p, i) => { p.position.y += Math.sin(t * 0.8 + i) * 0.003 })
  })

  const keys: Record<string, Key> = {
    overview: { pos: [0, 19, 60], look: [0, 4, 0], fov: 32 },
    hub: { pos: [0, 10, 31], look: [0, 5, 0], fov: 30 },
  }
  for (const n of NODES) keys[n.id] = { pos: [n.pos[0] * 0.5, n.pos[1] + 7, n.pos[2] + 26], look: [n.pos[0] * 0.95, n.pos[1] + 0.5, n.pos[2]], fov: 30 }
  st.fly(keys.overview, true)

  return {
    focus(k, fast) { const id = ALIAS[k] || k; st.fly(keys[id] || keys.overview, fast) },
    anchor(k) { return anchors[ALIAS[k] || k] || null },
    project: st.project, visible: st.visible, dispose: st.dispose,
  }
}
