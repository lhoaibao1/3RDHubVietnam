// Giao diện chọn được trong CMS (tab Giao diện): nền của từng khu vực và hiệu ứng khi cuộn trang.
// Dùng chung cho website (áp dụng) và trang quản trị (ô xem trước). Danh sách mã phải khớp với server/content.go.

/** Hoạ tiết nền. `sz`/`mv`: kích thước ô lặp (background-size) và quãng trôi (cho từng lớp gradient). */
export const BG_PATTERNS: { id: string; name: string; sz: string; mv: string }[] = [
  { id: 'grid', name: 'Lưới ô vuông', sz: '44px 44px', mv: '44px 44px' },
  { id: 'dots', name: 'Chấm nhỏ', sz: '26px 26px', mv: '26px 26px' },
  { id: 'polka', name: 'Chấm bi hai màu', sz: '42px 42px', mv: '42px 42px,63px 63px' },
  { id: 'sparkle', name: 'Sao lấp lánh', sz: '46px 46px', mv: '46px 46px,46px 46px' },
  { id: 'circuit', name: 'Mạch điện', sz: '56px 56px,56px 56px,112px 112px', mv: '56px 56px,56px 56px,112px 112px' },
  { id: 'rings', name: 'Vòng tròn đồng tâm', sz: 'auto', mv: '0 0' },
  { id: 'waves', name: 'Sóng', sz: 'auto', mv: '0 0' },
  { id: 'topo', name: 'Đường đồng mức', sz: 'auto', mv: '0 0' },
  { id: 'diag', name: 'Sọc chéo', sz: 'auto', mv: '48px 0' },
  { id: 'hatch', name: 'Đan chéo', sz: '36px 36px', mv: '36px 36px,36px 36px' },
  { id: 'stripes', name: 'Sọc ngang', sz: '16px 16px', mv: '0 16px' },
  { id: 'vlines', name: 'Sọc dọc', sz: '28px 56px,28px 56px', mv: '28px 56px,28px 56px' },
  { id: 'checker', name: 'Bàn cờ', sz: '48px 48px', mv: '48px 48px' },
  { id: 'zig', name: 'Răng cưa', sz: '28px 28px', mv: '14px 0,14px 0,28px 0,28px 0' },
  { id: 'cubes', name: 'Khối lập phương', sz: '56px 98px', mv: '56px 98px,56px 98px,84px 147px,84px 147px,56px 98px,84px 147px' },
  { id: 'bokeh', name: 'Đốm sáng mờ', sz: '100% 100%', mv: '0 0' },
  { id: 'aurora', name: 'Chỉ vệt màu (không hoạ tiết)', sz: 'auto', mv: '0 0' },
  { id: 'none', name: 'Không nền', sz: 'auto', mv: '0 0' },
]

/** Các khu vực đặt nền riêng: `sel` là bộ chọn CSS trên website; `bg` là nền mặc định (hoạ tiết|màu 1|màu 2). */
export const BG_AREAS: { id: string; name: string; group: string; sel: string; bg: string }[] = [
  { id: 'home-biz', name: 'Doanh nghiệp', group: 'Trang chủ', sel: '.biz', bg: 'grid|#7B4DFF|#FF4D8D' },
  { id: 'home-tech', name: 'Công nghệ', group: 'Trang chủ', sel: '.tech', bg: 'circuit|#00ADD8|#42B883' },
  { id: 'home-partners', name: 'Đối tác', group: 'Trang chủ', sel: '.partners', bg: 'rings|#12A06A|#FFB238' },
  { id: 'home-faq', name: 'Hỏi đáp', group: 'Trang chủ', sel: '.faq', bg: 'waves|#FFB238|#FF6A2B' },
  { id: 'home-contact', name: 'Liên hệ', group: 'Trang chủ', sel: '#lien-he:not(.pg)', bg: 'diag|#FF4D8D|#FF6A2B' },
  { id: 'mo-hinh', name: 'Mô hình', group: 'Trang con', sel: '#p-mo-hinh', bg: 'polka|#FF6A2B|#7B4DFF' },
  { id: 'advertiser', name: 'Advertiser', group: 'Trang con', sel: '#p-advertiser', bg: 'cubes|#7B4DFF|#FF4D8D' },
  { id: 'san-pham', name: 'Sản phẩm', group: 'Trang con', sel: '#p-san-pham', bg: 'stripes|#1BA6D9|#7B4DFF' },
  { id: 'bao-gia', name: 'Báo giá', group: 'Trang con', sel: '#p-bao-gia', bg: 'checker|#FFB238|#FF6A2B' },
  { id: 'cong-nghe', name: 'Công nghệ', group: 'Trang con', sel: '#p-cong-nghe', bg: 'vlines|#00ADD8|#42B883' },
  { id: 'doi-tac', name: 'Đối tác', group: 'Trang con', sel: '#p-doi-tac', bg: 'bokeh|#12A06A|#1BA6D9' },
  { id: 'hoi-dap', name: 'Hỏi đáp', group: 'Trang con', sel: '#p-hoi-dap', bg: 'zig|#FFB238|#FF6A2B' },
  { id: 'lien-he', name: 'Liên hệ', group: 'Trang con', sel: '#p-lien-he', bg: 'topo|#FF4D8D|#FFB238' },
  { id: 'dang-ky', name: 'Đăng ký sản phẩm', group: 'Trang con', sel: '#p-dang-ky', bg: 'sparkle|#FF6A2B|#1BA6D9' },
  { id: 'chinh-sach', name: 'Chính sách, điều khoản', group: 'Trang con', sel: '.legalpg', bg: 'hatch|#5B6279|#7B4DFF' },
]

