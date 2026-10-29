import { nextTick } from 'vue'

const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Chạy một thay đổi giao diện (đổi ngôn ngữ, đổi sáng/tối) kèm hiệu ứng.
 * - 'theme': vệt tròn loang ra từ điểm bấm.
 * - 'lang': chữ mờ chuyển mượt sang ngôn ngữ mới.
 * Trình duyệt không hỗ trợ View Transitions hoặc bật "giảm chuyển động" thì đổi ngay.
 */
export function transition(change: () => void, kind: 'lang' | 'theme', origin?: { x: number; y: number }) {
  const d = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { ready: Promise<void>; finished: Promise<void> } }
  if (RM || !d.startViewTransition) { change(); return }
  const root = document.documentElement
  root.classList.add('vt-' + kind)
  const t = d.startViewTransition(async () => { change(); await nextTick() })
  if (kind === 'theme') {
    const x = origin?.x ?? innerWidth / 2
    const y = origin?.y ?? 0
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    t.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' })
    }).catch(() => {})
  }
  t.finished.finally(() => root.classList.remove('vt-' + kind))
}
