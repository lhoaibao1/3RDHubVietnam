// Giữ vị trí cuộn khi tải lại trang hoặc quay lại: nội dung dựng xong mới cuộn, và cuộn lại nếu chiều cao trang còn thay đổi (ảnh, cảnh 3D tải muộn).
const KEY = '3rd-scroll'

export function trackScroll() {
  let t = 0
  addEventListener('scroll', () => {
    clearTimeout(t)
    t = window.setTimeout(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ p: location.pathname, y: Math.round(scrollY) })) } catch { /* bỏ qua */ } }, 120)
  }, { passive: true })
}

export function restoreScroll() {
  let saved: { p: string; y: number } | null = null
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { /* bỏ qua */ }
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!saved || saved.p !== location.pathname || !nav || (nav.type !== 'reload' && nav.type !== 'back_forward') || saved.y < 20 || location.hash) return
  const y = saved.y
  let stop = false
  const end = () => { stop = true; for (const e of ['wheel', 'touchstart', 'keydown', 'mousedown']) removeEventListener(e, end) }
  for (const e of ['wheel', 'touchstart', 'keydown', 'mousedown']) addEventListener(e, end, { passive: true })
  const t0 = performance.now()
  const tick = () => {
    if (stop) return
    if (document.documentElement.scrollHeight >= y + innerHeight - 4 && Math.abs(scrollY - y) > 2) scrollTo(0, y)
    if (performance.now() - t0 > 2500) return end()
    requestAnimationFrame(tick)
  }
  tick()
}
