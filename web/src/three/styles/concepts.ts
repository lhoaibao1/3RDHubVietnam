// Các cảnh nội dung: mỗi trang module có một cảnh riêng (khác bố cục, khác chi tiết) cho đúng nội dung của trang.
// `flow` là cảnh trang chủ (năm bước). Mọi cảnh dựng bằng chi tiết và vật liệu của skin đang chọn.
import * as T from 'three'
import { PAL } from './kit'
import { barChart, bank, bubble, building, card, container, coinStack, database, doc, envelope, gear, headset, house, link, magnifier, mast, person, phone, pin, place, servers, shield, tag, textSprite, tile, tower, type Ctx, type Part } from './parts'

export interface Focus { look: [number, number, number]; r: number }
export interface Built { foci: Record<string, Focus>; anchors: Record<string, T.Vector3> }
const up = (p: Part, x: number, z: number, y = 0) => new T.Vector3(x, p.top + y, z)

/** Cảnh trang chủ: năm bước, từ Advertiser tới hoa hồng, nối nhau bằng đường dữ liệu có hạt chạy. */
function flow(c: Ctx): Built {
  const A = place(c, tag(c, building(c, PAL.orange, 6), 'Advertiser', 'Campaigns', PAL.orange, 'building-2'), -16, 0, 3, [7, 7, PAL.orange])
  const H = place(c, tag(c, tower(c, PAL.cyan), '3RDHub', 'Core platform', PAL.cyan), -8, 0, -3, [7.4, 7.4, PAL.cyan])
  const P = place(c, tag(c, mast(c, PAL.mint), 'Publisher', 'Share links', PAL.mint, 'megaphone'), 0, 0, -4, [7, 7, PAL.mint])
  const U = place(c, tag(c, person(c, PAL.violet), 'Customer', 'Click · Apply', PAL.violet, 'mouse-pointer-click'), 8, 0, -2, [6, 6, PAL.violet])
  const B = place(c, tag(c, bank(c, PAL.gold), 'Commission', 'Wallet', PAL.gold, 'wallet'), 16, 0, 3, [7.4, 7.4, PAL.gold])
  link(c, [[-16, 0.6, 3], [-12, 1.2, 0], [-8, 0.6, -3]], PAL.orange, 3, 0.1)
  link(c, [[-8, 0.6, -3], [-4, 1.2, -5], [0, 0.6, -4]], PAL.cyan, 3, 0.1)
  link(c, [[0, 0.6, -4], [4, 1.2, -4], [8, 0.6, -2]], PAL.mint, 3, 0.1)
  link(c, [[8, 0.6, -2], [12, 1.2, 0], [16, 0.6, 3]], PAL.violet, 3, 0.1)
  const f = (x: number, z: number, r = 10, y = 3.5): Focus => ({ look: [x, y, z], r })
  return {
    foci: { overview: { look: [0, 3.5, -1], r: 21 }, advertiser: f(-16, 3), hub: f(-8, -3, 11, 4.5), publisher: f(0, -4), customer: f(8, -2), commission: f(16, 3) },
    anchors: { advertiser: up(A, -16, 3), hub: up(H, -8, -3), publisher: up(P, 0, -4), customer: up(U, 8, -2), commission: up(B, 16, 3) },
  }
}

/** Trang Mô hình: ba bên (Advertiser, 3RDHub, Publisher) và khách hàng, hồ sơ và hoa hồng chạy hai chiều. */
function model(c: Ctx): Built {
  const A = place(c, tag(c, building(c, PAL.orange, 6), 'Advertiser', 'Campaigns', PAL.orange, 'building-2'), -11, 0, 4, [7, 7, PAL.orange])
  const H = place(c, tag(c, tower(c, PAL.cyan), '3RDHub', 'Core platform', PAL.cyan), 0, 0, -5, [7.4, 7.4, PAL.cyan])
  const P = place(c, tag(c, mast(c, PAL.mint), 'Publisher', 'Share links', PAL.mint, 'megaphone'), 11, 0, 4, [7, 7, PAL.mint])
  const U = place(c, tag(c, person(c, PAL.violet), 'Customer', 'Apply', PAL.violet), 0, 0, 12, [5.6, 5.6, PAL.violet])
  link(c, [[-11, 0.8, 4], [-6, 1.6, -1], [0, 0.8, -5]], PAL.orange, 3, 0.1)
  link(c, [[0, 0.8, -5], [-5, 2.2, 0], [-11, 0.8, 4]], PAL.gold, 2, 0.08, 0.22)
  link(c, [[0, 0.8, -5], [6, 1.6, -1], [11, 0.8, 4]], PAL.cyan, 3, 0.1)
  link(c, [[11, 0.8, 4], [6, 1.4, 9], [0, 0.8, 12]], PAL.mint, 3, 0.1)
  link(c, [[0, 0.8, 12], [0, 2.4, 4], [0, 0.8, -5]], PAL.violet, 3, 0.1)
  for (let i = 0; i < 3; i++) {
    const d = doc(c, PAL.orange); c.root.add(d)
    c.tick((t) => { const u = (t * 0.12 + i / 3) % 1; const a = u * Math.PI * 2; d.position.set(Math.sin(a) * 7, 5.5 + Math.sin(a * 2) * 0.6, Math.cos(a) * 3.4 + 1.5); d.rotation.y = a })
  }
  return {
    foci: { overview: { look: [0, 3.5, 3], r: 17 }, advertiser: { look: [-11, 3.5, 4], r: 9 }, hub: { look: [0, 4.5, -5], r: 10 }, publisher: { look: [11, 3.5, 4], r: 9 }, customer: { look: [0, 3, 12], r: 8 } },
    anchors: { advertiser: up(A, -11, 4), hub: up(H, 0, -5), publisher: up(P, 11, 4), customer: up(U, 0, 12) },
  }
}

