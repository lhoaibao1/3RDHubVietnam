import type { Client, Content, Faq, LegalDoc, Partner, Product, Quote } from '@/lib/content'

export interface Defaults { faq: Faq[]; partners: Partner[]; settings: Record<string, string>; legal: Record<string, LegalDoc>; quote: Quote; clients: Client[]; product: Product }
export interface Bootstrap { content: Content; defaults: Defaults; leads: Record<string, number>; updated: number }
export interface Lead {
  id: number; ts: number; name: string; phone: string; company: string; need: string; message: string
  lang: string; ip: string; ua: string; email?: string; status: 'new' | 'contacted' | 'done' | 'spam'; note: string
}
export interface Revision { id: number; ts: number; note: string; ov: number; faq: number; partners: number }
export interface StringItem { k: string; g: string; en: string }
export interface Strings { groups: string[]; items: StringItem[] }

export const LEAD_LABEL: Record<Lead['status'], string> = { new: 'Mới', contacted: 'Đã liên hệ', done: 'Hoàn tất', spam: 'Spam' }
export type TabKey = 'dash' | 'live' | 'text' | 'product' | 'faq' | 'partners' | 'clients' | 'quote' | 'legal' | 'company' | 'seo' | 'look' | 'email' | 'account' | 'leads' | 'history'
/** Thanh bên: sửa chữ ngay trên trang là chính; danh sách (hỏi đáp, đối tác, khách hàng, báo giá) và thông tin công ty tách riêng. */
export const SECTIONS: { title: string; tabs: [TabKey, string][] }[] = [
  { title: '', tabs: [['dash', 'Tổng quan']] },
  { title: 'Nội dung', tabs: [['live', 'Sửa trên trang'], ['text', 'Tìm chữ để sửa']] },
  { title: 'Danh sách', tabs: [['product', 'Sản phẩm, dự án'], ['quote', 'Báo giá, so sánh gói'], ['faq', 'Hỏi đáp'], ['partners', 'Đối tác (logo)'], ['clients', 'Khách hàng'], ['legal', 'Điều khoản, bảo mật']] },
  { title: 'Thông tin', tabs: [['company', 'Công ty, liên hệ, MXH'], ['seo', 'SEO, Google Analytics']] },
  { title: 'Hệ thống', tabs: [['look', 'Giao diện 3D'], ['email', 'Email & Zalo báo tin'], ['account', 'Mật khẩu']] },
  { title: 'Vận hành', tabs: [['leads', 'Yêu cầu khách'], ['history', 'Lịch sử']] },
]
export const TABS: [TabKey, string][] = SECTIONS.flatMap((s) => s.tabs)

export interface Field { key: string; label: string; hint: string; type?: string; big?: boolean; wide?: boolean }
