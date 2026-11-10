/**
 * Vista de conversación con la IA dentro de la barra.
 * Las respuestas se pintan con el Markdown seguro de src/ai/markdown.ts:
 * todo son nodos creados a mano con `textContent`, nunca `innerHTML`.
 */
import { t } from '../../shared/i18n'
import { parseMarkdown, type Inline } from '../../ai/markdown'
import type { ChatSnapshot } from '../../shared/ipc'

function inlineNodes(inlines: Inline[]): Node[] {
  return inlines.map((i) => {
    if (!i.bold && !i.italic && !i.code) return document.createTextNode(i.text)
    const el = document.createElement(i.code ? 'code' : i.bold ? 'strong' : 'em')
    el.textContent = i.text
    return el
  })
}

/** Convierte Markdown en nodos del DOM. */
export function renderMarkdown(text: string): DocumentFragment {
  const frag = document.createDocumentFragment()
  for (const block of parseMarkdown(text)) {
    switch (block.type) {
      case 'paragraph':
      case 'heading': {
        const p = document.createElement('p')
        if (block.type === 'heading') p.className = 'md-heading'
        p.append(...inlineNodes(block.inlines))
        frag.append(p)
        break
      }
      case 'list': {
        const list = document.createElement(block.ordered ? 'ol' : 'ul')
        for (const item of block.items) {
          const li = document.createElement('li')
          li.append(...inlineNodes(item))
          list.append(li)
        }
        frag.append(list)
        break
      }
      case 'code': {
        const pre = document.createElement('pre')
        const code = document.createElement('code')
        code.textContent = block.text
        pre.append(code)
        frag.append(pre)
        break
      }
    }
  }
  return frag
}

export interface ChatView {
  render(snapshot: ChatSnapshot): void
  /** Añade texto a un mensaje que se está escribiendo (repinta como mucho una vez por fotograma). */
  appendDelta(index: number, delta: string): void
  snapshot(): ChatSnapshot
}

export function createChatView(root: HTMLElement, onCopy: (index: number) => void, onChange: () => void): ChatView {
  let state: ChatSnapshot = { messages: [], streaming: false }
  let pending = false

  function paint(): void {
    pending = false
    const atBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 40
    root.replaceChildren()

    if (!state.messages.length) {
      const empty = document.createElement('div')
      empty.className = 'chat-empty'
      const title = document.createElement('p')
      title.className = 'chat-empty-title'
      title.textContent = t('Pregúntame lo que quieras', 'Ask me anything')
      const sub = document.createElement('p')
      sub.textContent = t('Funciono en tu PC con Ollama: lo que escribas no sale de aquí.', 'I run on your PC with Ollama: what you type never leaves it.')
      empty.append(title, sub)
      root.append(empty)
    }

    state.messages.forEach((m, index) => {
      const row = document.createElement('div')
      row.className = `msg msg-${m.role}${m.error ? ' msg-error' : ''}`
      const body = document.createElement('div')
      body.className = 'msg-body'
      const last = index === state.messages.length - 1

      if (m.role === 'user' || m.error) {
        body.textContent = m.text
      } else if (!m.text && last && state.streaming) {
        body.className = 'msg-body msg-typing'
        body.append(...[0, 1, 2].map(() => document.createElement('span')))
      } else {
        body.append(renderMarkdown(m.text))
        if (last && state.streaming) body.classList.add('is-streaming')
      }
      row.append(body)

      if (m.role === 'assistant' && m.text && !m.error && !(last && state.streaming)) {
        const copy = document.createElement('button')
        copy.type = 'button'
        copy.className = 'msg-copy'
        copy.textContent = t('Copiar', 'Copy')
        copy.addEventListener('click', () => onCopy(index))
        row.append(copy)
      }
      root.append(row)
    })

    if (atBottom || state.streaming) root.scrollTop = root.scrollHeight
    onChange()
  }

  function schedule(): void {
    if (pending) return
    pending = true
    requestAnimationFrame(paint)
  }

  return {
    render(snapshot) {
      state = snapshot
      schedule()
    },
    appendDelta(index, delta) {
      const m = state.messages[index]
      if (!m) return
      m.text += delta
      schedule()
    },
    snapshot: () => state
  }
}
