// Chọn kiểu cảnh 3D: kiểu cũ (classic) hoặc ba kiểu "đêm công nghệ". Mỗi kiểu nạp riêng (code-splitting) nên không tải thừa.
import type { Hero } from './hero'
import { HERO_KEYS, type World } from './styles/world'

import type { SceneStyle } from './sceneTypes'
import type { Host } from './styles/host'
import type { SkinId } from './styles/skin'

const HERO_LABELS = ['Advertiser', '3RDHub', 'Publisher', 'Khách hàng', 'Hoa hồng']

/** Cảnh trang chủ của ba kiểu đầu được dựng riêng; các kiểu còn lại dùng cảnh `flow` với skin tương ứng. */
async function loadHero(style: SceneStyle, canvas: HTMLCanvasElement): Promise<World> {
  if (style === 'ecosystem') return (await import('./styles/ecosystem')).createEcosystem(canvas)
  if (style === 'isometric') return (await import('./styles/isometric')).createIsometric(canvas)
  if (style === 'factory') return (await import('./styles/factory')).createFactory(canvas)
  const h = (await import('./styles/host')).createHost(canvas, style as SkinId); h.show('flow'); return h
}
async function loadHost(style: SceneStyle, canvas: HTMLCanvasElement): Promise<Host> {
  return (await import('./styles/host')).createHost(canvas, style as SkinId)
}

/** Cảnh trang chủ cho các kiểu mới: cùng giao diện với `Hero` của kiểu cũ. */
export async function createStyledHero(style: SceneStyle, canvas: HTMLCanvasElement, tagEl: HTMLElement, cb: { onTag(k: number, label: string): void }): Promise<Hero> {
  const world = await loadHero(style, canvas)
  let step = 0, lastK = -1, raf = 0
  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (step < 1) { tagEl.style.opacity = '0'; lastK = -1; return }
    const a = world.anchor(HERO_KEYS[step])
    if (!a) { tagEl.style.opacity = '0'; return }
    const p = world.project(a)
    tagEl.style.transform = `translate(${p.x - 60}px,${p.y - 20}px)`
    tagEl.style.opacity = p.behind ? '0' : '1'
    if (step !== lastK) { lastK = step; cb.onTag(step, HERO_LABELS[step - 1]) }
  }
  loop()
  world.focus(HERO_KEYS[0], true)
  return {
    go(k) { step = k; world.focus(HERO_KEYS[k] || 'overview') },
    visible: () => world.visible(),
    dispose() { cancelAnimationFrame(raf); world.dispose() },
  }
}

/* ---- trang chi tiết: mỗi trang một cảnh riêng, canvas dùng chung và được dựng lại nội dung khi chuyển trang ---- */
let cur: null | { style: SceneStyle; canvas: HTMLCanvasElement; host: Host | null; pending: string } = null

function apply(h: Host, id: string) { h.show(id); h.tour(true) }

export async function showStyledPage(style: SceneStyle, slot: HTMLElement, id: string): Promise<void> {
  if (cur && cur.style !== style) { cur.host?.dispose(); cur.canvas.remove(); cur = null }
  if (!cur) {
    const canvas = document.createElement('canvas'); canvas.className = 'glp'; canvas.setAttribute('aria-hidden', 'true')
    cur = { style, canvas, host: null, pending: id }
    slot.insertBefore(canvas, slot.firstChild)
    const mine = cur
    loadHost(style, canvas).then((h) => { if (cur === mine) { mine.host = h; apply(h, mine.pending) } else h.dispose() })
    return
  }
  slot.insertBefore(cur.canvas, slot.firstChild)
  cur.pending = id
  if (cur.host) apply(cur.host, id)
}

export function hideStyledPage(): void {
  if (cur) cur.host?.tour(false)
  if (cur && cur.canvas.parentNode) cur.canvas.parentNode.removeChild(cur.canvas)
}
