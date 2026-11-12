/** IAs a las que se puede mandar lo que copias (lo usan la configuración y los ajustes). */
export const ASSISTANTS = [
  { id: 'claude', name: 'Claude' },
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'perplexity', name: 'Perplexity' },
  { id: 'gemini', name: 'Gemini' }
] as const

export type Assistant = (typeof ASSISTANTS)[number]['id']

export function isAssistant(v: unknown): v is Assistant {
  return ASSISTANTS.some((a) => a.id === v)
}

export function assistantName(id: Assistant): string {
  return ASSISTANTS.find((a) => a.id === id)!.name
}
