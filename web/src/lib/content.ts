import defaults from '../../../server/seed/defaults.json'

export type Lang = 'vi' | 'en'
export interface Pair { vi: string; en?: string; x?: string }
export interface OvItem { vi?: string; en?: string; x?: string }
export interface Faq { id: string; cat: Pair; q: Pair; a: Pair; home?: boolean }
export interface Partner { id?: string; name: string; url?: string; logo: string; group: Pair }
export interface LegalDoc { title: Pair; updated: Pair; body: Pair }
export interface QuotePlan { id: string; name: Pair; price: Pair; unit: Pair; desc: Pair; features: Pair[]; hot?: boolean }
export interface Quote { plans: QuotePlan[] }
export interface Content {
  v?: number
  ov: Record<string, OvItem>
  faq: Faq[]
  partners: Partner[]
  settings: Record<string, string>
  legal: Record<string, LegalDoc>
  quote?: Quote
}

/** Nội dung mặc định (cùng nguồn với server/seed/defaults.json) để hiện ngay trước khi tải /api/content. */
export const DEFAULTS = defaults as unknown as { faq: Faq[]; partners: Partner[]; settings: Record<string, string>; legal: Record<string, LegalDoc>; quote: Quote }

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
  facebook: '', zalo: '', tiktok: '', youtube: '', instagram: '',
  site_title: '', meta_description: '', analytics_id: '', scene_style: 'classic', demo_url: 'https://demo.3rdvn.io.vn',
}

export const SLUGS = ['mo-hinh', 'advertiser', 'san-pham', 'cong-nghe', 'doi-tac', 'hoi-dap', 'lien-he'] as const
export type Slug = (typeof SLUGS)[number]
export const LEGAL_SLUGS: Record<string, 'terms' | 'privacy'> = { 'dieu-khoan': 'terms', 'bao-mat': 'privacy' }

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
