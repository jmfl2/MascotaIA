/**
 * Comandos de IA local (Ollama):
 *   ia <pregunta>          -> chat dentro de la barra
 *   resumir [texto]        -> resume el texto (o el portapapeles)
 *   explicar [texto]       -> explica el texto (o el portapapeles)
 *
 * Si Ollama no está instalado, está parado o falta el modelo, en lugar de
 * fallar se muestran filas que explican qué pasa y cómo arreglarlo.
 */
import { t, tx, type Text } from '../shared/i18n'
import { sanitizeQuery } from './sanitize'
import type { AiStatus, AiTask, CommandContext, CommandModule, Suggestion } from './types'

export const SPARKLE_ICON = 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M18.5 15.5l.7 1.8l1.8.7l-1.8.7l-.7 1.8l-.7-1.8l-1.8-.7l1.8-.7z'
const DOWNLOAD_ICON = 'M12 4v11 M7.5 10.5L12 15l4.5-4.5 M5 19.5h14'
const PLAY_ICON = 'M8 5.5l10 6.5l-10 6.5z'
const SUMMARY_ICON = 'M5 6h14 M5 10h14 M5 14h9 M5 18h6'
const EXPLAIN_ICON = 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6 M12 17.5v.01 M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17z'
const ACCENT = '#a855f7'
const GREY = '#64748b'

/** Filas que explican por qué la IA no está disponible y cómo arreglarlo. */
export function aiStatusRows(status: AiStatus, ctx: CommandContext): Suggestion[] {
  const info = (title: string, subtitle: string): Suggestion => ({
    title,
    subtitle,
    icon: { kind: 'glyph', path: SPARKLE_ICON, accent: GREY },
    disabled: true,
    run: () => ({ kind: 'refresh' })
  })

  switch (status.state) {
    case 'ready':
      return []
    case 'checking':
      return [info(t('Comprobando la IA local…', 'Checking the local AI…'), t('Un momento', 'One moment'))]
    case 'not-installed':
      return [
        info(
          t('La IA local necesita Ollama', 'The local AI needs Ollama'),
          t(
            'Instálalo desde ollama.com (o «winget install Ollama.Ollama») y vuelve a abrir la barra',
            'Install it from ollama.com (or "winget install Ollama.Ollama") and reopen the bar'
          )
        )
      ]
    case 'not-running':
      return [
        info(t('Ollama está instalado, pero parado', 'Ollama is installed, but stopped'), t('Arráncalo para usar la IA', 'Start it to use the AI')),
        {
          title: t('Iniciar Ollama', 'Start Ollama'),
          subtitle: t('Lo arranca en segundo plano', 'Starts it in the background'),
          icon: { kind: 'glyph', path: PLAY_ICON, accent: ACCENT },
          run: () => ctx.ai.start()
        }
      ]
    case 'no-model':
      return [
        info(
          t(`Falta el modelo ${status.model}`, `The ${status.model} model is missing`),
          status.models.length
            ? `${t('Tienes', 'You have')}: ${status.models.join(', ')}`
            : t('Aún no hay modelos descargados', 'No models downloaded yet')
        ),
        {
          title: `${t('Descargar', 'Download')} ${status.model}`,
          subtitle: t('Unos minutos; el robot te avisa al terminar', 'A few minutes; the robot will let you know when it is done'),
          icon: { kind: 'glyph', path: DOWNLOAD_ICON, accent: ACCENT },
          run: () => ctx.ai.pull()
        }
      ]
    case 'pulling':
      return [
        info(
          `${t('Descargando', 'Downloading')} ${status.model}… ${Math.round((status.progress ?? 0) * 100)} %`,
          t('El robot te avisa al terminar', 'The robot will let you know when it is done')
        )
      ]
  }
}

/** Chat con la IA dentro de la barra. Si la IA está lista no hay filas: la barra muestra la conversación. */
export const ai: CommandModule = {
  id: 'ai',
  get name() {
    return t('IA', 'AI')
  },
  prefixes: ['ia', 'ai', 'chat', '?'],
  get hint() {
    return t('Pregúntale a la IA local', 'Ask the local AI')
  },
  get placeholder() {
    return t('Pregunta lo que quieras…', 'Ask anything…')
  },
  accent: ACCENT,
  iconPath: SPARKLE_ICON,
  suggest(_query, ctx) {
    return aiStatusRows(ctx.ai.status(), ctx)
  }
}

function snippet(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

interface TextTaskMeta {
  id: string
  name: Text
  prefixes: readonly string[]
  hint: Text
  iconPath: string
}

function textTask(task: Exclude<AiTask, 'chat'>, meta: TextTaskMeta): CommandModule {
  const summarizing = task === 'summarize'
  return {
    id: meta.id,
    get name() {
      return tx(meta.name)
    },
    prefixes: meta.prefixes,
    get hint() {
      return tx(meta.hint)
    },
    get placeholder() {
      return t('Pega un texto (o deja vacío para el portapapeles)…', 'Paste some text (or leave empty for the clipboard)…')
    },
    accent: ACCENT,
    iconPath: meta.iconPath,
    async suggest(query, ctx) {
      const status = ctx.ai.status()
      if (status.state !== 'ready') return aiStatusRows(status, ctx)

      const typed = sanitizeQuery(query)
      const text = typed || (await ctx.clipboardText()).trim()
      if (!text) {
        return [
          {
            title: summarizing ? t('No hay nada que resumir', 'Nothing to summarize') : t('No hay nada que explicar', 'Nothing to explain'),
            subtitle: t('Escribe o pega un texto, o copia algo antes de abrir la barra', 'Type or paste some text, or copy something before opening the bar'),
            disabled: true,
            run: () => ({ kind: 'error', message: t('Copia o escribe un texto primero', 'Copy or type some text first') })
          }
        ]
      }
      return [
        {
          title: typed
            ? `${summarizing ? t('Resumir', 'Summarize') : t('Explicar', 'Explain')} «${snippet(typed)}»`
            : summarizing
              ? t('Resumir el portapapeles', 'Summarize the clipboard')
              : t('Explicar el portapapeles', 'Explain the clipboard'),
          subtitle: typed ? t('Con la IA local', 'With the local AI') : `«${snippet(text)}»`,
          run: () => ({ kind: 'chat', task, text: text.slice(0, 20_000) })
        }
      ]
    }
  }
}

export const summarize = textTask('summarize', {
  id: 'summarize',
  name: { es: 'Resumir', en: 'Summarize' },
  prefixes: ['resumir', 'resume', 'summarize', 'sum'],
  hint: { es: 'Resumir un texto o el portapapeles', en: 'Summarize some text or the clipboard' },
  iconPath: SUMMARY_ICON
})

export const explain = textTask('explain', {
  id: 'explain',
  name: { es: 'Explicar', en: 'Explain' },
  prefixes: ['explicar', 'explica', 'explain'],
  hint: { es: 'Explicar un texto, término o código', en: 'Explain some text, a term or code' },
  iconPath: EXPLAIN_ICON
})