/** Trang Advertiser: chiến dịch, biểu đồ ngân sách đi lên và ba cách làm (chạy chiến dịch, hệ thống riêng, bản quyền). */
function advertiser(c: Ctx): Built {
  const B = place(c, tag(c, building(c, PAL.violet, 7.5), 'Advertiser', 'Your campaigns', PAL.violet, 'building-2'), -12, 0, -1, [8, 8, PAL.violet])
  const G = place(c, tag(c, barChart(c, PAL.cyan), 'Performance', 'Pay per result', PAL.cyan, 'chart-column'), -1, 0, -3, [7.5, 6, PAL.cyan])
  const cs = coinStack(c, 6); cs.position.set(2.8, 0, -1.2); c.root.add(cs)
  const o1 = place(c, tag(c, card(c, PAL.orange), 'Run campaigns', 'On 3RDHub', PAL.orange), 10, 0, -6, [6, 5, PAL.orange])
  const o2 = place(c, tag(c, servers(c, PAL.mint, 3), 'Own system', 'White-label', PAL.mint), 10, 0, 1, [6, 5, PAL.mint])
  const o3 = place(c, tag(c, shield(c, PAL.pink), 'License', 'Source & rights', PAL.pink), 10, 0, 8, [6, 5, PAL.pink])
  link(c, [[-12, 0.8, -1], [-6, 1.6, -3], [-1, 0.8, -3]], PAL.violet, 3, 0.1)
  for (const [x, z, col] of [[10, -6, PAL.orange], [10, 1, PAL.mint], [10, 8, PAL.pink]] as [number, number, number][]) link(c, [[-1, 0.8, -3], [4, 1.8, (z - 3) / 2], [x, 0.8, z]], col, 2, 0.09)
  return {
    foci: { overview: { look: [0, 3.5, 1], r: 19 }, building: { look: [-12, 4, -1], r: 11 }, chart: { look: [-1, 3, -3], r: 9 }, options: { look: [10, 3, 1], r: 12 } },
    anchors: { advertiser: up(B, -12, -1), chart: up(G, -1, -3), a: up(o1, 10, -6), b: up(o2, 10, 1), c: up(o3, 10, 8) },
  }
}

