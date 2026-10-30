import defaults from '../../../server/seed/defaults.json'

export type Lang = 'vi' | 'en'
export interface Pair { vi: string; en?: string; x?: string }
export interface OvItem { vi?: string; en?: string; x?: string }
export interface Faq { id: string; cat: Pair; q: Pair; a: Pair; home?: boolean }
export interface Partner { id?: string; name: string; url?: string; logo: string; group: Pair }
export interface LegalDoc { title: Pair; updated: Pair; body: Pair }
export interface QuotePlan { id: string; name: Pair; price: Pair; unit: Pair; desc: Pair; features: Pair[]; hot?: boolean }
export interface QuoteRow { label: Pair; cells: Pair[] }
export interface Quote { plans: QuotePlan[]; rows?: QuoteRow[] }
export interface Module { id: string; code: Pair; title: Pair; items: Pair[] }
export interface Project { id: string; icon: string; name: Pair; tag: Pair; desc: Pair; points: Pair[] }
export interface Shot { id: string; img: string; label: Pair }
/** shots: null/thiếu = bộ ảnh mặc định, [] = ẩn khu ảnh giao diện */
export interface Product { projects?: Project[]; modules: Module[]; shots?: Shot[] | null }
export interface Client { id: string; name: string; logo: string; url?: string; desc: Pair }
export interface Content {
  v?: number
  ov: Record<string, OvItem>
  faq: Faq[]
  partners: Partner[]
  settings: Record<string, string>
  legal: Record<string, LegalDoc>
  quote?: Quote
  clients?: Client[]
  product?: Product
}

/** Nội dung mặc định (cùng nguồn với server/seed/defaults.json) để hiện ngay trước khi tải /api/content. */
export const DEFAULTS = defaults as unknown as { faq: Faq[]; partners: Partner[]; settings: Record<string, string>; legal: Record<string, LegalDoc>; quote: Quote; clients: Client[]; product: Product }

export const DEF_SETTINGS: Record<string, string> = {
  signup_url: 'https://app.3rdvn.io.vn/auth/login?tab=signup',
  email: 'admin_support@3rdvn.io.vn',
  hotline: '(+84) 398 192 414',
  hotline_tel: '+84398192414',
  company_name: 'Công ty TNHH Công nghệ 3RDVN',
  tax_id: '4001342613',
  address: 'Tổ 10 Tỉnh Thủy, Phường Quảng Phú, Thành phố Đà Nẵng',
  parent_url: 'https://3rdvn.io.vn',
  company_name_en: '3RDVN Technology Co., Ltd',
  address_en: 'Group 10 Tinh Thuy, Quang Phu Ward, Da Nang City, Vietnam', working_hours: '', working_hours_en: '',
  facebook: '', zalo: '', tiktok: '', youtube: '', instagram: '', linkedin: '',
  site_title: '', meta_description: '', analytics_id: '', scene_style: 'classic', demo_url: 'https://demo.3rdvn.io.vn',
  bct_url: 'https://online.gov.vn/nen-tang/07af9ec2-8fb6-4bfa-93ed-b960a9d6f21d',
  dmca_id: '05128573-eeec-4272-ad2b-a37ecfee4803',
}

export const SLUGS = ['mo-hinh', 'advertiser', 'san-pham', 'cong-nghe', 'doi-tac', 'hoi-dap', 'lien-he'] as const
export type Slug = (typeof SLUGS)[number]
export type LegalKey = 'terms' | 'privacy' | 'complaints' | 'pricing' | 'payment' | 'service' | 'refund' | 'support'
/** Các chính sách công bố trên website, theo thứ tự hồ sơ thông báo website với Bộ Công Thương. Nội dung sửa trong CMS (tab Điều khoản, chính sách). */
export const LEGAL_DOCS: { key: LegalKey; slug: string; icon: string }[] = [
  { key: 'privacy', slug: 'bao-mat', icon: 'shield-check' },
  { key: 'complaints', slug: 'khieu-nai', icon: 'message-square-warning' },
  { key: 'pricing', slug: 'chinh-sach-gia', icon: 'tag' },
  { key: 'payment', slug: 'chinh-sach-thanh-toan', icon: 'credit-card' },
  { key: 'service', slug: 'dieu-kien-dich-vu', icon: 'list-checks' },
  { key: 'refund', slug: 'cung-cap-va-hoan-tien', icon: 'undo-2' },
  { key: 'support', slug: 'ho-tro', icon: 'headset' },
  { key: 'terms', slug: 'dieu-khoan', icon: 'file-text' },
]
export const LEGAL_SLUGS: Record<string, LegalKey> = Object.fromEntries(LEGAL_DOCS.map((d) => [d.slug, d.key]))
/** Đường dẫn tải PDF của một chính sách (hoặc 'all': tất cả trong một file), tạo trên máy chủ từ nội dung CMS. */
export const legalPdf = (key: LegalKey | 'all', lang: Lang) => '/api/legal/' + key + '.pdf' + (lang === 'en' ? '?lang=en' : '')

export const NAV: [Slug, string, string][] = [
  ['mo-hinh', 'Mô hình', 'Hành trình một hồ sơ, hình thức hoa hồng, trạng thái đơn'],
  ['advertiser', 'Advertiser', 'Đưa chiến dịch lên mạng lưới publisher'],
  ['san-pham', 'Sản phẩm', 'Hệ thống affiliate riêng và bản quyền 3RDHub'],
  ['cong-nghe', 'Công nghệ', 'Stack, luồng tracking và postback'],
  ['doi-tac', 'Đối tác', 'Ngân hàng, công ty tài chính, mạng affiliate'],
  ['hoi-dap', 'Hỏi đáp', 'Câu hỏi thường gặp theo từng nhóm'],
  ['lien-he', 'Liên hệ', 'Đăng ký publisher hoặc gửi yêu cầu tư vấn'],
]

export const okUrl = (u?: string) => (/^https?:\/\//i.test(u || '') ? (u as string) : '#')
