// Chế độ sáng/tối của các cảnh 3D. Module nhỏ, không import three để store có thể dùng mà không kéo thư viện 3D vào gói chính.
export type Mode = 'light' | 'dark'
let current: Mode = 'light'
const subs = new Set<(m: Mode) => void>()

export const getMode = (): Mode => current
export function setMode(m: Mode) {
  if (m === current) return
  current = m
  subs.forEach((f) => f(m))
}
/** Đăng ký nhận thay đổi; trả về hàm huỷ. */
export function onMode(f: (m: Mode) => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}
