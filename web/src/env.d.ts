/// <reference types="vite/client" />
import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    /** Dịch một chuỗi gốc tiếng Việt (tiếng Anh, chữ tuỳ chỉnh từ CMS). */
    $t: (key: string) => string
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
