import { describe, expect, it } from 'vitest'
import { parseMarkdown, parseInline } from './markdown'
import { NdjsonSplitter } from './ndjson'
import { createOllamaClient, KEEP_ALIVE, OllamaError } from './ollama'
import { parseInterpretation } from './prompts'

/** Respuesta HTTP en streaming troceada a mano, como llegaría por la red. */
function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    }
  })
  return new Response(body, { status })
}

describe('NDJSON', () => {
  it('reconstruye líneas partidas entre trozos', () => {
    const s = new NdjsonSplitter()
    expect(s.push('{"a":1}\n{"b"')).toEqual([{ a: 1 }])
    expect(s.push(':2}\n\n{"c":3}')).toEqual([{ b: 2 }])
    expect(s.flush()).toEqual([{ c: 3 }])
  })

  it('ignora líneas corruptas', () => {
    expect(new NdjsonSplitter().push('no json\n{"ok":true}\n')).toEqual([{ ok: true }])
  })
})

describe('cliente de Ollama', () => {
  it('acumula el texto del chat en streaming', async () => {
    const fake = (async () =>
      streamResponse([
        '{"message":{"role":"assistant","content":"Ho"}}\n{"message":{"content":"la"}',
        '}\n{"message":{"content":"!"},"done":true}\n'
      ])) as unknown as typeof fetch
    const deltas: string[] = []
    const text = await createOllamaClient(fake).chat({ model: 'm', messages: [] }, (d) => deltas.push(d))
    expect(text).toBe('Hola!')
    expect(deltas).toEqual(['Ho', 'la', '!'])
  })

  it('traduce "conexión rechazada" a "no está en marcha"', async () => {
    const fake = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(createOllamaClient(fake).version()).rejects.toMatchObject({ code: 'unreachable' })
  })

  it('detecta un modelo que no está descargado', async () => {
    const fake = (async () => new Response('{"error":"model \\"x\\" not found"}', { status: 404 })) as unknown as typeof fetch
    const err = await createOllamaClient(fake)
      .chat({ model: 'x', messages: [] })
      .catch((e) => e)
    expect(err).toBeInstanceOf(OllamaError)
    expect(err.code).toBe('model-missing')
    expect(err.userMessage).toBe('El modelo no está descargado')
  })

  it('respeta el tiempo límite', async () => {
    const fake = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')))
      })) as unknown as typeof fetch
    await expect(createOllamaClient(fake).version(20)).rejects.toMatchObject({ code: 'timeout' })
  })

  it('se puede cancelar', async () => {
    const controller = new AbortController()
    const fake = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')))
      })) as unknown as typeof fetch
    const promise = createOllamaClient(fake).chat({ model: 'm', messages: [], signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toMatchObject({ code: 'aborted' })
  })

  it('suelta el modelo de memoria al momento y por defecto lo deja poco tiempo', async () => {
    const bodies: Array<Record<string, unknown>> = []
    const fake = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)))
      return new Response('{}')
    }) as unknown as typeof fetch
    const client = createOllamaClient(fake)
    await client.unload('m')
    await client.warmup('m')
    expect(bodies[0]).toMatchObject({ model: 'm', keep_alive: 0 })
    expect(bodies[1]).toMatchObject({ model: 'm', keep_alive: KEEP_ALIVE })
  })
})

describe('interpretación', () => {
  it('acepta JSON válido aunque venga con texto alrededor', () => {
    expect(parseInterpretation('Claro: {"command":"youtube","query":"pan casero"} ')).toEqual({
      command: 'youtube',
      query: 'pan casero'
    })
  })

  it('rechaza comandos inventados o JSON roto', () => {
    expect(parseInterpretation('{"command":"rm -rf","query":"x"}')).toBeNull()
    expect(parseInterpretation('{"command":"google"')).toBeNull()
    expect(parseInterpretation('{"command":"google","query":5}')).toBeNull()
    expect(parseInterpretation('nada')).toBeNull()
  })
})

describe('Markdown seguro', () => {
  it('reconoce negritas, cursivas y código sin generar HTML', () => {
    expect(parseInline('Usa **npm** y `npm run dev`, *fácil*')).toEqual([
      { text: 'Usa ' },
      { text: 'npm', bold: true },
      { text: ' y ' },
      { text: 'npm run dev', code: true },
      { text: ', ' },
      { text: 'fácil', italic: true }
    ])
    expect(parseInline('<script>alert(1)</script>')).toEqual([{ text: '<script>alert(1)</script>' }])
  })

  it('agrupa listas, títulos y bloques de código (aunque no estén cerrados)', () => {
    const blocks = parseMarkdown('## Pasos\n1. Uno\n2. Dos\n\n- a\n- b\n\nFin del texto\n```js\nconst x = 1')
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'list', 'list', 'paragraph', 'code'])
    expect(blocks[1]).toMatchObject({ ordered: true, items: [[{ text: 'Uno' }], [{ text: 'Dos' }]] })
    expect(blocks[4]).toEqual({ type: 'code', text: 'const x = 1' })
  })
})
