import type * as T from 'three'

/** Mọi kiểu cảnh 3D đều có giao diện giống nhau để trang chủ và các trang con dùng chung. */
export interface World {
  /** Bay camera tới một khu vực: 'overview' hoặc mã khu vực của kiểu cảnh đó. */
  focus(key: string, fast?: boolean): void
  /** Điểm trong cảnh để gắn nhãn "số bước" của trang chủ. */
  anchor(key: string): T.Vector3 | null
  project(p: T.Vector3): { x: number; y: number; behind: boolean }
  visible(): boolean
  dispose(): void
}

/** Thứ tự năm bước của trang chủ (0 là tổng quan) → mã khu vực. */
export const HERO_KEYS = ['overview', 'advertiser', 'hub', 'publisher', 'customer', 'commission']
/** Trang chi tiết → khu vực camera dừng lại. */
export const PAGE_KEYS: Record<string, string> = {
  'mo-hinh': 'overview', advertiser: 'advertiser', 'cong-nghe': 'hub', 'doi-tac': 'advertiser', 'hoi-dap': 'support', 'lien-he': 'publisher',
}
