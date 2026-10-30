<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AnimDetails from '@/components/AnimDetails.vue'
import Page3D from '@/components/Page3D.vue'
import PageCta from '@/components/PageCta.vue'
import { usePageFx } from '@/composables/usePageFx'
import { useSite } from '@/stores/site'

const site = useSite()
const root = ref<HTMLElement | null>(null)
usePageFx(root)

const query = ref('')
const cat = ref('*')

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

const items = computed(() => site.faqItems)
const cats = computed(() => [...new Set(items.value.map((f) => f.cat.vi))])
watch(cats, (c) => { if (cat.value !== '*' && !c.includes(cat.value)) cat.value = '*' })

const sections = computed(() => {
  const q = norm(query.value.trim())
  const out: { key: string; title: string; rows: typeof items.value }[] = []
  for (const c of cats.value) {
    if (cat.value !== '*' && c !== cat.value) continue
    const rows = items.value.filter((f) => f.cat.vi === c && (!q || norm([f.q.vi, site.pick(f.q), f.a.vi, site.pick(f.a)].join(' ')).includes(q)))
    if (rows.length) out.push({ key: c, title: site.pick(rows[0].cat), rows })
  }
  return out
})
const total = computed(() => sections.value.reduce((n, s) => n + s.rows.length, 0))
const catLabel = (c: string) => site.pick(items.value.find((f) => f.cat.vi === c)?.cat)
</script>

<template>
  <section ref="root" class="w pg" id="p-hoi-dap">
    <div class="pgh">
      <div>
        <h1>Câu hỏi <span class="o">thường gặp.</span></h1>
        <p class="lead">Tìm theo từ khoá hoặc chọn nhóm câu hỏi. Chưa thấy câu trả lời thì gọi hotline hoặc gửi email cho đội ngũ 3RDVN Technology.</p>
        <div class="fsearch"><input v-model="query" type="search" placeholder="Tìm câu hỏi, ví dụ: rút tiền, Sub ID" aria-label="Tìm câu hỏi"></div>
        <div class="fcat" role="group" aria-label="Nhóm câu hỏi">
          <button type="button" :aria-pressed="cat === '*'" @click="cat = '*'">Tất cả</button>
          <button v-for="c in cats" :key="c" type="button" :aria-pressed="cat === c" @click="cat = c">{{ catLabel(c) }}</button>
        </div>
      </div>
      <Page3D id="hoi-dap" tint="#FFB238">
        <div class="ft" style="left:18px;bottom:18px"><b>{{ site.t('{n} câu hỏi').replace('{n}', String(items.length)) }}</b><span>{{ site.t('Chia theo {n} nhóm').replace('{n}', String(cats.length)) }}</span></div>
      </Page3D>
    </div>

    <div class="fq2" data-cms="faq">
      <div v-for="s in sections" :key="s.key">
        <h2>{{ s.title }}</h2>
        <AnimDetails v-for="f in s.rows" :key="f.id" :summary="site.pick(f.q)" :text="site.pick(f.a)" :open="!!query.trim()" />
      </div>
    </div>
    <p v-if="total === 0" class="fempty">Không tìm thấy câu hỏi phù hợp. Hãy thử từ khoá khác hoặc <RouterLink to="/lien-he">liên hệ đội ngũ hỗ trợ</RouterLink>.</p>

    <PageCta />
  </section>
</template>