export interface Bg { pat: string; c1: string; c2: string }
const HEX = /^#[0-9a-fA-F]{6}$/

/** Đọc giá trị "hoạ tiết|#màu1|#màu2"; phần thiếu hoặc sai lấy theo mặc định của khu vực. */
export function parseBg(v: string | undefined, def: string): Bg {
  const d = def.split('|'), p = (v || '').split('|')
  const pat = BG_PATTERNS.some((x) => x.id === p[0]) ? p[0] : d[0]
  return { pat, c1: HEX.test(p[1] || '') ? p[1] : d[1], c2: HEX.test(p[2] || '') ? p[2] : d[2] }
}
export const bgValue = (b: Bg) => [b.pat, b.c1, b.c2].join('|')

/** Khai báo CSS đặt lên khu vực (biến của backgrounds.css). */
export function bgDecl(b: Bg): string {
  const p = BG_PATTERNS.find((x) => x.id === b.pat) || BG_PATTERNS[0]
  const pat = p.id === 'aurora' || p.id === 'none' ? 'none' : `var(--${p.id})`
  return `--bt:${b.c1};--bt2:${b.c2};--pat:${pat};--patsz:${p.sz};--patmv:${p.mv}`
}

/** Toàn bộ CSS cho các khu vực có nền khác mặc định. */
export function bgCss(settings: Record<string, string> | undefined): string {
  let out = ''
  for (const a of BG_AREAS) {
    const v = settings?.['bg_' + a.id]
    if (!v) continue
    const b = parseBg(v, a.bg)
    out += `${a.sel}{${bgDecl(b)}}`
    if (b.pat === 'none') out += `${a.sel}::before,${a.sel}::after{display:none}`
  }
  return out
}

/** Hiệu ứng khi phần tử cuộn vào màn hình (cả khi cuộn xuống lẫn cuộn lên). */
export const SCROLL_FX: { id: string; name: string; desc: string }[] = [
  { id: 'rise', name: 'Trồi lên', desc: 'Mờ dần và trượt nhẹ theo hướng cuộn. Mặc định, nhẹ nhàng.' },
  { id: 'fade', name: 'Hiện mờ', desc: 'Chỉ mờ dần, không di chuyển. Tinh tế nhất.' },
  { id: 'zoom', name: 'Phóng to', desc: 'Từ nhỏ phóng ra đúng kích thước.' },
  { id: 'pop', name: 'Bật nảy', desc: 'Phóng ra và nảy nhẹ như lò xo. Vui, năng động.' },
  { id: 'slide', name: 'Trượt hai bên', desc: 'Khối lẻ trượt từ trái, khối chẵn trượt từ phải.' },
  { id: 'flip', name: 'Lật 3D', desc: 'Lật từ phía sau ra như trang sách, có chiều sâu.' },
  { id: 'tilt', name: 'Nghiêng xoay', desc: 'Xoay nhẹ một góc rồi thẳng lại.' },
  { id: 'skew', name: 'Xô lệch', desc: 'Kéo xiên rồi bật thẳng, cảm giác tốc độ.' },
  { id: 'blur', name: 'Lấy nét', desc: 'Từ nhoè sang nét như ống kính máy ảnh.' },
  { id: 'curtain', name: 'Màn kéo', desc: 'Lộ dần như kéo rèm theo hướng cuộn.' },
  { id: 'swing', name: 'Cánh cửa', desc: 'Xoay quanh mép trái như mở cánh cửa.' },
  { id: 'none', name: 'Không hiệu ứng', desc: 'Hiện ngay, không chuyển động.' },
]
export const isScrollFx = (v: unknown): v is string => typeof v === 'string' && SCROLL_FX.some((x) => x.id === v)
