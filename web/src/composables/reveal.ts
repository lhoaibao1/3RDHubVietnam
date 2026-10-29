/** Hiện dần khi cuộn tới: thêm lớp .rv (+ biến thể) rồi .in khi phần tử vào màn hình. Trả về hàm dọn dẹp. */
export type RevealGroup = [selector: string, variant?: 'rv-l' | 'rv-r' | 'rv-z']

export function observeReveal(root: HTMLElement, groups: RevealGroup[]): () => void {
  let io: IntersectionObserver | null = null
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        io?.unobserve(e.target)
      })
    }, { rootMargin: '0px 0px -8% 0px' })
  }
  for (const [sel, variant] of groups) {
    const all = Array.from(root.querySelectorAll<HTMLElement>(sel))
    all.forEach((el) => {
      const sib = all.filter((x) => x.parentElement === el.parentElement)
      el.style.setProperty('--i', String(Math.min(8, sib.indexOf(el))))
      el.classList.add('rv')
      if (variant) el.classList.add(variant)
      if (io) io.observe(el)
      else el.classList.add('in')
    })
  }
  return () => io?.disconnect()
}
