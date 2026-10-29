import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from 'vue'
import { RM } from '@/three/core'

type Line = { t: 'cmd' | 'out' | 'code' | 'ok'; s: string; st?: number }

export const TERM: Line[] = [
  { t: 'cmd', s: 'npm create vue@latest affiliate-web', st: 0 },
  { t: 'out', s: '✔ Add TypeScript? … Yes\n✔ Add Pinia? … Yes\nDone. Now run: cd affiliate-web && npm install' },
  { t: 'cmd', s: 'go mod init github.com/your-brand/affiliate-api', st: 1 },
  { t: 'cmd', s: 'vim internal/postback/handler.go' },
  { t: 'code', s: 'func HandlePostback(w http.ResponseWriter, r *http.Request) {\n    clickID := r.URL.Query().Get("click_id")\n    status := r.URL.Query().Get("status")\n    if err := orders.UpdateStatus(clickID, status); err != nil {\n        http.Error(w, err.Error(), http.StatusBadRequest)\n        return\n    }\n    w.WriteHeader(http.StatusOK)\n}' },
  { t: 'cmd', s: 'go test ./...', st: 2 },
  { t: 'ok', s: 'ok   affiliate-api/postback   0.21s\nok   affiliate-api/tracking   0.34s' },
  { t: 'cmd', s: 'npm run build', st: 3 },
  { t: 'ok', s: '✓ 128 modules transformed.\n✓ built in 3.2s' },
  { t: 'cmd', s: 'docker compose up -d', st: 4 },
  { t: 'ok', s: '✔ Container postgres  Started\n✔ Container redis     Started\n✔ Container api       Started\n✔ Container web       Started' },
  { t: 'ok', s: '🚀 Hệ thống affiliate đã chạy.' },
]

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)

function hlGo(line: string) {
  const re = /("[^"]*")|\b(func|if|return|err|nil)\b|\b([A-Z][A-Za-z]+)(?=\()/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index)) + `<span class="${m[1] ? 's' : m[2] ? 'k' : 'f'}">${esc(m[0])}</span>`
    last = re.lastIndex
  }
  return out + esc(line.slice(last))
}

/**
 * Terminal minh hoạ tự gõ lệnh. Trả về HTML để hiển thị, văn bản thuần (cho màn hình monitor trong cảnh 3D)
 * và trạng thái từng bước. Chỉ chạy khi phần tử đang nằm trong màn hình.
 */
export function useTerminal(el: Ref<HTMLElement | null>, scroller: Ref<HTMLElement | null>) {
  const st = reactive({ i: 0, c: 0, wait: 0 })
  const tick = ref(0)
  const L = TERM

  const html = computed(() => {
    tick.value // eslint-disable-line @typescript-eslint/no-unused-expressions
    let h = ''
    for (let k = 0; k <= Math.min(st.i, L.length - 1); k++) {
      const e = L[k]
      const txt = k < st.i ? e.s : e.s.slice(0, st.c)
      if (e.t === 'cmd') h += `<span class="p">❯</span> <span class="c">${esc(txt)}</span>${k === st.i ? '<span class="cur"></span>' : ''}\n`
      else if (e.t === 'code') h += txt.split('\n').map(hlGo).join('\n') + (k === st.i ? '<span class="cur"></span>' : '') + '\n'
      else h += `<span class="${e.t === 'ok' ? 'ok' : 'o'}">${esc(txt)}</span>\n`
    }
    if (st.i >= L.length) h += '<span class="p">❯</span> <span class="cur"></span>'
    return h
  })

  const plain = computed(() => {
    let h = ''
    for (let k = 0; k <= Math.min(st.i, L.length - 1); k++) {
      const e = L[k]
      const txt = k < st.i ? e.s : e.s.slice(0, st.c)
      h += (e.t === 'cmd' ? '❯ ' : '') + txt + '\n'
    }
    if (st.i >= L.length) h += '❯ '
    return h
  })

  const step = computed(() => {
    let cur = -1
    for (let k = 0; k <= Math.min(st.i, L.length - 1); k++) if (L[k].st != null) cur = L[k].st as number
    return cur
  })
  const finished = computed(() => st.i >= L.length)

  let version = 0
  watch(plain, () => { version++ })
  watch(html, () => nextTick(() => { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight }))

  let visible = false
  let raf = 0
  let io: IntersectionObserver | null = null
  let last = 0

  function bump() { tick.value++ }

  function loop(n: number) {
    raf = requestAnimationFrame(loop)
    if (!visible && !RM) return
    if (n - last < (RM ? 0 : 28)) return
    last = n
    if (RM) { st.i = L.length; return }
    if (st.wait > 0) { st.wait--; return }
    if (st.i >= L.length) { st.i = 0; st.c = 0; st.wait = 0; bump(); return }
    const e = L[st.i]
    if (e.t === 'cmd' || e.t === 'code') {
      st.c += e.t === 'code' ? 3 : 1
      if (st.c >= e.s.length) { st.i++; st.c = 0; st.wait = e.t === 'cmd' ? 14 : 20 }
    } else { st.i++; st.c = 0; st.wait = 18 }
    if (st.i >= L.length) st.wait = 90
  }

  onMounted(() => {
    if (el.value) {
      io = new IntersectionObserver((e) => { visible = e[0].isIntersecting })
      io.observe(el.value)
    }
    raf = requestAnimationFrame(loop)
  })
  onBeforeUnmount(() => { cancelAnimationFrame(raf); io?.disconnect() })

  return { html, plain, step, finished, source: { text: () => plain.value, version: () => version } }
}
