// Gọi API quản trị. Mọi yêu cầu ghi đều kèm X-CMS: 1 (chống CSRF), phiên nằm trong cookie HttpOnly.
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn }

export async function api<T = any>(method: string, path: string, body?: unknown, raw?: { body: BodyInit; headers: Record<string, string> }): Promise<T> {
  const headers: Record<string, string> = { 'X-CMS': '1' }
  const init: RequestInit = { method, credentials: 'same-origin', headers }
  if (raw) {
    init.body = raw.body
    Object.assign(headers, raw.headers)
  } else if (body !== undefined) {
    init.body = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  const r = await fetch('/api/admin/' + path, init)
  const j = await r.json().catch(() => ({}))
  if (r.status === 401 && path !== 'login') {
    onUnauthorized()
    throw new ApiError('Phiên đăng nhập đã hết, hãy đăng nhập lại.', 401)
  }
  if (!r.ok) throw new ApiError(j.error || 'Lỗi ' + r.status, r.status)
  return j as T
}
