import { NodeTypes, createSimpleExpression, type ElementNode, type NodeTransform, type TemplateChildNode } from '@vue/compiler-dom'

/**
 * Biến mọi chữ tĩnh trong template thành {{ $t("chữ gốc tiếng Việt") }} lúc biên dịch,
 * nên chỉ cần viết nội dung tiếng Việt trong template: tiếng Anh và chữ tuỳ chỉnh từ CMS
 * được tra theo chính chuỗi tiếng Việt đó. Bỏ qua: thẻ code/pre/svg/style/script,
 * phần tử có data-nl, class "term", id "tout".
 */
const SKIP_TAG = /^(script|style|code|pre|svg|path|noscript|title)$/i
const LETTER = /[A-Za-zÀ-ỹ]/
const ATTRS = new Set(['placeholder', 'aria-label', 'title', 'data-l'])
const skipped = new WeakSet<object>()

function attr(el: ElementNode, name: string): string | undefined {
  for (const p of el.props) {
    if (p.type === NodeTypes.ATTRIBUTE && p.name === name) return p.value ? p.value.content : ''
  }
  return undefined
}

function hasSkipMark(el: ElementNode): boolean {
  if (SKIP_TAG.test(el.tag)) return true
  if (attr(el, 'data-nl') !== undefined || attr(el, 'id') === 'tout') return true
  if ((attr(el, 'class') || '').split(/\s+/).includes('term')) return true
  return el.props.some((p) => p.type === NodeTypes.DIRECTIVE && (p.name === 'html' || p.name === 'text' || p.name === 'pre'))
}

function markSubtree(children: TemplateChildNode[]) {
  for (const c of children) {
    skipped.add(c)
    if (c.type === NodeTypes.ELEMENT) markSubtree(c.children)
    else if ('children' in c && Array.isArray((c as any).children)) markSubtree((c as any).children)
  }
}

export const i18nTransform: NodeTransform = (node) => {
  if (node.type !== NodeTypes.ELEMENT || skipped.has(node)) return
  const el = node as ElementNode
  if (hasSkipMark(el)) {
    markSubtree(el.children)
    return
  }
  for (let i = 0; i < el.props.length; i++) {
    const p = el.props[i]
    if (p.type === NodeTypes.ATTRIBUTE && ATTRS.has(p.name) && p.value && LETTER.test(p.value.content)) {
      const key = p.value.content.replace(/\s+/g, ' ').trim()
      el.props[i] = {
        type: NodeTypes.DIRECTIVE,
        name: 'bind',
        rawName: ':' + p.name,
        exp: createSimpleExpression(`_ctx.$t(${JSON.stringify(key)})`, false, p.loc),
        arg: createSimpleExpression(p.name, true, p.loc),
        modifiers: [],
        loc: p.loc,
      } as any
    }
  }
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i]
    if (c.type !== NodeTypes.TEXT || !LETTER.test(c.content)) continue
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(c.content)!
    const core = m[2].replace(/\s+/g, ' ')
    let src = `$t(${JSON.stringify(core)})`
    if (m[1] || m[3]) src = `${JSON.stringify(m[1] ? ' ' : '')} + ${src} + ${JSON.stringify(m[3] ? ' ' : '')}`
    el.children[i] = {
      type: NodeTypes.INTERPOLATION,
      content: createSimpleExpression(src, false, c.loc),
      loc: c.loc,
    } as any
  }
}
