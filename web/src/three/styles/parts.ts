// Bộ chi tiết 3D dùng chung cho mọi skin: toà nhà, trụ 3RDHub, ăng-ten, ngân hàng, máy chủ, chip, thẻ, khiên, điện thoại, phong bì...
// Vật liệu lấy từ skin nên cùng một chi tiết hiện đúng phong cách của kiểu cảnh đang chọn.
import * as T from 'three'
import { PAL, edges, iconSprite, label, lin, packets, beam, rbox } from './kit'
import type { Role, Skin } from './skin'

export interface Ctx { sk: Skin; root: T.Group; tick(fn: (t: number) => void): void }
export interface Part { g: T.Group; top: number }

export function mk(c: Ctx, geo: T.BufferGeometry, role: Role, col: number): T.Mesh {
  const m = new T.Mesh(geo, c.sk.mat(role, col))
  if (c.sk.lines && role !== 'glow') m.add(edges(geo, c.sk.ec(col), c.sk.lines))
  return m
}
const at = <O extends T.Object3D>(o: O, x: number, y: number, z: number) => { o.position.set(x, y, z); return o }
const G = (...k: T.Object3D[]) => { const g = new T.Group(); k.forEach((o) => g.add(o)); return g }
const box = (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d)
const cyl = (r1: number, r2: number, h: number, s = 24) => new T.CylinderGeometry(r1, r2, h, s)
const glowM = (c: Ctx, col: number) => c.sk.mat('glow', col)

/** Chữ lớn phát sáng (dấu "?", "A", "%"...) dạng sprite. */
export function textSprite(text: string, color: number, size = 3): T.Sprite {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256
  const x = cv.getContext('2d') as CanvasRenderingContext2D
  const col = '#' + new T.Color(color).getHexString()
  x.font = '900 190px "Nunito",system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
  x.shadowColor = col; x.shadowBlur = 36; x.fillStyle = col; x.fillText(text, 128, 138)
  x.shadowBlur = 0; x.fillStyle = '#FFFFFF'; x.fillText(text, 128, 138)
  const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, fog: false })); s.scale.set(size, size, 1); s.renderOrder = 9
  return s
}

/** Gắn biểu tượng và nhãn phía trên một chi tiết. */
export function tag(c: Ctx, p: Part, name: string, sub: string, col: number, icon?: string, lift = 0): Part {
  let y = p.top + lift
  if (icon) { const ic = iconSprite(icon, 1.5, c.sk.day ? '#0B2A6F' : '#FFFFFF'); ic.position.y = y + 0.9; p.g.add(ic); c.tick((t) => { ic.position.y = y + 0.9 + Math.sin(t * 1.6 + p.g.position.x) * 0.12 }); y += 1.9 }
  const lb = label(name, col, 1.05, sub); lb.position.y = y + 0.9; p.g.add(lb)
  return { g: p.g, top: y + 1.7 }
}

export function place(c: Ctx, p: Part, x: number, y: number, z: number, pad?: [number, number, number]): Part {
  p.g.position.set(x, y, z)
  if (pad) { const pd = c.sk.pad(pad[0], pad[1], pad[2]); pd.position.set(x, y, z); c.root.add(pd) }
  c.root.add(p.g)
  return p
}

