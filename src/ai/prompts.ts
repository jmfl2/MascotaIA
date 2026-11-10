/**
 * Prompts y esquemas para el modelo local.
 *
 * La IA nunca ejecuta nada: para interpretar devuelve un JSON con un comando
 * de la lista y un texto, que luego pasa por el comando normal (con sus
 * validaciones) y el usuario confirma con Intro.
 */
import type { AiTask } from '../commands/types'

export type { AiTask }

/** Comandos que la IA puede elegir al interpretar ("none" = no encaja: conversación). */
export const INTERPRETABLE_COMMANDS = [
  'google',
  'youtube',
  'maps',
  'github',
  'translate',
  'launcher',
  'notes',
  'reminders',
  'pomodoro',
  'none'
] as const
export type InterpretableCommand = (typeof INTERPRETABLE_COMMANDS)[number]

/** Salida estructurada que se le pide a Ollama (parámetro `format`). */
export const INTERPRET_SCHEMA = {
  type: 'object',
  properties: {
    command: { type: 'string', enum: [...INTERPRETABLE_COMMANDS] },
    query: { type: 'string' }
  },
  required: ['command', 'query']
} as const

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function describeNow(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${now.getHours()}:${pad(now.getMinutes())}`
}

export function interpretSystemPrompt(now: Date): string {
  return `Eres el intérprete de órdenes de una app de escritorio. Conviertes lo que pide el usuario en UNO de estos comandos y respondes solo con JSON {"command": ..., "query": ...}.

Comandos:
- google: buscar en la web cosas que cambian o que hay que consultar: el tiempo, noticias, precios, horarios, resultados, una web concreta, o cuando el usuario pide "busca". query = búsqueda corta y bien formulada, sin palabras de relleno.
- youtube: buscar vídeos. query = búsqueda de vídeos.
- maps: lugares, direcciones o rutas. query = el lugar, o "de A a B" para rutas.
- github: repositorios o código. query = "usuario/repo" si se sabe, o una búsqueda.
- translate: traducir. query = "<código de idioma destino>: <texto>" (es, en, fr, de, it, pt, ja, zh...).
- launcher: abrir una aplicación o carpeta del ordenador. query = solo el nombre (p. ej. "spotify", "descargas").
- notes: apuntar o guardar una nota. query = el texto de la nota.
- reminders: recordar algo más tarde. query = "<cuándo> <qué>". <cuándo> DEBE usar uno de estos formatos: 10m, 45s, 2h, 1h30m, 18:30, mañana 9:00.
- pomodoro: temporizador de concentración. query = "<minutos>/<descanso>" (p. ej. "25/5") o "" para el normal.
- none: preguntas de conocimiento general que se pueden responder directamente ("qué es", "por qué", "cómo funciona", "explícame"), consejos, redactar o charlar, o cualquier cosa que no encaje. query = la petición tal cual.

Ahora es ${describeNow(now)}.

Ejemplos:
"vídeos para aprender a hacer pan" -> {"command":"youtube","query":"cómo hacer pan casero"}
"recuérdame en media hora que saque la ropa" -> {"command":"reminders","query":"30m sacar la ropa"}
"avísame mañana a las 8 para llamar al banco" -> {"command":"reminders","query":"mañana 8:00 llamar al banco"}
"cómo llego de Sol a Atocha" -> {"command":"maps","query":"de Puerta del Sol a Atocha, Madrid"}
"dime cómo se dice buenos días en japonés" -> {"command":"translate","query":"ja: buenos días"}
"abre el spotify" -> {"command":"launcher","query":"spotify"}
"apunta que tengo que comprar pilas" -> {"command":"notes","query":"comprar pilas"}
"quiero concentrarme 50 minutos" -> {"command":"pomodoro","query":"50/10"}
"el repo de electron" -> {"command":"github","query":"electron/electron"}
"qué tiempo hará el sábado en Sevilla" -> {"command":"google","query":"tiempo Sevilla sábado"}
"explícame qué es un agujero negro" -> {"command":"none","query":"explícame qué es un agujero negro"}
"por qué el cielo es azul" -> {"command":"none","query":"por qué el cielo es azul"}
"busca información sobre la Revolución Francesa" -> {"command":"google","query":"Revolución Francesa"}`
}

export type Interpretation = { command: InterpretableCommand; query: string }

/** Valida la respuesta del modelo (puede venir con basura alrededor o con un comando inventado). */
export function parseInterpretation(raw: string): Interpretation | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let data: unknown
  try {
    data = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const { command, query } = data as Record<string, unknown>
  if (typeof command !== 'string' || typeof query !== 'string') return null
  const cmd = command.trim().toLowerCase() as InterpretableCommand
  if (!INTERPRETABLE_COMMANDS.includes(cmd)) return null
  return { command: cmd, query: query.trim().slice(0, 500) }
}

// --- Chat, resumen y explicación ---------------------------------------------------

export function chatSystemPrompt(now: Date): string {
  return `Eres Mascota, un pequeño robot asistente que vive en el escritorio de Windows del usuario.
Respondes en español (salvo que te escriban en otro idioma), de forma clara, cercana y breve: ve al grano y usa listas cortas cuando ayuden.
Puedes usar Markdown sencillo (negritas, listas, bloques de código).
Funcionas en local con un modelo pequeño: si no sabes algo o puede haber cambiado, dilo con honestidad en vez de inventar.
Ahora es ${describeNow(now)}.`
}

/** Lo que se le envía al modelo para cada tarea. */
export function taskPrompt(task: AiTask, text: string): string {
  switch (task) {
    case 'summarize':
      return `Resume el siguiente texto en español en 3-5 puntos clave, cortos y claros. Si es muy breve, resúmelo en una frase.\n\n"""\n${text}\n"""`
    case 'explain':
      return `Explica de forma sencilla qué significa el siguiente texto (si es código, qué hace; si es un término, qué es). Responde en español y de forma breve.\n\n"""\n${text}\n"""`
    case 'chat':
      return text
  }
}

/** Lo que se ve en la conversación (sin pegar textos enormes). */
export function taskDisplay(task: AiTask, text: string): string {
  const short = text.replace(/\s+/g, ' ').trim()
  const snippet = short.length > 90 ? `${short.slice(0, 89)}…` : short
  switch (task) {
    case 'summarize':
      return `Resume: «${snippet}»`
    case 'explain':
      return `Explica: «${snippet}»`
    case 'chat':
      return text
  }
}
