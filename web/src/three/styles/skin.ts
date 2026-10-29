// "Giao diện" của một kiểu cảnh: ánh sáng, nền, vật liệu và bệ đỡ. Các cảnh nội dung (concepts.ts) dựng bằng vật liệu của skin
// nên cùng một nội dung có thể hiện theo nhiều phong cách (đảo isometric, nhà máy, hệ sinh thái, không gian, đồ chơi khối, bản vẽ, thành phố neon).
import * as T from 'three'
import { PAL, dust, edges, glass, grid, lin, metal, neon, nightEnv, nightLights, rbox, winMat, type Stage } from './kit'
import { chartTex } from './ecosystem'

export type SkinId = 'isometric' | 'factory' | 'ecosystem' | 'orbit' | 'voxel' | 'blueprint' | 'neon'
export type Role = 'body' | 'glass' | 'dark' | 'glow' | 'metal' | 'gold'
export type StageOpts = { fov?: number; fog?: [number, number]; sky?: [string, string, string]; bloom?: number; offsetX?: number; fogColor?: number }

export interface Skin {
  id: SkinId
  stage: StageOpts
  /** Hướng camera nhìn vào (từ tâm cảnh ra), và hệ số khoảng cách theo bán kính vùng cần xem. */
  dir: [number, number, number]
  k: number
  fov: number
  /** Độ sáng viền cạnh (0 = không vẽ viền). */
  lines: number
  /** Cảnh sáng ban ngày (nhãn, chữ dùng bảng màu khác). */
  day: boolean
  setup(st: Stage, root: T.Group): (t: number, dt: number) => void
  mat(role: Role, c: number): T.Material
  ec(c: number): number
  pad(w: number, d: number, c: number): T.Group
  win(seed: number, cols: number, rows: number, c?: number): T.Material
}

const mixHex = (a: number, b: number, t: number) => new T.Color(a).lerp(new T.Color(b), t).getHex()
const goldMat = (e = 0.3) => new T.MeshStandardMaterial({ color: lin(PAL.gold), metalness: 0.9, roughness: 0.25, emissive: lin(PAL.gold), emissiveIntensity: e })
const radial = (inner: string, outer: string, size = 128) => {
  const c = document.createElement('canvas'); c.width = c.height = size
  const x = c.getContext('2d') as CanvasRenderingContext2D
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, inner); g.addColorStop(1, outer)
  x.fillStyle = g; x.fillRect(0, 0, size, size)
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t
}
const glowSprite = (color: number, size: number, op = 0.6) => {
  const hex = '#' + new T.Color(color).getHexString()
  const s = new T.Sprite(new T.SpriteMaterial({ map: radial(hex + 'FF', hex + '00'), transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }))
  s.scale.set(size, size, 1); return s
}

