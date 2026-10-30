/** Hiện dần khi cuộn tới: thêm lớp .rv (+ biến thể) rồi .in khi phần tử vào màn hình. Trả về hàm dọn dẹp.
 *  Phần tử ra khỏi màn hình thì ẩn lại, nên cuộn lên hay cuộn xuống đều có hiệu ứng; lớp .up đánh dấu phần tử
 *  đang nằm phía trên màn hình để lần hiện sau đi vào từ phía trên (đúng hướng cuộn). Kiểu hiệu ứng do <html data-fx> quyết định. */
export type RevealGroup = [selector: string, variant?: 'rv-l' | 'rv-r' | 'rv-z']

/** Bộ quan sát dùng chung cho một trang. */
export function revealObserver(): { watch(el: HTMLElement): void; stop(): void } {
  if (!('IntersectionObserver' in window)) return { watch: (el) => el.classList.add('rv', 'in'), stop() {} }
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      const el = e.target as HTMLElement
      if (e.isIntersecting) el.classList.add('in')
      else {
        /* chỉ ẩn lại khi đã ra hẳn khỏi màn hình (tránh nhấp nháy ở mép) */
        const r = e.boundingClientRect
        if (r.bottom < 0 || r.top > innerHeight) { el.classList.remove('in'); el.classList.toggle('up', r.bottom < 0) }
      }
    }
  }, { rootMargin: '0px 0px -6% 0px' })
  return { watch(el) { el.classList.add('rv'); io.observe(el) }, stop: () => io.disconnect() }
}

export function observeReveal(root: HTMLElement, groups: RevealGroup[]): () => void {
  const ob = revealObserver()
  for (const [sel, variant] of groups) {
    const all = Array.from(root.querySelectorAll<HTMLElement>(sel))
    all.forEach((el) => {
      const sib = all.filter((x) => x.parentElement === el.parentElement)
      el.style.setProperty('--i', String(Math.min(8, sib.indexOf(el))))
      if (variant) el.classList.add(variant)
      el.classList.toggle('odd', sib.indexOf(el) % 2 === 1)
      ob.watch(el)
    })
  }
  return ob.stop
}
