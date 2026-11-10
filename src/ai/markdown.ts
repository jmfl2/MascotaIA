/**
 * Markdown mínimo y seguro para las respuestas de la IA.
 *
 * No genera HTML: devuelve bloques y fragmentos de texto que el renderer
 * convierte en nodos con `textContent`. Así un modelo no puede inyectar
 * etiquetas, scripts ni enlaces (las URLs se quedan como texto).
 */

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean }

export type Block =
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'heading'; inlines: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'code'; text: string }

/** **negrita**, *cursiva* o _cursiva_, `código`. Lo demás es texto literal. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\s][^*\n]*\*)|(_[^_\s][^_\n]*_)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const index = m.index ?? 0
    if (index > last) out.push({ text: text.slice(last, index) })
    const token = m[0]
    if (m[1]) out.push({ text: token.slice(1, -1), code: true })
    else if (m[2] || m[3]) out.push({ text: token.slice(2, -2), bold: true })
    else out.push({ text: token.slice(1, -1), italic: true })
    last = index + token.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out.filter((i) => i.text.length > 0)
}

const LIST_ITEM = /^\s*(?:([-*+•])|(\d{1,3})[.)])\s+(.*)$/

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', inlines: parseInline(paragraph.join(' ')) })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Bloque de código ``` (si no se cierra, llega hasta el final: útil en streaming).
    if (/^\s*```/.test(line)) {
      flushParagraph()
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      continue
    }

    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      blocks.push({ type: 'heading', inlines: parseInline(heading[1]) })
      continue
    }

    const item = LIST_ITEM.exec(line)
    if (item) {
      flushParagraph()
      const ordered = item[2] !== undefined
      const prev = blocks[blocks.length - 1]
      if (prev?.type === 'list' && prev.ordered === ordered) prev.items.push(parseInline(item[3]))
      else blocks.push({ type: 'list', ordered, items: [parseInline(item[3])] })
      continue
    }

    paragraph.push(line.trim())
  }
  flushParagraph()
  return blocks
}
