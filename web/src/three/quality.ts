// Tự điều chỉnh độ nét 3D theo tốc độ máy: máy yếu giật thì giảm dần độ phân giải cho đến khi mượt.
let scale = 1
const subs = new Set<() => void>()

/** Tỉ lệ điểm ảnh nên dùng cho renderer (đã giới hạn theo màn hình và hiệu năng đo được). */
export function dpr(): number {
  const base = Math.min(window.devicePixelRatio || 1, innerWidth <= 900 ? 1.25 : 1.5)
  return Math.max(0.7, base * scale)
}
export function onQuality(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}

/** Mỗi renderer gọi hàm này với thời gian mỗi khung (ms); trung bình quá chậm thì hạ chất lượng. */
export function meter(): (dtMs: number) => void {
  let n = 0, sum = 0, warm = 90
  return (dt: number) => {
    if (warm > 0) { warm--; return }
    sum += Math.min(dt, 200); n++
    if (n < 45) return
    const avg = sum / n
    n = 0; sum = 0
    if (avg > 26 && scale > 0.7) { scale = Math.max(0.7, scale * 0.85); subs.forEach((f) => f()) }
  }
}
