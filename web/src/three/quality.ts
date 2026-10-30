// Tự điều chỉnh độ nét 3D theo tốc độ máy: bắt đầu nét (tới 2x trên màn hình retina), máy giật thì hạ dần độ phân giải cho đến khi mượt.
// Mức đã hạ được nhớ trong phiên để chuyển trang không phải đo lại từ đầu.
const KEY = '3rd-q'
let scale = 1
try { const v = parseFloat(sessionStorage.getItem(KEY) || ''); if (v >= 0.5 && v <= 1) scale = v } catch { /* bỏ qua */ }
const subs = new Set<() => void>()
export const MIN_SCALE = 0.5

/** Tỉ lệ điểm ảnh nên dùng cho renderer (đã giới hạn theo màn hình và hiệu năng đo được). */
export function dpr(): number {
  const base = Math.min(window.devicePixelRatio || 1, innerWidth <= 640 ? 1.25 : innerWidth <= 900 ? 1.5 : 2)
  return Math.max(0.75, base * scale)
}
export function onQuality(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}

/** Mỗi renderer gọi hàm này với thời gian mỗi khung (ms); trung bình quá chậm thì hạ chất lượng. */
export function meter(): (dtMs: number) => void {
  let n = 0, sum = 0, warm = 60
  return (dt: number) => {
    if (warm > 0) { warm--; return }
    sum += Math.min(dt, 200); n++
    if (n < 30) return
    const avg = sum / n
    n = 0; sum = 0
    if (avg > 21 && scale > MIN_SCALE) {
      scale = Math.max(MIN_SCALE, scale * 0.82)
      try { sessionStorage.setItem(KEY, String(scale)) } catch { /* bỏ qua */ }
      subs.forEach((f) => f())
    }
  }
}
