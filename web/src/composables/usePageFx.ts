import { onBeforeUnmount, onMounted, type Ref } from 'vue'

// Selector các khối được "hiện dần khi cuộn".
const RVSEL = '.ps>.k2,.ps>h2,.ps>.sub,.ps .cd,.tl li,.steps6 li,.seq li,.states span,.anat,.cmpw,.cmp tbody tr,.codeb,.g2.al>div,.cnt div,.pg2 a,.pgrp h3,.fq2>div,.pnext .cta,.ps0 .cd,.ps0>form'

/** Hiệu ứng của trang module: hiện dần khi cuộn và các trạng thái/đoạn link sáng lần lượt. */
export function usePageFx(root: Ref<HTMLElement | null>) {
  let io: IntersectionObserver | null = null
  let cyc = 0

  onMounted(() => {
    const pg = root.value
    if (!pg) return
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('in')
          io?.unobserve(e.target)
        })
      }, { rootMargin: '0px 0px -8% 0px' })
    }
    pg.querySelectorAll<HTMLElement>(RVSEL).forEach((el) => {
      const sib = Array.from(el.parentElement!.children).filter((x) => x.matches(RVSEL))
      el.style.setProperty('--i', String(Math.min(8, sib.indexOf(el))))
      el.classList.add('rv')
      if (io) io.observe(el)
      else el.classList.add('in')
    })
    const st = Array.from(pg.querySelectorAll('.states span'))
    const an = Array.from(pg.querySelectorAll('.anat code span:not(.a1)'))
    if (st.length || an.length) {
      let i = 0
      cyc = window.setInterval(() => {
        st.forEach((x, k) => x.classList.toggle('cur', k === i % st.length))
        an.forEach((x, k) => x.classList.toggle('cur', k === i % an.length))
        i++
      }, 1100)
    }
  })
  onBeforeUnmount(() => { io?.disconnect(); clearInterval(cyc) })
}
