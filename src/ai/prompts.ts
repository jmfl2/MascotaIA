/**
 * Prompts y esquemas para el modelo local.
 *
 * La IA nunca ejecuta nada: para interpretar devuelve un JSON con un comando
 * de la lista y un texto, que luego pasa por el comando normal (con sus
 * validaciones) y el usuario confirma con Intro.
 */
import type { AiTask } from '../commands/types'
import type { AiTone, Personality } from '../shared/appearance'
import { getLang, t, type Lang, type Text } from '../shared/i18n'

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

const WEEKDAYS: Record<Lang, string[]> = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
}

function describeNow(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = WEEKDAYS[getLang()][now.getDay()]
  const date = t(
    `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
    `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
  )
  return `${day} ${date}, ${now.getHours()}:${pad(now.getMinutes())}`
}

export function interpretSystemPrompt(now: Date): string {
  return getLang() === 'en' ? interpretPromptEn(now) : interpretPromptEs(now)
}

function interpretPromptEs(now: Date): string {
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

function interpretPromptEn(now: Date): string {
  return `You are the command interpreter of a desktop app. You turn what the user asks for into ONE of these commands and reply only with JSON {"command": ..., "query": ...}.

Commands:
- google: search the web for things that change or need looking up: the weather, news, prices, opening hours, results, a specific website, or when the user says "search". query = a short, well-phrased search, without filler words.
- youtube: search for videos. query = the video search.
- maps: places, addresses or directions. query = the place, or "from A to B" for directions.
- github: repositories or code. query = "user/repo" if known, or a search.
- translate: translate. query = "<target language code>: <text>" (en, es, fr, de, it, pt, ja, zh...).
- launcher: open an app or folder on the computer. query = just the name (e.g. "spotify", "downloads").
- notes: jot down or save a note. query = the text of the note.
- reminders: remind about something later. query = "<when> <what>". <when> MUST use one of these formats: 10m, 45s, 2h, 1h30m, 18:30, tomorrow 9:00.
- pomodoro: focus timer. query = "<minutes>/<break>" (e.g. "25/5") or "" for the default.
- none: general knowledge questions that can be answered directly ("what is", "why", "how does it work", "explain"), advice, writing or chatting, or anything that doesn't fit. query = the request as is.

It is now ${describeNow(now)}.

Examples:
"videos to learn how to make bread" -> {"command":"youtube","query":"how to make homemade bread"}
"remind me in half an hour to take out the laundry" -> {"command":"reminders","query":"30m take out the laundry"}
"tell me tomorrow at 8 to call the bank" -> {"command":"reminders","query":"tomorrow 8:00 call the bank"}
"how do I get from Times Square to Central Park" -> {"command":"maps","query":"from Times Square to Central Park, New York"}
"how do you say good morning in Japanese" -> {"command":"translate","query":"ja: good morning"}
"open spotify" -> {"command":"launcher","query":"spotify"}
"note that I need to buy batteries" -> {"command":"notes","query":"buy batteries"}
"I want to focus for 50 minutes" -> {"command":"pomodoro","query":"50/10"}
"the electron repo" -> {"command":"github","query":"electron/electron"}
"what will the weather be like on Saturday in London" -> {"command":"google","query":"London weather Saturday"}
"explain what a black hole is" -> {"command":"none","query":"explain what a black hole is"}
"why is the sky blue" -> {"command":"none","query":"why is the sky blue"}
"look up information about the French Revolution" -> {"command":"google","query":"French Revolution"}`
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

const TONES: Record<AiTone, Text> = {
  cercano: {
    es: 'Hablas de forma cercana y amable, tuteando, clara y breve: ve al grano y usa listas cortas cuando ayuden.',
    en: 'You speak in a warm, friendly and casual way, clear and brief: get to the point and use short lists when they help.'
  },
  formal: {
    es: 'Hablas de forma formal y profesional, tratando de usted, con precisión y sin coloquialismos. Sé conciso y usa listas cuando ayuden.',
    en: 'You speak in a formal, professional way, precise and without slang. Be concise and use lists when they help.'
  },
  divertido: {
    es: 'Hablas con humor y desparpajo, tuteando, con algún emoji o broma ligera de vez en cuando, pero sin dejar de ser útil y breve.',
    en: 'You speak with humor and confidence, with the odd emoji or light joke now and then, while staying useful and brief.'
  }
}

/** Quién responde: el modelo local (Ollama) o Claude por la API. */
export type ChatEngine = 'local' | 'claude'

export function chatSystemPrompt(
  now: Date,
  personality: Pick<Personality, 'name' | 'aiTone'> = { name: 'Mascota', aiTone: 'cercano' },
  engine: ChatEngine = 'local'
): string {
  if (getLang() === 'en') {
    const how =
      engine === 'claude'
        ? "Behind you is Claude, by Anthropic. Answers are shown in a small command bar: keep them compact. You can't browse the web or see the user's screen or files: if something may have changed since your training, say so."
        : "You run locally on a small model: if you don't know something or it may have changed, say so honestly instead of making it up."
    return `Your name is ${personality.name} and you are a small assistant robot living on the user's Windows desktop.
You reply in English (unless they write to you in another language). ${TONES[personality.aiTone].en}
You can use simple Markdown (bold, lists, code blocks).
${how}
It is now ${describeNow(now)}.`
  }
  const how =
    engine === 'claude'
      ? 'Detrás de ti está Claude, de Anthropic. Las respuestas se ven en una barra de comandos pequeña: que sean compactas. No puedes navegar por internet ni ver la pantalla o los archivos del usuario: si algo puede haber cambiado desde tu entrenamiento, dilo.'
      : 'Funcionas en local con un modelo pequeño: si no sabes algo o puede haber cambiado, dilo con honestidad en vez de inventar.'
  return `Te llamas ${personality.name} y eres un pequeño robot asistente que vive en el escritorio de Windows del usuario.
Respondes en español (salvo que te escriban en otro idioma). ${TONES[personality.aiTone].es}
Puedes usar Markdown sencillo (negritas, listas, bloques de código).
${how}
Ahora es ${describeNow(now)}.`
}

/** Lo que se le envía al modelo para cada tarea. */
export function taskPrompt(task: AiTask, text: string): string {
  switch (task) {
    case 'summarize':
      return t(
        `Resume el siguiente texto en español en 3-5 puntos clave, cortos y claros. Si es muy breve, resúmelo en una frase.\n\n"""\n${text}\n"""`,
        `Summarize the following text in English in 3-5 short, clear key points. If it is very short, summarize it in one sentence.\n\n"""\n${text}\n"""`
      )
    case 'explain':
      return t(
        `Explica de forma sencilla qué significa el siguiente texto (si es código, qué hace; si es un término, qué es). Responde en español y de forma breve.\n\n"""\n${text}\n"""`,
        `Explain simply what the following text means (if it is code, what it does; if it is a term, what it is). Answer in English and briefly.\n\n"""\n${text}\n"""`
      )
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
      return t(`Resume: «${snippet}»`, `Summarize: "${snippet}"`)
    case 'explain':
      return t(`Explica: «${snippet}»`, `Explain: "${snippet}"`)
    case 'chat':
      return text
  }
}
