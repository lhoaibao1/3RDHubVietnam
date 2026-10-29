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
export type TabKey = 'dash' | 'text' | 'faq' | 'partners' | 'legal' | 'leads' | 'settings' | 'history'
export const TABS: [TabKey, string][] = [['dash', 'Tổng quan'], ['text', 'Nội dung chữ'], ['faq', 'Hỏi đáp'], ['partners', 'Đối tác'], ['legal', 'Trang pháp lý'], ['leads', 'Yêu cầu khách'], ['settings', 'Cài đặt'], ['history', 'Lịch sử']]
