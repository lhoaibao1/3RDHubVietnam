<script setup lang="ts">
import { useSite } from '@/stores/site'

const site = useSite()
</script>

<template>
  <section class="w partners" id="doi-tac">
    <h2>Advertiser và đối tác đồng hành</h2>
    <p style="color:var(--ink2);margin-top:12px;max-width:40em">Các ngân hàng, công ty tài chính và mạng affiliate đang hợp tác cùng 3RDVN Technology.</p>
    <RouterLink class="more" to="/doi-tac">Xem chi tiết →</RouterLink>
    <div class="plist">
      <div class="mq">
        <template v-for="copy in 2" :key="copy">
          <div v-for="p in site.partners" :key="copy + p.name" class="pt" :aria-hidden="copy === 2 ? 'true' : undefined">
            <span class="lg"><img v-if="p.logo" :src="p.logo" :alt="p.name"><b v-else>{{ p.name }}</b></span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
