// Chuyển nội dung pháp lý (markdown đơn giản: ##, ###, danh sách "-", **đậm**, [chữ](link)) sang HTML an toàn.
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function inline(t: string): string {
  const x = esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return x.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, (_m, a, b) => `<a href="${b}" target="_blank" rel="noopener">${a}</a>`)
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