/** Trang Công nghệ: Vue/Vite → Nginx → Go → PostgreSQL/Redis, đóng gói Docker, có lớp bảo mật. */
function tech(c: Ctx): Built {
  const F = place(c, tag(c, tile(c, PAL.mint, 'brand:vuedotjs', 3), 'Frontend', 'Vue 3 · Vite · Pinia', PAL.mint), -15, 0, 3, [5, 5, PAL.mint])
  const N = place(c, tag(c, tile(c, PAL.cyan, 'brand:nginx', 2.6), 'Nginx', 'Edge · Cache', PAL.cyan), -7.5, 0, -3, [5, 5, PAL.cyan])
  const Bk = place(c, tag(c, gear(c, PAL.cyan, 1.5), 'Backend', 'Go · REST API', PAL.cyan, 'brand:go'), 0, 0, -5, [7, 7, PAL.cyan])
  const Db = place(c, tag(c, database(c, PAL.violet), 'PostgreSQL', 'Source of truth', PAL.violet, 'brand:postgresql'), 8, 0, 2, [6, 6, PAL.violet])
  const Rd = place(c, tag(c, tile(c, PAL.pink, 'brand:redis', 2.6), 'Redis', 'Queue · Cache', PAL.pink), 8, 0, -9, [5, 5, PAL.pink])
  const Dk = place(c, tag(c, container(c, PAL.orange), 'Docker', 'Ship anywhere', PAL.orange, 'brand:docker'), 15, 0, -5, [6, 5, PAL.orange])
  const Sh = place(c, tag(c, shield(c, PAL.gold), 'Security', 'Keys · Roles · Logs', PAL.gold), 0, 0, 9, [6, 5, PAL.gold])
  link(c, [[-15, 0.8, 3], [-11, 1.6, 0], [-7.5, 0.8, -3]], PAL.mint, 3, 0.12)
  link(c, [[-7.5, 0.8, -3], [-4, 1.6, -5], [0, 0.8, -5]], PAL.cyan, 3, 0.12)
  link(c, [[0, 0.8, -5], [4, 1.8, -1], [8, 0.8, 2]], PAL.violet, 3, 0.12)
  link(c, [[0, 0.8, -5], [4, 1.8, -8], [8, 0.8, -9]], PAL.pink, 2, 0.1)
  link(c, [[8, 0.8, -9], [12, 1.8, -7], [15, 0.8, -5]], PAL.orange, 2, 0.1)
  link(c, [[0, 0.8, 9], [0, 1.8, 2], [0, 0.8, -5]], PAL.gold, 2, 0.08)
  return {
    foci: { overview: { look: [0, 3, -1], r: 20 }, front: { look: [-12, 2.5, 0], r: 10 }, back: { look: [2, 3, -4], r: 12 }, data: { look: [10, 3, -3], r: 12 } },
    anchors: { f: up(F, -15, 3), n: up(N, -7.5, -3), b: up(Bk, 0, -5), d: up(Db, 8, 2) },
  }
}

/** Trang Đối tác: nền tảng ở giữa bắt tay với bốn nhóm sản phẩm (thẻ, vay, bảo hiểm, tài khoản số). */
function partners(c: Ctx): Built {
  const Hh = place(c, tag(c, tile(c, PAL.mint, 'handshake', 4), '3RDHub × Partners', 'Win-win', PAL.mint), 0, 0, -1, [8, 8, PAL.mint])
  const Cd = place(c, tag(c, card(c, PAL.orange), 'Credit cards', 'Sign-up', PAL.orange), -12, 0, -2, [6.4, 5.4, PAL.orange])
  const Ln = place(c, tag(c, house(c, PAL.cyan), 'Consumer loans', 'Approval', PAL.cyan), -6, 0, 9, [6.4, 5.4, PAL.cyan])
  const In = place(c, tag(c, shield(c, PAL.pink), 'Health insurance', 'Protection', PAL.pink), 6, 0, 9, [6.4, 5.4, PAL.pink])
  const Ac = place(c, tag(c, phone(c, PAL.violet), 'Digital accounts', 'eKYC', PAL.violet), 12, 0, -2, [6.4, 5.4, PAL.violet])
  const Cn = coinStack(c, 8); Cn.position.set(0, 0, -7); c.root.add(Cn)
  for (const [x, z, col] of [[-12, -2, PAL.orange], [-6, 9, PAL.cyan], [6, 9, PAL.pink], [12, -2, PAL.violet]] as [number, number, number][]) {
    link(c, [[0, 0.8, -1], [x / 2, 2, (z - 1) / 2], [x, 0.8, z]], col, 3, 0.1)
    link(c, [[x, 0.8, z], [x / 2, 3, (z - 1) / 2 + 1], [0, 0.8, -1]], PAL.gold, 1, 0.07, 0.2)
  }
  return {
    foci: { overview: { look: [0, 3, 2], r: 19 }, cards: { look: [-12, 3, -2], r: 9 }, loans: { look: [-6, 3, 9], r: 9 }, insure: { look: [6, 3, 9], r: 9 }, account: { look: [12, 3, -2], r: 9 } },
    anchors: { h: up(Hh, 0, -1), c: up(Cd, -12, -2), l: up(Ln, -6, 9), i: up(In, 6, 9), a: up(Ac, 12, -2) },
  }
}

