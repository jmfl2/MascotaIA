/**
 * Vigila el portapapeles (Electron no tiene evento de cambio, así que se
 * consulta cada poco). El texto nunca se guarda en disco ni se registra.
 *
 * Electron 45 usa una API asíncrona al estilo de `navigator.clipboard`.
 */
import { clipboard } from 'electron'
import { PRIVATE_CLIPBOARD_FORMATS, shouldOffer, type OfferDecision } from './clipboardFilter'

export type Offer = Extract<OfferDecision, { offer: true }>

const POLL_MS = 700

let timer: NodeJS.Timeout | null = null
let running = false
let checking = false
let last = ''
/** Texto que hemos copiado nosotros (p. ej. una nota): no lo ofrecemos. */
let ownCopy: string | null = null

/** Formato "en bruto" del sistema (nombre registrado en Windows). */
const rawFormat = (name: string) => `electron application/osclipboard;format="${name}"`

/** ¿Pidió la app de origen (gestor de contraseñas) que no se lea? */
async function isPrivate(): Promise<boolean> {
  for (const format of PRIVATE_CLIPBOARD_FORMATS) {
    try {
      if (await clipboard.has(rawFormat(format))) return true
    } catch {
      /* formato no disponible */
    }
  }
  return false
}

async function check(onText: (offer: Offer) => void): Promise<void> {
  if (checking) return
  checking = true
  try {
    const text = await clipboard.readText()
    if (text === last) return
    last = text
    if (text === ownCopy) {
      ownCopy = null
      return
    }
    if (!text || (await isPrivate())) return
    const decision = shouldOffer(text)
    if (decision.offer) onText(decision)
  } catch {
    /* portapapeles ocupado por otra app: se reintenta en la siguiente vuelta */
  } finally {
    checking = false
  }
}

export const clipboardWatcher = {
  start(onText: (offer: Offer) => void): void {
    if (running) return
    running = true
    // Lo que ya había al arrancar no se ofrece: se lee antes de empezar a vigilar.
    void clipboard
      .readText()
      .then((text) => {
        last = text
      })
      .catch(() => {})
      .finally(() => {
        if (running && !timer) timer = setInterval(() => void check(onText), POLL_MS)
      })
  },

  stop(): void {
    running = false
    if (timer) clearInterval(timer)
    timer = null
  },

  isRunning: (): boolean => running,

  /** Copia texto sin que el robot lo ofrezca después. */
  copy(text: string): void {
    ownCopy = text
    void clipboard.writeText(text).catch((err) => console.warn('[portapapeles] No se pudo copiar:', err))
  }
}
