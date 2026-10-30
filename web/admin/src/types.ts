import type { Content, Faq, LegalDoc, Partner } from '@/lib/content'

export interface Defaults { faq: Faq[]; partners: Partner[]; settings: Record<string, string>; legal: Record<string, LegalDoc> }
export interface Bootstrap { content: Content; defaults: Defaults; leads: Record<string, number>; updated: number }
export interface Lead {
  id: number; ts: number; name: string; phone: string; company: string; need: string; message: string
  lang: string; ip: string; ua: string; status: 'new' | 'contacted' | 'done' | 'spam'; note: string
}
export interface Revision { id: number; ts: number; note: string; ov: number; faq: number; partners: number }
export interface StringItem { k: string; g: string; en: string }
export interface Strings { groups: string[]; items: StringItem[] }

export const LEAD_LABEL: Record<Lead['status'], string> = { new: 'Mới', contacted: 'Đã liên hệ', done: 'Hoàn tất', spam: 'Spam' }
export type TabKey = 'dash' | 'home' | 'model' | 'advertiser' | 'product' | 'tech' | 'partners' | 'faq' | 'contact' | 'legal' | 'chrome' | 'look' | 'leads' | 'history' | 'settings'
/** Thanh bên chia nhóm: mỗi trang của website một tab riêng, chữ và dữ liệu của trang đó nằm cùng chỗ. */
export const SECTIONS: { title: string; tabs: [TabKey, string][] }[] = [
  { title: '', tabs: [['dash', 'Tổng quan']] },
  { title: 'Các trang website', tabs: [['home', 'Trang chủ'], ['model', 'Mô hình'], ['advertiser', 'Advertiser'], ['product', 'Sản phẩm'], ['tech', 'Công nghệ'], ['partners', 'Đối tác'], ['faq', 'Hỏi đáp'], ['contact', 'Liên hệ'], ['legal', 'Pháp lý']] },
  { title: 'Toàn website', tabs: [['chrome', 'Menu và chân trang'], ['look', 'Giao diện 3D'], ['settings', 'Cài đặt chung']] },
  { title: 'Vận hành', tabs: [['leads', 'Yêu cầu khách'], ['history', 'Lịch sử']] },
]
export const TABS: [TabKey, string][] = SECTIONS.flatMap((s) => s.tabs)

export interface Field { key: string; label: string; hint: string; type?: string; big?: boolean; wide?: boolean }
