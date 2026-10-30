// Khung dựng một cảnh nội dung (concepts.ts) bằng một skin (skin.ts): một canvas, đổi cảnh khi chuyển trang, camera tự dạo quanh các khu vực.
import * as T from 'three'
import { RM, createStage, type Key } from './kit'
import { CONCEPTS, type Built } from './concepts'
import { makeSkin, type SkinId } from './skin'
import type { Ctx } from './parts'
import type { World } from './world'

export interface Host extends World {
  /** Dựng lại cảnh nội dung (mã cảnh: 'flow' hoặc mã trang). */
  show(id: string): void
  /** Camera tự bay qua từng khu vực (dùng ở trang chi tiết). */
  tour(on: boolean): void
}

/** `side`: cảnh nằm sau chữ (chữ bên trái, cảnh lệch phải) như đầu trang; false khi cảnh nằm gọn trong một khung riêng. */
export function createHost(canvas: HTMLCanvasElement, skinId: SkinId, opt: { side?: boolean } = {}): Host {
  const sk = makeSkin(skinId)
  const side = opt.side !== false
  const st = createStage(canvas, side ? sk.stage : { ...sk.stage, offsetX: 0 })
  const back = new T.Group(); st.scene.add(back)
  const bg = sk.setup(st, back)
  let content: T.Group | null = null
  let ticks: ((t: number) => void)[] = []
  let built: Built | null = null
  let timer = 0, touring = false, ti = 0
  const D = new T.Vector3(...sk.dir).normalize()
  /* khoảng cách camera: đủ để cả vùng cần xem nằm trong phần khung không bị chữ che (theo tỉ lệ khung hiện tại) */
  const keyOf = (f: { look: [number, number, number]; r: number }): Key => {
    const r = canvas.getBoundingClientRect(), aspect = Math.max(0.5, r.width / Math.max(1, r.height))
    const usable = side && r.width > 900 ? 0.56 : 0.92
    const fit = 1.08 / (usable * Math.tan((sk.fov * Math.PI) / 360) * aspect)
    const d = f.r * Math.max(sk.k, fit)
    return { pos: [f.look[0] + D.x * d, f.look[1] + D.y * d, f.look[2] + D.z * d], look: f.look, fov: sk.fov }
  }
  let lastKey = 'overview'
  const onResize = () => focus(lastKey, true)
  addEventListener('resize', onResize)
  st.onTick((t, dt) => { bg(t, dt); for (const f of ticks) f(t) })

  function clear() {
    if (!content) return
    content.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x: T.Material) => x.dispose()) })
    st.scene.remove(content); content = null
  }
  function focus(k: string, fast?: boolean) { lastKey = k; const f = built && (built.foci[k] || built.foci.overview); if (f) st.fly(keyOf(f), fast) }
  function schedule() {
    clearTimeout(timer)
    if (!touring || RM || !built) return
    const names = Object.keys(built.foci)
    const k = names[ti % names.length]
    focus(k)
    timer = window.setTimeout(() => { ti++; schedule() }, k === 'overview' ? 9000 : 6000)
  }

  return {
    show(id) {
      clear(); ticks = []
      content = new T.Group(); st.scene.add(content)
      const ctx: Ctx = { sk, root: content, tick: (fn) => { ticks.push(fn) } }
      built = (CONCEPTS[id] || CONCEPTS.flow)(ctx)
      ti = 0
      focus('overview', true)
      schedule()
    },
    tour(on) { touring = on; ti = 0; if (on) schedule(); else clearTimeout(timer) },
    focus(k, fast) { focus(k, fast) },
    anchor: (k) => (built && built.anchors[k]) || null,
    project: st.project, visible: st.visible,
    dispose() { removeEventListener('resize', onResize); clearTimeout(timer); clear(); st.dispose() },
  }
}
