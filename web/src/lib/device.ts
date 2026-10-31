// Mã thiết bị ẩn danh phục vụ chống tấn công (server/guard.go): băm các đặc điểm phần cứng và trình duyệt (GPU, màn hình, múi giờ,
// cấu hình máy, model Android...) thành 20 ký tự rồi đặt cookie rh_dv. Không chứa thông tin cá nhân, không dùng để quảng cáo hay theo dõi,
// và website KHÔNG đọc được IMEI, số seri hay địa chỉ MAC (trình duyệt cấm). Nếu thiết bị bị cấm, nginx chặn theo mã này dù đổi IP hay xoá cookie
// (mã được tính lại từ phần cứng mỗi lần vào trang).

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function put(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

export async function markDevice(): Promise<void> {
  try {
    const n = navigator as Navigator & { deviceMemory?: number; userAgentData?: { getHighEntropyValues(h: string[]): Promise<Record<string, string>> } }
    const parts: string[] = [n.platform, String(n.hardwareConcurrency || 0), String(n.deviceMemory || 0), String(n.maxTouchPoints || 0),
      `${screen.width}x${screen.height}x${screen.colorDepth}`, String(devicePixelRatio), Intl.DateTimeFormat().resolvedOptions().timeZone, (n.languages || [n.language]).join(',')]
    const c = document.createElement('canvas'); c.width = 220; c.height = 40
    const x = c.getContext('2d')
    if (x) { x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(10, 5, 90, 24); x.fillStyle = '#069'; x.fillText('3RDHub ✓ Việt Nam', 4, 10); parts.push(c.toDataURL()) }
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
    if (gl && ext) parts.push(String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)), String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)))
    let model = ''
    if (n.userAgentData?.getHighEntropyValues) {
      const v = await n.userAgentData.getHighEntropyValues(['model', 'platformVersion', 'architecture', 'bitness'])
      model = v.model || ''
      parts.push(model, v.platformVersion || '', v.architecture || '', v.bitness || '')
    }
    put('rh_dv', (await sha(parts.join('|'))).slice(0, 20))
    if (/^[A-Za-z0-9 ._+/-]{2,40}$/.test(model)) put('rh_md', model)
  } catch { /* trình duyệt không hỗ trợ: bỏ qua, các lớp chặn khác vẫn hoạt động */ }
}