/* ---------- vật liệu theo nhóm skin ---------- */
function nightMat(role: Role, c: number): T.Material {
  switch (role) {
    case 'body': return new T.MeshStandardMaterial({ color: lin(mixHex(c, 0x14216B, 0.62)), emissive: lin(c), emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.5 })
    case 'glass': return glass(0x0C1E55, c, 0.35)
    case 'dark': return metal(0x16275E, 0.4)
    case 'glow': return neon(c, 1.3)
    case 'metal': return metal(0x6F86C9, 0.3)
    default: return goldMat()
  }
}
function floorTiles() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d') as CanvasRenderingContext2D
  x.fillStyle = '#0B1B4A'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#10265E'; x.fillRect(0, 0, 128, 128); x.fillRect(128, 128, 128, 128)
  x.strokeStyle = 'rgba(90,150,255,.55)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 253, 253)
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.encoding = T.sRGBEncoding; return t
}
function checker(a: string, b: string, line = '') {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d') as CanvasRenderingContext2D
  x.fillStyle = a; x.fillRect(0, 0, 128, 128); x.fillStyle = b; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64)
  if (line) { x.strokeStyle = line; x.lineWidth = 2; x.strokeRect(1, 1, 126, 126) }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.encoding = T.sRGBEncoding; return t
}
function nightPad(w: number, d: number, c: number, round = false): T.Group {
  const g = new T.Group()
  if (round) {
    const r = Math.max(w, d) / 2
    const p = new T.Mesh(new T.CylinderGeometry(r, r * 1.1, 0.4, 40), glass(0x0A1840, 0x0B2A6F, 0.5)); p.position.y = 0.2; g.add(p)
    const ring = new T.Mesh(new T.TorusGeometry(r * 1.02, 0.05, 8, 60), neon(c, 1)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.42; g.add(ring)
  } else {
    const p = new T.Mesh(rbox(w, 0.5, d, 0.45), glass(0x0A1840, 0x0B2A6F, 0.5)); g.add(p)
    g.add(edges(p.geometry, c, 1.4))
  }
  return g
}

const nightBase = {
  lines: 1.25, day: false,
  mat: nightMat, ec: (c: number) => c,
  win: (seed: number, cols: number, rows: number, c?: number) => winMat(seed, cols, rows, c || 0x0B1740, 0.3),
}

/* ---------- 7 skin ---------- */
function isometric(): Skin {
  return {
    id: 'isometric', stage: { fov: 16, fog: [150, 400], bloom: 0.55, sky: ['#030816', '#0A1B45', '#14337A'] }, dir: [1, 0.82, 1], k: 6.4, fov: 16, ...nightBase,
    pad: (w, d, c) => nightPad(w, d, c),
    setup(st, root) {
      st.scene.environment = nightEnv(); nightLights(st.scene)
      const slabGeo = rbox(48, 1.4, 36, 1.4)
      const slab = new T.Mesh(slabGeo, glass(0x0A1840, 0x0B2A6F, 0.5)); slab.position.y = -1.4; root.add(slab)
      const se = edges(slabGeo, PAL.cyan, 1.1); se.position.y = -1.4; root.add(se)
      const ft = floorTiles(); ft.repeat.set(23, 17)
      const floor = new T.Mesh(new T.PlaneGeometry(46.4, 34.4), new T.MeshBasicMaterial({ map: ft, color: new T.Color(0.55, 0.62, 0.8), toneMapped: false }))
      floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; root.add(floor)
      const under = new T.Mesh(new T.ConeGeometry(25, 15, 4, 1), glass(0x081333, 0x0B2A6F, 0.35)); under.rotation.set(Math.PI, Math.PI / 4, 0); under.position.y = -9.4; under.scale.set(1.05, 1, 0.8); root.add(under)
      const ue = new T.LineSegments(new T.EdgesGeometry(under.geometry), new T.LineBasicMaterial({ color: lin(PAL.blue).multiplyScalar(1.1), toneMapped: false })); ue.rotation.copy(under.rotation); ue.position.copy(under.position); ue.scale.copy(under.scale); root.add(ue)
      const dt = dust(root, 140, [90, 40, 70], [0, 10, 0], 0x8FB4FF, 4)
      return (t) => dt(t)
    },
  }
}
function factory(): Skin {
  return {
    id: 'factory', stage: { fov: 32, fog: [60, 200], bloom: 0.6, sky: ['#040A1C', '#0A1B45', '#10265E'] }, dir: [0.12, 0.5, 1], k: 3.3, fov: 32, ...nightBase,
    mat: (role, c) => role === 'body' ? new T.MeshStandardMaterial({ color: lin(mixHex(c, 0x1C2D66, 0.7)), roughness: 0.45, metalness: 0.65, emissive: lin(c), emissiveIntensity: 0.12 }) : nightMat(role, c),
    pad(w, d, c) {
      const g = new T.Group()
      const p = new T.Mesh(new T.BoxGeometry(w, 0.4, d), metal(0x1C2D66, 0.4)); p.position.y = 0.2; g.add(p)
      for (const sz of [-1, 1]) { const s = new T.Mesh(new T.BoxGeometry(w, 0.05, 0.25), neon(PAL.orange, 1)); s.position.set(0, 0.42, sz * (d / 2 - 0.2)); g.add(s) }
      const e = edges(p.geometry, c, 1.2); e.position.y = 0.2; g.add(e)
      return g
    },
    setup(st, root) {
      st.scene.environment = nightEnv(); nightLights(st.scene)
      grid(root, 220, PAL.blue, 0.01, 2)
      const hall = new T.Mesh(new T.PlaneGeometry(220, 220), new T.MeshBasicMaterial({ color: lin(0x070E26), toneMapped: false })); hall.rotation.x = -Math.PI / 2; hall.position.y = -0.02; root.add(hall)
      const wm = winMat(2, 52, 14, 0x08122E, 0.2); (wm as T.MeshStandardMaterial).emissiveIntensity = 0.4
      const wall = new T.Mesh(new T.BoxGeometry(170, 40, 1), wm); wall.position.set(0, 18, -34); root.add(wall)
      ;[-30, -10, 10, 30].forEach((x, i) => {
        const c = [PAL.cyan, PAL.violet, PAL.orange, PAL.mint][i], hex = '#' + new T.Color(c).getHexString()
        const p = new T.Mesh(new T.PlaneGeometry(12, 7), new T.MeshBasicMaterial({ map: chartTex(hex, 5 + i), transparent: true, opacity: 0.95, toneMapped: false, fog: false })); p.position.set(x, 14 + (i % 2) * 3, -33); root.add(p)
        p.add(new T.LineSegments(new T.EdgesGeometry(p.geometry), new T.LineBasicMaterial({ color: lin(c).multiplyScalar(1.4), toneMapped: false })))
      })
      for (let i = 0; i < 13; i++) { const p = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 40, 10), metal(0x1C2D66, 0.4)); p.position.set(-60 + i * 10, 20, -32.5); root.add(p); const s = new T.Mesh(new T.BoxGeometry(0.1, 40, 0.1), neon(PAL.cyan, 0.8)); s.position.set(-60 + i * 10, 20, -31.9); root.add(s) }
      /* băng chuyền phía trước, thùng chạy liên tục */
      const bt = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d') as CanvasRenderingContext2D; x.fillStyle = '#0C1738'; x.fillRect(0, 0, 128, 64); x.strokeStyle = '#2F7BFF'; x.lineWidth = 6; x.lineCap = 'round'; for (const o of [0, 64]) { x.beginPath(); x.moveTo(o + 14, 12); x.lineTo(o + 40, 32); x.lineTo(o + 14, 52); x.stroke() } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(30, 1); t.encoding = T.sRGBEncoding; return t })()
      const belt = new T.Mesh(new T.BoxGeometry(70, 0.4, 2.6), new T.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: new T.Color(0.6, 0.8, 1), emissiveIntensity: 0.8, roughness: 0.6 })); belt.position.set(0, 0.5, 15); root.add(belt)
      for (const sz of [-1, 1]) { const st2 = new T.Mesh(new T.BoxGeometry(70, 0.06, 0.08), neon(PAL.cyan, 1)); st2.position.set(0, 0.74, 15 + sz * 1.35); root.add(st2); const hz = new T.Mesh(new T.BoxGeometry(70, 0.04, 0.4), neon(PAL.orange, 0.8)); hz.position.set(0, 0.03, 15 + sz * 3.2); root.add(hz) }
      const geo = new T.BoxGeometry(1, 1, 1)
      const crates = Array.from({ length: 12 }, (_, i) => { const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: lin(PAL.orange), emissive: lin([PAL.orange, PAL.cyan, PAL.violet, PAL.mint][i % 4]), emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.4 })); root.add(m); return { m, o: i / 12 } })
      const dt = dust(root, 120, [90, 20, 50], [0, 8, 0], 0x8FB4FF, 4)
      return (t, dt2) => { bt.offset.x -= dt2 * 0.07; crates.forEach((c) => c.m.position.set(-34 + ((t * 3 / 68 + c.o) % 1) * 68, 1.2, 15)); dt(t) }
    },
    // factory bố trí phẳng hơn: hơi cao hơn và nhìn thẳng
  }
}
function ecosystem(): Skin {
  return {
    id: 'ecosystem', stage: { fov: 32, fog: [45, 160], bloom: 0.6 }, dir: [0.08, 0.42, 1], k: 3.3, fov: 32, ...nightBase,
    pad: (w, d, c) => nightPad(w, d, c, true),
    setup(st, root) {
      st.scene.environment = nightEnv(); nightLights(st.scene)
      grid(root, 140, PAL.blue, -0.02, 3)
      const wt = winMat(11, 4, 16, 0x0B1740, 0.3)
      let s0 = 11; const rn = () => ((s0 = (s0 * 9301 + 49297) % 233280) / 233280)
      for (let i = 0; i < 46; i++) {
        const a = Math.PI * (0.92 + (i / 46) * 1.16), r = 48 + rn() * 14, h = 8 + rn() * 22
        const m = new T.Mesh(new T.BoxGeometry(3.2 + rn() * 2, h, 3.2), wt); m.position.set(Math.cos(a) * r, h / 2 - 0.6, Math.sin(a) * r - 6); m.rotation.y = -a; root.add(m)
      }
      for (let i = 0; i < 24; i++) {
        const a = Math.PI * (1.05 + rn() * 0.9), r = 26 + rn() * 16
        const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 30, 4), neon(rn() < 0.5 ? PAL.cyan : PAL.violet, 0.7)); m.position.set(Math.cos(a) * r, 14, Math.sin(a) * r - 4); root.add(m)
      }
      ;([[-26, 13, -22, 0.5, '#27D3FF'], [26, 14, -24, -0.5, '#FF7A3C'], [0, 19, -36, 0, '#8A5BFF']] as [number, number, number, number, string][]).forEach(([x, y, z, ry, c], i) => {
        const p = new T.Mesh(new T.PlaneGeometry(10, 5.9), new T.MeshBasicMaterial({ map: chartTex(c, 7 + i), transparent: true, opacity: 0.92, toneMapped: false, fog: false })); p.position.set(x, y, z); p.rotation.y = ry; root.add(p)
        p.add(new T.LineSegments(new T.EdgesGeometry(p.geometry), new T.LineBasicMaterial({ color: lin(new T.Color(c).getHex()).multiplyScalar(1.4), toneMapped: false })))
      })
      const dt = dust(root, 200, [90, 40, 90], [0, 12, 0])
      return (t) => dt(t)
    },
  }
}
function orbit(): Skin {
  const sat: { g: T.Group; r: number; sp: number; ph: number; y: number }[] = []
  return {
    id: 'orbit', stage: { fov: 30, fog: [80, 330], bloom: 0.55, sky: ['#01030C', '#050B24', '#0B1A4A'], fogColor: 0x050B24 }, dir: [0.3, 0.3, 1], k: 3.4, fov: 30, lines: 0.9, day: false,
    mat(role, c) {
      switch (role) {
        case 'body': return new T.MeshStandardMaterial({ color: lin(mixHex(0xDDE6FF, c, 0.18)), roughness: 0.35, metalness: 0.55, emissive: lin(c), emissiveIntensity: 0.08 })
        case 'glass': return glass(0x1B2A66, c, 0.5)
        case 'dark': return metal(0x2A3566, 0.35)
        case 'glow': return neon(c, 1.4)
        case 'metal': return metal(0xB8C4E8, 0.25)
        default: return goldMat(0.35)
      }
    },
    ec: (c) => c,
    win: (seed, cols, rows, c) => winMat(seed, cols, rows, c || 0x1B2A66, 0.15),
    pad(w, d, c) {
      const g = new T.Group(), r = Math.max(w, d) / 2
      const p = new T.Mesh(new T.CylinderGeometry(r, r * 0.8, 0.5, 6), metal(0xB8C4E8, 0.3)); p.position.y = 0.25; g.add(p)
      const rim = new T.Mesh(new T.TorusGeometry(r * 0.96, 0.06, 6, 6), neon(c, 1.3)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.52; g.add(rim)
      const under = new T.Mesh(new T.ConeGeometry(r * 0.8, r * 0.9, 6), metal(0x2A3566, 0.4)); under.rotation.x = Math.PI; under.position.y = -r * 0.45 + 0.02; g.add(under)
      return g
    },
    setup(st, root) {
      const sc = st.scene
      sc.environment = nightEnv()
      sc.add(new T.HemisphereLight(0x6F8CFF, 0x0A0A25, 0.8))
      const key = new T.DirectionalLight(0xFFF1DC, 1.6); key.position.set(-30, 30, 30); sc.add(key)
      const rim = new T.DirectionalLight(0x27D3FF, 1.1); rim.position.set(40, 10, -30); sc.add(rim)
      /* sao */
      const n = 900, pos = new Float32Array(n * 3); let s = 9; const rn = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
      for (let i = 0; i < n; i++) { const th = rn() * Math.PI * 2, ph = Math.acos(2 * rn() - 1), r = 190 + rn() * 40; pos[i * 3] = Math.sin(ph) * Math.cos(th) * r; pos[i * 3 + 1] = Math.abs(Math.cos(ph)) * r * 0.9 - 20; pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r - 60 }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3))
      const stars = new T.Points(sg, new T.PointsMaterial({ color: 0xFFFFFF, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, fog: false })); root.add(stars)
      /* hành tinh */
      const planet = (r: number, c1: string, c2: string, x: number, y: number, z: number, ring = false) => {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const cx = cv.getContext('2d') as CanvasRenderingContext2D
        const gg = cx.createLinearGradient(0, 0, 0, 128); gg.addColorStop(0, c1); gg.addColorStop(1, c2); cx.fillStyle = gg; cx.fillRect(0, 0, 256, 128)
        cx.globalAlpha = 0.18; cx.fillStyle = '#fff'; for (let i = 0; i < 9; i++) cx.fillRect(0, i * 14 + (i % 3) * 3, 256, 5 + (i % 4) * 2)
        const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding
        const m = new T.Mesh(new T.SphereGeometry(r, 40, 28), new T.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 })); m.position.set(x, y, z); root.add(m)
        const halo = glowSprite(0x5E86FF, r * 3.4, 0.35); halo.position.copy(m.position); root.add(halo)
        if (ring) { const rg = new T.Mesh(new T.RingGeometry(r * 1.35, r * 1.9, 64), new T.MeshBasicMaterial({ color: lin(0xD9C7A0), transparent: true, opacity: 0.55, side: T.DoubleSide, toneMapped: false, depthWrite: false })); rg.rotation.x = Math.PI / 2.3; rg.position.copy(m.position); root.add(rg) }
        return m
      }
      const p1 = planet(26, '#3B6BFF', '#1B2A8A', -62, 18, -110)
      const p2 = planet(11, '#FF9A5C', '#9B3B1B', 66, 26, -95, true)
      const moon = planet(4, '#DDE6FF', '#8896C8', 18, 42, -70)
      for (const [c, x, y, z, sz] of [[0x8A5BFF, -20, 30, -120, 90], [0x27D3FF, 40, 10, -130, 80]] as [number, number, number, number, number][]) { const g2 = glowSprite(c, sz, 0.28); g2.position.set(x, y, z); root.add(g2) }
      /* vệ tinh bay quanh */
      for (let i = 0; i < 4; i++) {
        const g = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(0.9, 0.9, 1.4), metal(0xB8C4E8, 0.3)); g.add(b)
        for (const sx of [-1, 1]) { const w = new T.Mesh(new T.BoxGeometry(1.6, 0.05, 0.8), new T.MeshStandardMaterial({ color: lin(0x1B3C9A), emissive: lin(PAL.cyan), emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.3 })); w.position.x = sx * 1.4; g.add(w) }
        root.add(g); sat.push({ g, r: 26 + i * 7, sp: 0.12 + i * 0.03, ph: i * 1.7, y: 10 + (i % 2) * 7 })
      }
      return (t) => { sat.forEach((s2) => { const a = t * s2.sp + s2.ph; s2.g.position.set(Math.cos(a) * s2.r, s2.y, Math.sin(a) * s2.r - 4); s2.g.rotation.y = -a }); p1.rotation.y = t * 0.02; p2.rotation.y = t * 0.03; moon.rotation.y = t * 0.04; stars.rotation.y = t * 0.002 }
    },
  }
}
function voxel(): Skin {
  const lighten = (c: number, t: number) => mixHex(c, 0xFFFFFF, t)
  return {
    id: 'voxel', stage: { fov: 28, fog: [90, 260], bloom: 0, sky: ['#6FC3FF', '#B7E3FF', '#FFF4E2'], fogColor: 0xDFF1FF, offsetX: 0.17 }, dir: [0.35, 0.6, 1], k: 3.5, fov: 28, lines: 0, day: true,
    mat(role, c) {
      const col = role === 'glass' ? lighten(c, 0.55) : role === 'dark' ? 0x4A5A8C : role === 'metal' ? 0xC3CDE6 : role === 'gold' ? PAL.gold : c
      if (role === 'glow') return new T.MeshBasicMaterial({ color: lin(lighten(c, 0.1)), toneMapped: false })
      return new T.MeshStandardMaterial({ color: lin(col), roughness: role === 'metal' ? 0.45 : 0.85, metalness: role === 'metal' || role === 'gold' ? 0.5 : 0.02, emissive: role === 'gold' ? lin(PAL.gold) : new T.Color(0), emissiveIntensity: 0.12 })
    },
    ec: (c) => c,
    win(seed, cols, rows, c) {
      const cv = document.createElement('canvas'); cv.width = cols * 16; cv.height = rows * 8; const x = cv.getContext('2d') as CanvasRenderingContext2D
      x.fillStyle = '#' + new T.Color(lighten(c || 0xE9EEFF, 0.4)).getHexString(); x.fillRect(0, 0, cv.width, cv.height)
      let s = seed; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { x.fillStyle = r() < 0.18 ? '#FFD36B' : '#7FC8FF'; x.fillRect(i * 16 + 3, j * 8 + 2, 10, 4) }
      const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.magFilter = T.NearestFilter
      return new T.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0 })
    },
    pad(w, d, c) {
      const g = new T.Group()
      const p = new T.Mesh(new T.BoxGeometry(w, 0.7, d), new T.MeshStandardMaterial({ color: lin(lighten(c, 0.62)), roughness: 0.9 })); p.position.y = 0.35; g.add(p)
      const top = new T.Mesh(new T.BoxGeometry(w - 0.5, 0.12, d - 0.5), new T.MeshStandardMaterial({ color: lin(lighten(c, 0.82)), roughness: 0.9 })); top.position.y = 0.72; g.add(top)
      return g
    },
    setup(st, root) {
      const sc = st.scene
      sc.add(new T.HemisphereLight(0xFFFFFF, 0xB8D8A0, 0.95))
      const key = new T.DirectionalLight(0xFFF1DC, 1.15); key.position.set(-20, 40, 25); sc.add(key)
      const ft = checker('#E9F7E4', '#D9F0D2'); ft.repeat.set(36, 36)
      const floor = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshStandardMaterial({ map: ft, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; root.add(floor)
      /* cây và đám mây khối */
      let s = 4; const rn = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
      for (let i = 0; i < 40; i++) {
        const a = rn() * Math.PI * 2, r = 34 + rn() * 50, h = 2 + rn() * 3
        const g = new T.Group(); const tr = new T.Mesh(new T.BoxGeometry(0.8, h, 0.8), new T.MeshStandardMaterial({ color: lin(0xA0724A), roughness: 1 })); tr.position.y = h / 2; g.add(tr)
        const lv = new T.Mesh(new T.BoxGeometry(3, 3, 3), new T.MeshStandardMaterial({ color: lin([0x5ED48C, 0x3FBF7A, 0x8FE0A0][i % 3]), roughness: 1 })); lv.position.y = h + 1.2; g.add(lv)
        g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 10); root.add(g)
      }
      const clouds: T.Group[] = []
      for (let i = 0; i < 7; i++) {
        const g = new T.Group(); for (let j = 0; j < 4; j++) { const b = new T.Mesh(new T.BoxGeometry(5 + rn() * 5, 2 + rn() * 2, 4 + rn() * 3), new T.MeshBasicMaterial({ color: 0xFFFFFF, toneMapped: false })); b.position.set(j * 4 - 6, rn() * 1.5, rn() * 2); g.add(b) }
        g.position.set(-80 + i * 28, 30 + (i % 3) * 6, -60 - (i % 2) * 20); root.add(g); clouds.push(g)
      }
      return (t) => clouds.forEach((c, i) => { c.position.x += 0.01 + i * 0.002; if (c.position.x > 110) c.position.x = -110 })
    },
  }
}
function blueprint(): Skin {
  return {
    id: 'blueprint', stage: { fov: 30, fog: [80, 260], bloom: 0.4, sky: ['#06214F', '#0B3A82', '#1253B5'], fogColor: 0x0B3A82 }, dir: [0.3, 0.55, 1], k: 3.4, fov: 30, lines: 1.15, day: false,
    mat(role, c) {
      const col = role === 'gold' ? 0xFFE08A : role === 'dark' ? 0x0F3A8A : role === 'metal' ? 0x7FB0FF : mixHex(0x2D6BFF, c, 0.25)
      if (role === 'glow') return new T.MeshBasicMaterial({ color: lin(0xD8F0FF).multiplyScalar(1.4), toneMapped: false })
      return new T.MeshStandardMaterial({ color: lin(col), transparent: true, opacity: role === 'dark' ? 0.7 : 0.32, roughness: 0.6, metalness: 0.1, emissive: lin(c), emissiveIntensity: 0.18, depthWrite: false })
    },
    ec: (c) => mixHex(0xBFE4FF, c, 0.2),
    win: (seed, cols, rows) => {
      const cv = document.createElement('canvas'); cv.width = cols * 16; cv.height = rows * 8; const x = cv.getContext('2d') as CanvasRenderingContext2D
      x.clearRect(0, 0, cv.width, cv.height); x.strokeStyle = 'rgba(200,235,255,.7)'; x.lineWidth = 1.5
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) x.strokeRect(i * 16 + 3, j * 8 + 2, 10, 4)
      const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding
      return new T.MeshStandardMaterial({ map: t, color: lin(0x2D6BFF), transparent: true, opacity: 0.9, emissive: lin(0x2D6BFF), emissiveIntensity: 0.3, depthWrite: false })
    },
    pad(w, d, c) {
      const g = new T.Group()
      const p = new T.Mesh(new T.BoxGeometry(w, 0.2, d), new T.MeshStandardMaterial({ color: lin(0x2D6BFF), transparent: true, opacity: 0.25, depthWrite: false })); p.position.y = 0.1; g.add(p)
      const be = edges(p.geometry, 0xBFE4FF, 1.1); be.position.y = 0.1; g.add(be)
      const q = new T.Mesh(new T.BoxGeometry(w + 1.2, 0.02, d + 1.2), new T.MeshBasicMaterial({ color: lin(0x7FB0FF), transparent: true, opacity: 0.2, toneMapped: false, depthWrite: false })); q.position.y = 0.02; g.add(q)
      return g
    },
    setup(st, root) {
      st.scene.add(new T.HemisphereLight(0xBFD4FF, 0x0B3A82, 1.1))
      const l = new T.DirectionalLight(0xFFFFFF, 0.8); l.position.set(-20, 30, 20); st.scene.add(l)
      grid(root, 200, 0xBFE4FF, -0.02, 2)
      const gc = document.createElement('canvas'); gc.width = gc.height = 128; const x = gc.getContext('2d') as CanvasRenderingContext2D
      x.strokeStyle = 'rgba(190,225,255,.28)'; x.lineWidth = 1.5; for (let i = 0; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.moveTo(0, i); x.lineTo(128, i); x.stroke() }
      x.strokeStyle = 'rgba(190,225,255,.6)'; x.lineWidth = 2.5; x.strokeRect(0, 0, 128, 128)
      const gt = new T.CanvasTexture(gc); gt.wrapS = gt.wrapT = T.RepeatWrapping; gt.repeat.set(20, 8); gt.encoding = T.sRGBEncoding
      const wall = new T.Mesh(new T.PlaneGeometry(200, 80), new T.MeshBasicMaterial({ map: gt, transparent: true, toneMapped: false, fog: false })); wall.position.set(0, 32, -48); root.add(wall)
      for (const [r, x2, y2] of [[22, -40, 24], [12, 46, 36]] as [number, number, number][]) { const c = new T.Mesh(new T.TorusGeometry(r, 0.12, 6, 90), neon(0xBFE4FF, 0.9)); c.position.set(x2, y2, -46); root.add(c); const c2 = new T.Mesh(new T.TorusGeometry(r * 0.7, 0.08, 6, 90), neon(0x7FB0FF, 0.8)); c2.position.copy(c.position); root.add(c2) }
      const dt = dust(root, 120, [90, 30, 70], [0, 10, 0], 0xBFE4FF, 3)
      return (t) => dt(t)
    },
  }
}
function neonCity(): Skin {
  const cars: { m: T.Mesh; z: number; sp: number; o: number }[] = []
  return {
    id: 'neon', stage: { fov: 30, fog: [70, 230], bloom: 1.0, sky: ['#0A0420', '#2A0B4A', '#8A1B6E'], fogColor: 0x240A44 }, dir: [0.15, 0.3, 1], k: 3.4, fov: 30, lines: 1.8, day: false,
    mat(role, c) {
      switch (role) {
        case 'body': return new T.MeshStandardMaterial({ color: lin(0x140A33), emissive: lin(c), emissiveIntensity: 0.14, roughness: 0.35, metalness: 0.6 })
        case 'glass': return glass(0x1A0F45, c, 0.35)
        case 'dark': return metal(0x2A1A5E, 0.4)
        case 'glow': return neon(c, 1.6)
        case 'metal': return metal(0x6A5AB0, 0.3)
        default: return goldMat(0.4)
      }
    },
    ec: (c) => c,
    win: (seed, cols, rows, c) => winMat(seed, cols, rows, c || 0x120A2E, 0.6),
    pad(w, d, c) {
      const g = new T.Group()
      const p = new T.Mesh(new T.BoxGeometry(w, 0.3, d), new T.MeshStandardMaterial({ color: lin(0x0C0522), roughness: 0.4, metalness: 0.6 })); p.position.y = 0.15; g.add(p)
      const ne = edges(p.geometry, c, 1.8); ne.position.y = 0.15; g.add(ne)
      const gl = new T.Mesh(new T.PlaneGeometry(w + 3, d + 3), new T.MeshBasicMaterial({ map: radial('#' + new T.Color(c).getHexString() + 'AA', '#00000000'), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.04; g.add(gl)
      return g
    },
    setup(st, root) {
      const sc = st.scene
      sc.environment = nightEnv()
      sc.add(new T.HemisphereLight(0x8A5BFF, 0x1A0A38, 0.9))
      const a = new T.DirectionalLight(0xFF4DA6, 1.4); a.position.set(-30, 14, -26); sc.add(a)
      const b = new T.DirectionalLight(0x27D3FF, 1.4); b.position.set(34, 14, -30); sc.add(b)
      const k = new T.DirectionalLight(0xD9C7FF, 0.8); k.position.set(0, 40, 30); sc.add(k)
      grid(root, 240, PAL.pink, -0.02, 3)
      grid(root, 240, PAL.cyan, -0.03, 6)
      const floor = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshBasicMaterial({ color: lin(0x0A0420), toneMapped: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.06; root.add(floor)
      const sun = new T.Mesh(new T.CircleGeometry(26, 48), new T.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d') as CanvasRenderingContext2D; const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#FFD36B'); g.addColorStop(0.5, '#FF4DA6'); g.addColorStop(1, '#8A1B6E'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 8; i++) x.fillRect(0, 130 + i * 16, 64, 2 + i * 1.5); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t })(), transparent: true, toneMapped: false, fog: false })); sun.position.set(0, 26, -120); root.add(sun)
      const wm = winMat(7, 5, 24, 0x0E0624, 0.65)
      let s = 21; const rn = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
      for (let i = 0; i < 40; i++) {
        const x = -110 + i * 5.6 + rn() * 2, h = 14 + rn() * 38, z = -60 - rn() * 40
        const m = new T.Mesh(new T.BoxGeometry(4 + rn() * 3, h, 4 + rn() * 3), wm); m.position.set(x, h / 2, z); root.add(m)
        if (rn() < 0.4) { const t = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2), neon(rn() < 0.5 ? PAL.pink : PAL.cyan, 2)); t.position.set(x, h + 0.2, z); t.scale.set(1, 1, 1); root.add(t) }
      }
      for (let i = 0; i < 14; i++) {
        const m = new T.Mesh(new T.BoxGeometry(2.4, 0.08, 0.08), neon(i % 2 ? PAL.pink : PAL.cyan, 2)); root.add(m)
        cars.push({ m, z: -18 - rn() * 30, sp: 8 + rn() * 12, o: rn() * 200 })
        m.position.y = 0.3 + rn() * 0.6
      }
      const dt = dust(root, 160, [100, 40, 70], [0, 12, -10], 0xFF8AD0, 3)
      return (t) => { cars.forEach((c) => { c.m.position.set(-100 + ((c.o + t * c.sp) % 200), c.m.position.y, c.z) }); dt(t) }
    },
  }
}

const MAKERS: Record<SkinId, () => Skin> = { isometric, factory, ecosystem, orbit, voxel, blueprint, neon: neonCity }
export const makeSkin = (id: SkinId): Skin => MAKERS[id]()