/* ---------------- công trình ---------------- */
export function building(c: Ctx, col: number, h = 6): Part {
  const b1 = new T.Mesh(box(2.8, h, 2.8), c.sk.win(5, 4, Math.round(h * 2.6))); b1.position.set(-0.7, h / 2, 0)
  const b2 = new T.Mesh(box(2, h * 0.55, 2.4), c.sk.win(8, 3, Math.round(h * 1.5))); b2.position.set(1.6, h * 0.275, 0.3)
  const cap = new T.Mesh(box(3.1, 0.2, 3.1), glowM(c, col)); cap.position.set(-0.7, h + 0.1, 0)
  const body = G(b1, b2, cap)
  if (c.sk.lines) { body.add(at(edges(b1.geometry, c.sk.ec(col), c.sk.lines), -0.7, h / 2, 0)); body.add(at(edges(b2.geometry, c.sk.ec(col), c.sk.lines), 1.6, h * 0.275, 0.3)) }
  return { g: body, top: h + 0.4 }
}
export function tower(c: Ctx, col: number): Part {
  const g = new T.Group()
  const shaft = mk(c, cyl(1.5, 2.1, 6.2, 8), 'glass', col); shaft.position.y = 3.1; g.add(shaft)
  for (const y of [1.6, 3.2, 4.8]) { const r = new T.Mesh(new T.TorusGeometry(1.6 + (6.2 - y) * 0.11, 0.05, 6, 8), glowM(c, col)); r.rotation.set(Math.PI / 2, 0, Math.PI / 8); r.position.y = y; g.add(r) }
  const cry = mk(c, new T.OctahedronGeometry(1.4, 0), 'body', col); cry.scale.y = 1.4; cry.position.y = 8.2; g.add(cry)
  const rs = [PAL.orange, PAL.violet, col].map((cc, i) => { const m = new T.Mesh(new T.TorusGeometry(2.4 + i * 0.5, 0.06, 8, 70), glowM(c, cc)); m.position.y = 8.2; g.add(m); return m })
  c.tick((t) => { cry.rotation.y = t * 0.8; cry.position.y = 8.2 + Math.sin(t * 1.3) * 0.2; rs.forEach((m, i) => { m.rotation.set(Math.PI / 2.6 + i * 0.5, t * (0.4 + i * 0.25), 0); m.position.y = cry.position.y }) })
  return { g, top: 10.2 }
}
export function mast(c: Ctx, col: number): Part {
  const g = new T.Group()
  const base = mk(c, box(2.4, 1.4, 2.4), 'body', col); base.position.set(0, 0.7, 0.9); g.add(base)
  const m = mk(c, cyl(0.1, 0.24, 5, 8), 'metal', col); m.position.set(0, 3, -0.4); g.add(m)
  const tip = new T.Mesh(new T.SphereGeometry(0.36, 16, 12), glowM(c, col)); tip.position.set(0, 5.6, -0.4); g.add(tip)
  const ws = [0, 1, 2].map(() => { const w = new T.Mesh(new T.TorusGeometry(1, 0.05, 6, 40), new T.MeshBasicMaterial({ color: lin(col).multiplyScalar(1.4), transparent: true, toneMapped: false, depthWrite: false })); w.position.set(0, 5.6, -0.4); g.add(w); return w })
  c.tick((t) => ws.forEach((w, i) => { const u = (t * 0.45 + i / 3) % 1; w.scale.setScalar(0.5 + u * 3.4); (w.material as T.MeshBasicMaterial).opacity = 1 - u }))
  return { g, top: 6.2 }
}
export function coinStack(c: Ctx, n = 4): T.Group {
  const g = new T.Group()
  for (let i = 0; i < n; i++) { const m = new T.Mesh(cyl(0.6, 0.6, 0.16, 20), c.sk.mat('gold', PAL.gold)); m.position.y = 0.1 + i * 0.17; g.add(m) }
  return g
}
export function bank(c: Ctx, col: number): Part {
  const g = new T.Group()
  const b = mk(c, box(3.6, 2, 2.6), 'glass', col); b.position.set(-0.3, 1.1, -0.2); g.add(b)
  for (let i = 0; i < 4; i++) { const p = new T.Mesh(cyl(0.17, 0.17, 2, 10), glowM(c, col)); p.position.set(-1.5 + i * 0.95, 1.1, 1.2); g.add(p) }
  const roof = mk(c, cyl(2.3, 2.3, 3.9, 3), 'glass', col); roof.rotation.set(0, 0, Math.PI / 2); roof.scale.set(0.35, 1, 0.85); roof.position.set(-0.3, 2.55, -0.2); g.add(roof)
  const cs = coinStack(c, 5); cs.position.set(2.3, 0, 0.6); g.add(cs)
  const coin = new T.Mesh(cyl(0.7, 0.7, 0.14, 24), c.sk.mat('gold', PAL.gold)); coin.rotation.z = Math.PI / 2; g.add(coin)
  c.tick((t) => { coin.rotation.y = t * 2; coin.position.set(-0.3, 4.4 + Math.sin(t * 1.6) * 0.2, 0) })
  return { g, top: 5.2 }
}
export function radar(c: Ctx, col: number): Part {
  const g = new T.Group()
  const t0 = mk(c, cyl(0.8, 1.1, 2.6, 12), 'dark', col); t0.position.y = 1.4; g.add(t0)
  const dish = mk(c, cyl(1.7, 0.25, 0.5, 20), 'glass', col); dish.position.y = 3.2; g.add(dish)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d') as CanvasRenderingContext2D
  const gr = x.createLinearGradient(0, 32, 64, 32); const hex = '#' + new T.Color(col).getHexString(); gr.addColorStop(0, hex + 'DD'); gr.addColorStop(1, hex + '00'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64)
  const sweep = new T.Mesh(new T.CircleGeometry(3.2, 20, 0, 0.9), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false }))
  sweep.rotation.x = -Math.PI / 2; sweep.position.y = 0.6; g.add(sweep)
  const ring = new T.Mesh(new T.TorusGeometry(3.2, 0.04, 6, 60), glowM(c, col)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.6; g.add(ring)
  c.tick((t) => { sweep.rotation.z = -t * 1.6 })
  return { g, top: 4.2 }
}
export function servers(c: Ctx, col: number, n = 4): Part {
  const g = new T.Group()
  for (let i = 0; i < n; i++) {
    const s = mk(c, rbox(3.4, 0.7, 2.6, 0.2), 'glass', col); s.position.y = 0.4 + i * 0.95; g.add(s)
    for (let j = 0; j < 3; j++) { const led = new T.Mesh(box(0.22, 0.12, 0.05), glowM(c, j === 0 ? PAL.mint : col)); led.position.set(-1.1 + j * 0.45, 0.5 + i * 0.95, 1.33); g.add(led) }
    const plug = mk(c, box(0.5, 0.35, 0.6), 'metal', col); plug.position.set(i % 2 ? 1.9 : -1.9, 0.4 + i * 0.95, 0); g.add(plug)
  }
  return { g, top: n * 0.95 + 0.5 }
}
export function database(c: Ctx, col: number): Part {
  const g = new T.Group()
  for (let i = 0; i < 3; i++) { const d = mk(c, cyl(1.5, 1.5, 0.9, 28), 'glass', col); d.position.y = 0.5 + i * 1.05; g.add(d); const r = new T.Mesh(new T.TorusGeometry(1.5, 0.04, 6, 40), glowM(c, col)); r.rotation.x = Math.PI / 2; r.position.y = 0.96 + i * 1.05; g.add(r) }
  return { g, top: 3.8 }
}
export function container(c: Ctx, col: number): Part {
  const g = new T.Group()
  const b = mk(c, box(3, 1.5, 1.5), 'body', col); b.position.y = 0.8; g.add(b)
  for (let i = 0; i < 6; i++) { const r = new T.Mesh(box(0.06, 1.4, 1.58), glowM(c, col)); r.position.set(-1.25 + i * 0.5, 0.8, 0); g.add(r) }
  return { g, top: 1.8 }
}
export function chip(c: Ctx, col: number): Part {
  const g = new T.Group()
  const ch = mk(c, rbox(4.4, 0.45, 4.4, 0.25), 'metal', col); ch.position.y = 0.3; g.add(ch)
  for (let i = 0; i < 9; i++) for (const sd of [-1, 1]) {
    const a = new T.Mesh(box(0.16, 0.1, 0.36), glowM(c, col)); a.position.set(-1.8 + i * 0.45, 0.45, sd * 2.4); g.add(a)
    const b = new T.Mesh(box(0.36, 0.1, 0.16), glowM(c, col)); b.position.set(sd * 2.4, 0.45, -1.8 + i * 0.45); g.add(b)
  }
  const core = mk(c, box(1.5, 1.5, 1.5), 'body', col); core.position.y = 2.2; g.add(core)
  const orb = new T.Mesh(new T.TorusGeometry(1.5, 0.05, 6, 50), glowM(c, col)); orb.position.y = 2.2; g.add(orb)
  c.tick((t) => { core.rotation.set(t * 0.7, t * 0.9, 0); core.position.y = 2.2 + Math.sin(t * 1.5) * 0.15; orb.rotation.set(t * 0.6, t * 0.4, 0) })
  return { g, top: 3.6 }
}
export function gear(c: Ctx, col: number, r = 1.4): Part {
  const g = new T.Group(), rot = new T.Group(); g.add(rot)
  const b = mk(c, cyl(r, r, 0.5, 20), 'metal', col); b.rotation.x = Math.PI / 2; rot.add(b)
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const t = mk(c, box(0.5, 0.5, 0.5), 'metal', col); t.position.set(Math.cos(a) * (r + 0.2), Math.sin(a) * (r + 0.2), 0); t.rotation.z = a; rot.add(t) }
  const hub = new T.Mesh(cyl(0.35, 0.35, 0.6, 12), glowM(c, col)); hub.rotation.x = Math.PI / 2; rot.add(hub)
  rot.position.y = r + 0.6
  c.tick((t) => { rot.rotation.z = t * 0.6 })
  return { g, top: r * 2 + 1 }
}
export function barChart(c: Ctx, col: number): Part {
  const g = new T.Group(), bars: T.Mesh[] = []
  for (let i = 0; i < 6; i++) { const b = mk(c, box(0.7, 1, 0.7), i === 5 ? 'glow' : 'body', i === 5 ? PAL.mint : col); b.position.x = -2 + i * 0.85; g.add(b); bars.push(b) }
  c.tick((t) => bars.forEach((b, i) => { const h = 0.8 + (i + 1) * 0.55 + Math.sin(t * 1.2 + i) * 0.18; b.scale.y = h; b.position.y = h / 2 }))
  return { g, top: 5 }
}
export function card(c: Ctx, col: number): Part {
  const g = new T.Group(), f = new T.Group(); g.add(f)
  const b = mk(c, rbox(3.6, 0.1, 2.3, 0.2), 'body', col); b.rotation.x = Math.PI / 2; f.add(b)
  const chipM = new T.Mesh(box(0.6, 0.45, 0.04), c.sk.mat('gold', PAL.gold)); chipM.position.set(-1.1, 0.25, 0.1); f.add(chipM)
  const stripe = new T.Mesh(box(3.4, 0.2, 0.03), glowM(c, col)); stripe.position.set(0, -0.35, 0.09); f.add(stripe)
  f.position.y = 2
  c.tick((t) => { f.rotation.y = Math.sin(t * 0.8) * 0.5; f.position.y = 2 + Math.sin(t * 1.3) * 0.2 })
  return { g, top: 3.6 }
}
export function shield(c: Ctx, col: number): Part {
  const s = new T.Shape(); s.moveTo(0, 1.8); s.lineTo(1.4, 1.2); s.lineTo(1.4, 0); s.quadraticCurveTo(1.4, -1.2, 0, -1.9); s.quadraticCurveTo(-1.4, -1.2, -1.4, 0); s.lineTo(-1.4, 1.2); s.closePath()
  const geo = new T.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 })
  const m = mk(c, geo, 'glass', col); m.position.set(0, 2.4, -0.2)
  const plus1 = new T.Mesh(box(0.9, 0.28, 0.1), glowM(c, col)), plus2 = new T.Mesh(box(0.28, 0.9, 0.1), glowM(c, col)); plus1.position.set(0, 2.5, 0.4); plus2.position.copy(plus1.position)
  const g = G(m, plus1, plus2)
  c.tick((t) => { g.rotation.y = Math.sin(t * 0.7) * 0.5 })
  return { g, top: 4.6 }
}
export function house(c: Ctx, col: number): Part {
  const b = mk(c, box(3, 1.8, 2.4), 'body', col); b.position.y = 0.9
  const r = mk(c, cyl(0, 2.4, 1.6, 4), 'glass', col); r.rotation.y = Math.PI / 4; r.position.y = 2.6; r.scale.set(1, 1, 0.8)
  const d = new T.Mesh(box(0.6, 1.1, 0.06), glowM(c, col)); d.position.set(0, 0.55, 1.22)
  const cs = coinStack(c, 4); cs.position.set(2.2, 0, 0.6)
  return { g: G(b, r, d, cs), top: 3.6 }
}
export function phone(c: Ctx, col: number): Part {
  const g = new T.Group()
  const b = mk(c, rbox(1.8, 0.28, 3.4, 0.25), 'dark', col); b.rotation.x = Math.PI / 2; b.position.y = 2.1; g.add(b)
  const scr = new T.Mesh(box(1.5, 3, 0.04), glowM(c, col)); scr.position.set(0, 2.1, 0.17); g.add(scr)
  const bar = new T.Mesh(box(1, 0.2, 0.05), c.sk.mat('body', PAL.white)); bar.position.set(0, 2.9, 0.2); g.add(bar)
  const bar2 = new T.Mesh(box(0.7, 0.2, 0.05), c.sk.mat('body', PAL.white)); bar2.position.set(-0.2, 2.5, 0.2); g.add(bar2)
  c.tick((t) => { g.rotation.y = Math.sin(t * 0.8) * 0.4; g.position.y = Math.sin(t * 1.2) * 0.15 })
  return { g, top: 4 }
}
export function envelope(c: Ctx, col: number): Part {
  const g = new T.Group(), f = new T.Group(); g.add(f)
  const b = mk(c, box(3.4, 2.2, 0.5), 'body', col); f.add(b)
  const flap = mk(c, cyl(1.9, 1.9, 0.52, 3), 'glass', col); flap.rotation.set(Math.PI / 2, 0, Math.PI / 2); flap.scale.set(1, 1, 0.85); flap.position.set(0, 0.35, 0.02); f.add(flap)
  const seal = new T.Mesh(new T.SphereGeometry(0.3, 14, 10), glowM(c, PAL.orange)); seal.position.set(0, -0.1, 0.35); f.add(seal)
  f.position.y = 2.2
  c.tick((t) => { f.rotation.set(Math.sin(t * 0.9) * 0.15, Math.sin(t * 0.6) * 0.5, Math.sin(t * 0.7) * 0.08); f.position.y = 2.2 + Math.sin(t * 1.4) * 0.3 })
  return { g, top: 4 }
}
export function pin(c: Ctx, col: number): Part {
  const g = new T.Group()
  const cone = mk(c, new T.ConeGeometry(0.9, 2.2, 20), 'body', col); cone.rotation.x = Math.PI; cone.position.y = 1.2; g.add(cone)
  const ball = mk(c, new T.SphereGeometry(1.1, 24, 18), 'body', col); ball.position.y = 2.7; g.add(ball)
  const dot = new T.Mesh(new T.SphereGeometry(0.4, 14, 10), glowM(c, PAL.white)); dot.position.set(0, 2.75, 0.8); g.add(dot)
  const rs = [0, 1].map(() => { const r = new T.Mesh(new T.RingGeometry(0.9, 1, 40), new T.MeshBasicMaterial({ color: lin(col).multiplyScalar(1.5), transparent: true, side: T.DoubleSide, toneMapped: false, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.06; g.add(r); return r })
  c.tick((t) => { rs.forEach((r, i) => { const u = (t * 0.5 + i * 0.5) % 1; r.scale.setScalar(0.6 + u * 3.4); (r.material as T.MeshBasicMaterial).opacity = (1 - u) * 0.9 }); ball.position.y = 2.7 + Math.sin(t * 2) * 0.12; cone.position.y = 1.2 + Math.sin(t * 2) * 0.12; dot.position.y = ball.position.y + 0.05 })
  return { g, top: 4.2 }
}
export function bubble(c: Ctx, col: number, text = '', flip = false): Part {
  const g = new T.Group()
  const b = mk(c, rbox(3.2, 0.5, 2, 0.35), 'glass', col); b.rotation.x = Math.PI / 2; b.position.y = 1.2; g.add(b)
  const tail = mk(c, new T.ConeGeometry(0.4, 0.8, 4), 'glass', col); tail.rotation.set(Math.PI, 0, 0); tail.position.set(flip ? 0.9 : -0.9, 0.2, 0); g.add(tail)
  if (text) { const s = textSprite(text, col, 2.2); s.position.set(0, 1.25, 0.4); g.add(s) }
  else for (let i = 0; i < 3; i++) { const d = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), glowM(c, col)); d.position.set(-0.6 + i * 0.6, 1.2, 0.45); g.add(d); c.tick((t) => { d.position.y = 1.2 + Math.sin(t * 3 + i) * 0.1 }) }
  return { g, top: 2.6 }
}
export function magnifier(c: Ctx, col: number): Part {
  const g = new T.Group()
  const ring = new T.Mesh(new T.TorusGeometry(1.3, 0.2, 10, 40), c.sk.mat('metal', col)); ring.position.y = 2.6; g.add(ring)
  const lens = mk(c, cyl(1.25, 1.25, 0.08, 32), 'glass', col); lens.rotation.x = Math.PI / 2; lens.position.y = 2.6; g.add(lens)
  const h = mk(c, cyl(0.2, 0.28, 2.2, 10), 'dark', col); h.rotation.z = Math.PI / 4; h.position.set(-1.5, 1.2, 0); g.add(h)
  c.tick((t) => { g.rotation.z = Math.sin(t * 0.9) * 0.12; g.position.x = Math.sin(t * 0.6) * 0.4 })
  return { g, top: 4.4 }
}
export function headset(c: Ctx, col: number): Part {
  const g = new T.Group()
  const arc = mk(c, new T.TorusGeometry(1.6, 0.18, 10, 30, Math.PI), 'metal', col); arc.position.y = 1.8; g.add(arc)
  for (const sx of [-1, 1]) { const e = mk(c, cyl(0.6, 0.6, 0.6, 18), 'body', col); e.rotation.z = Math.PI / 2; e.position.set(sx * 1.7, 1.8, 0); g.add(e) }
  const mic = mk(c, cyl(0.07, 0.07, 1.6, 6), 'metal', col); mic.rotation.z = Math.PI / 2.6; mic.position.set(1.2, 0.9, 0.5); g.add(mic)
  const tip = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), glowM(c, col)); tip.position.set(0.5, 0.45, 0.5); g.add(tip)
  c.tick((t) => { g.rotation.y = Math.sin(t * 0.7) * 0.5 })
  return { g, top: 3.8 }
}
export function person(c: Ctx, col: number): Part {
  const g = new T.Group()
  const body = mk(c, cyl(0.7, 0.95, 1.9, 18), 'body', col); body.position.y = 1; g.add(body)
  const head = mk(c, new T.SphereGeometry(0.62, 20, 16), 'body', PAL.white); head.position.y = 2.5; g.add(head)
  for (const sx of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), glowM(c, 0x0B2A6F)); e.position.set(sx * 0.22, 2.55, 0.55); g.add(e) }
  const ph = new T.Mesh(box(0.5, 0.8, 0.08), glowM(c, col)); ph.position.set(0.9, 1.4, 0.4); ph.rotation.z = -0.3; g.add(ph)
  c.tick((t) => { g.position.y = Math.abs(Math.sin(t * 2)) * 0.12 })
  return { g, top: 3.4 }
}
export function doc(c: Ctx, col: number): T.Group {
  const g = new T.Group()
  const p = mk(c, box(1.3, 1.7, 0.1), 'body', PAL.white); g.add(p)
  for (let i = 0; i < 3; i++) { const l = new T.Mesh(box(0.8 - i * 0.1, 0.09, 0.03), glowM(c, col)); l.position.set(-0.05, 0.4 - i * 0.3, 0.07); g.add(l) }
  const ck = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), glowM(c, PAL.mint)); ck.position.set(0.35, -0.55, 0.08); g.add(ck)
  return g
}
export function tile(c: Ctx, col: number, icon: string, s = 2.4): Part {
  const g = new T.Group()
  const p = mk(c, rbox(s, 0.4, s, 0.4), 'glass', col); p.rotation.x = Math.PI / 2; p.position.y = s / 2 + 0.2; g.add(p)
  const ic = iconSprite(icon, s * 0.7, c.sk.day ? '#0B2A6F' : '#FFFFFF'); ic.position.set(0, s / 2 + 0.2, 0.4); g.add(ic)
  return { g, top: s + 0.4 }
}
export function cloud(c: Ctx, col: number): Part {
  const g = new T.Group()
  for (const [x, y, r] of [[-1, 0, 0.9], [0, 0.35, 1.2], [1.1, 0, 0.95], [0.1, -0.1, 1]] as [number, number, number][]) { const s = mk(c, new T.SphereGeometry(r, 18, 14), 'glass', col); s.position.set(x, 2.4 + y, 0); g.add(s) }
  c.tick((t) => { g.position.y = Math.sin(t * 1.1) * 0.2 })
  return { g, top: 4.2 }
}

/* ---------------- đường dữ liệu ---------------- */
export function link(c: Ctx, pts: [number, number, number][], col: number, n = 3, speed = 0.1, size = 0.28): void {
  const v = pts.map((p) => new T.Vector3(...p))
  const curve = beam(c.root, v, col, 0.06)
  c.tick(packets(c.root, curve, n, col, size, speed))
}
