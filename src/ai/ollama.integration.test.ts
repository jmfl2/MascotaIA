/**
 * Prueba contra un Ollama real. Solo se ejecuta si se pide:
 *   set OLLAMA_TEST=1 && npx vitest run src/ai/ollama.integration.test.ts
 * (opcional: OLLAMA_MODEL=qwen2.5:7b). Sirve para comprobar que el prompt de
 * interpretación funciona con el modelo elegido.
 */
import { describe, expect, it } from 'vitest'
import { parseReminder } from '../commands/reminderParser'
import { createOllamaClient } from './ollama'
import { interpretSystemPrompt, INTERPRET_SCHEMA, parseInterpretation, taskPrompt } from './prompts'

const enabled = process.env.OLLAMA_TEST === '1'
const model = process.env.OLLAMA_MODEL ?? 'gemma3:4b'
const client = createOllamaClient()

async function interpret(text: string) {
  const raw = await client.chat({
    model,
    messages: [
      { role: 'system', content: interpretSystemPrompt(new Date()) },
      { role: 'user', content: text }
    ],
    format: INTERPRET_SCHEMA,
    options: { temperature: 0 },
    firstByteTimeoutMs: 120_000
  })
  return parseInterpretation(raw)
}

describe.skipIf(!enabled)(`Ollama real (${model})`, () => {
  it.each([
    ['ponme vídeos de cómo cambiar la rueda de una bici', 'youtube'],
    ['recuérdame dentro de veinte minutos que apague el horno', 'reminders'],
    ['cómo se dice "me encanta programar" en inglés', 'translate'],
    ['abre la calculadora', 'launcher'],
    ['apunta que el lunes hay reunión con Marta', 'notes'],
    ['dónde hay un hospital cerca de Plaza España en Sevilla', 'maps'],
    ['qué es la fotosíntesis y por qué es importante', 'none']
  ])('"%s" -> %s', { timeout: 120_000 }, async (text, expected) => {
    const result = await interpret(text)
    console.log(`  ${text}  ->  ${JSON.stringify(result)}`)
    expect(result?.command).toBe(expected)
    if (result?.command === 'reminders') expect(parseReminder(result.query, new Date())).not.toBeNull()
  })

  it('resume en streaming', { timeout: 120_000 }, async () => {
    let chunks = 0
    const text = await client.chat(
      {
        model,
        messages: [
          {
            role: 'user',
            content: taskPrompt(
              'summarize',
              'Electron es un framework para crear aplicaciones de escritorio con tecnologías web. Combina Chromium y Node.js en un único entorno, de modo que una misma base de código funciona en Windows, macOS y Linux. Lo usan aplicaciones como Visual Studio Code, Slack o Discord.'
            )
          }
        ]
      },
      () => chunks++
    )
    console.log(`  resumen (${chunks} trozos):\n${text}`)
    expect(chunks).toBeGreaterThan(3)
    expect(text.length).toBeGreaterThan(30)
  })
})
