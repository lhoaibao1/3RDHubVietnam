// Chuyển nội dung pháp lý (markdown đơn giản: ##, ###, danh sách "-", **đậm**, [chữ](link)) sang HTML an toàn.
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function inline(t: string): string {
  const x = esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return x.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|\/[A-Za-z0-9\-\/#?=&._]*)\)/g, (_m, a, b) => (b.startsWith('/') ? `<a href="${b}">${a}</a>` : `<a href="${b}" target="_blank" rel="noopener">${a}</a>`))
}

/** Thay {{company_name}}, {{tax_id}}... bằng giá trị trong phần Cài đặt của CMS. */
export function fillTokens(text: string, get: (key: string) => string): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => get(k) || m)
}

export function renderLegal(text: string): string {
  const out: string[] = []
  let para: string[] = []
  let ul = false
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = [] } }
  const endList = () => { if (ul) { out.push('</ul>'); ul = false } }
  for (const l of String(text || '').replace(/\r/g, '').split('\n')) {
    let m: RegExpMatchArray | null
    if (!l.trim()) { flushPara(); endList() }
    else if ((m = l.match(/^###\s+(.*)/))) { flushPara(); endList(); out.push('<h3>' + inline(m[1]) + '</h3>') }
    else if ((m = l.match(/^##\s+(.*)/))) { flushPara(); endList(); out.push('<h2>' + inline(m[1]) + '</h2>') }
    else if ((m = l.match(/^[-*]\s+(.*)/))) { flushPara(); if (!ul) { out.push('<ul>'); ul = true } out.push('<li>' + inline(m[1]) + '</li>') }
    else { endList(); para.push(l) }
  }
  flushPara()
  endList()
  return out.join('')
}

/** "15tr" -> "15tr (15.000.000 VNĐ)": giá viết tắt kèm số tiền đầy đủ (giống bản PDF trên máy chủ). */
export function fullPrice(p: string, en: boolean): string {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(tr|triệu|m)\s*$/i.exec(p)
  if (!m) return p
  const v = Math.round(parseFloat(m[1].replace(',', '.')) * 1e6)
  return p + ' (' + v.toLocaleString(en ? 'en-US' : 'de-DE') + (en ? ' VND)' : ' VNĐ)')
}

/** Danh sách gói hiện hành cho mã {{price_list}} trong Chính sách giá. */
export function priceListMd(plans: { name: string; price: string; unit: string; desc: string }[], en: boolean): string {
  return plans.map((p) => `- **${p.name}: ${fullPrice(p.price, en)}** ${p.unit}. ${p.desc.replace(/\.$/, '')}`).join('\n')
}