/** Trang Hỏi đáp: dấu hỏi phát sáng ở giữa, các bong bóng hỏi và đáp, kính lúp tìm kiếm, tai nghe hỗ trợ. */
function faq(c: Ctx): Built {
  const base = place(c, { g: new T.Group(), top: 0 }, 0, 0, 0, [8, 8, PAL.orange])
  void base
  const q = textSprite('?', PAL.gold, 8); q.position.set(0, 6, 0); c.root.add(q)
  const hl = new T.Mesh(new T.TorusGeometry(3.6, 0.07, 8, 80), c.sk.mat('glow', PAL.gold)); hl.rotation.x = Math.PI / 2; hl.position.y = 0.9; c.root.add(hl)
  const M = place(c, tag(c, magnifier(c, PAL.cyan), 'Search', 'Find answers', PAL.cyan, undefined, -0.6), -11, 0, 2, [6, 6, PAL.cyan])
  const Hs = place(c, tag(c, headset(c, PAL.pink), 'Support', 'Hotline · Email', PAL.pink, undefined, -0.4), 11, 0, 2, [6, 6, PAL.pink])
  const bubbles: [number, number, number, number, string, boolean][] = [[-7, 5.5, -7, PAL.orange, 'Q', false], [7, 6.5, -8, PAL.mint, 'A', true], [-3, 8.5, 6, PAL.violet, '?', false], [4, 4.5, 8, PAL.cyan, '', true], [-12, 6.5, -4, PAL.mint, 'A', true], [12, 7, -4, PAL.orange, 'Q', false]]
  bubbles.forEach(([x, y, z, col, tx, fl], i) => {
    const b = bubble(c, col, tx, fl); b.g.position.set(x, y, z); c.root.add(b.g)
    c.tick((t) => { b.g.position.y = y + Math.sin(t * 1.1 + i * 1.3) * 0.5; b.g.rotation.y = Math.sin(t * 0.5 + i) * 0.4 })
  })
  c.tick((t) => { q.position.y = 6 + Math.sin(t * 1.2) * 0.4; hl.scale.setScalar(1 + Math.sin(t * 2) * 0.04) })
  return {
    foci: { overview: { look: [0, 4, 0], r: 18 }, search: { look: [-11, 3, 2], r: 9 }, support: { look: [11, 3, 2], r: 9 } },
    anchors: { q: new T.Vector3(0, 11, 0), s: up(M, -11, 2), h: up(Hs, 11, 2) },
  }
}

/** Trang Liên hệ: phong bì bay, điện thoại, ghim bản đồ có sóng lan, tai nghe hỗ trợ. */
function contact(c: Ctx): Built {
  const Pn = place(c, tag(c, pin(c, PAL.pink), 'Da Nang, Vietnam', 'Visit us', PAL.pink), -11, 0, 1, [7, 7, PAL.pink])
  const En = place(c, tag(c, envelope(c, PAL.orange), 'Email', 'We reply fast', PAL.orange, undefined, -0.4), 0, 0, -4, [7, 6, PAL.orange])
  const Ph = place(c, tag(c, phone(c, PAL.cyan), 'Hotline', 'Call us', PAL.cyan), 11, 0, 1, [6, 6, PAL.cyan])
  const Hs = place(c, tag(c, headset(c, PAL.mint), 'Support team', 'Mon – Fri', PAL.mint, undefined, -0.4), 0, 0, 9, [7, 6, PAL.mint])
  link(c, [[-11, 0.8, 1], [-6, 1.8, -2], [0, 0.8, -4]], PAL.pink, 3, 0.1)
  link(c, [[0, 0.8, -4], [6, 1.8, -2], [11, 0.8, 1]], PAL.orange, 3, 0.1)
  link(c, [[11, 0.8, 1], [6, 1.6, 6], [0, 0.8, 9]], PAL.cyan, 3, 0.1)
  link(c, [[0, 0.8, 9], [-6, 1.6, 6], [-11, 0.8, 1]], PAL.mint, 3, 0.1)
  const dots = new T.Group(); c.root.add(dots)
  for (let i = 0; i < 5; i++) { const b = bubble(c, PAL.gold); b.g.scale.setScalar(0.55); dots.add(b.g); const a0 = (i / 5) * Math.PI * 2; c.tick((t) => { const a = a0 + t * 0.25; b.g.position.set(Math.cos(a) * 7, 7 + Math.sin(t + i) * 0.5, Math.sin(a) * 5 + 2); b.g.rotation.y = -a }) }
  return {
    foci: { overview: { look: [0, 3.5, 2], r: 18 }, map: { look: [-11, 3, 1], r: 9 }, mail: { look: [0, 3, -4], r: 9 }, phone: { look: [11, 3, 1], r: 9 } },
    anchors: { m: up(Pn, -11, 1), e: up(En, 0, -4), p: up(Ph, 11, 1), h: up(Hs, 0, 9) },
  }
}

export const CONCEPTS: Record<string, (c: Ctx) => Built> = {
  flow, 'mo-hinh': model, advertiser, 'cong-nghe': tech, 'doi-tac': partners, 'hoi-dap': faq, 'lien-he': contact,
}
