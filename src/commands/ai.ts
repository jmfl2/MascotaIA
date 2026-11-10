/**
 * Comandos de IA local (Ollama):
 *   ia <pregunta>          -> chat dentro de la barra
 *   resumir [texto]        -> resume el texto (o el portapapeles)
 *   explicar [texto]       -> explica el texto (o el portapapeles)
 *
 * Si Ollama no está instalado, está parado o falta el modelo, en lugar de
 * fallar se muestran filas que explican qué pasa y cómo arreglarlo.
 */
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
      return [info('Comprobando la IA local…', 'Un momento')]
    case 'not-installed':
      return [
        info(
          'La IA local necesita Ollama',
          'Instálalo desde ollama.com (o «winget install Ollama.Ollama») y vuelve a abrir la barra'
        )
      ]
    case 'not-running':
      return [
        info('Ollama está instalado, pero parado', 'Arráncalo para usar la IA'),
        {
          title: 'Iniciar Ollama',
          subtitle: 'Lo arranca en segundo plano',
          icon: { kind: 'glyph', path: PLAY_ICON, accent: ACCENT },
          run: () => ctx.ai.start()
        }
      ]
    case 'no-model':
      return [
        info(`Falta el modelo ${status.model}`, status.models.length ? `Tienes: ${status.models.join(', ')}` : 'Aún no hay modelos descargados'),
        {
          title: `Descargar ${status.model}`,
          subtitle: 'Unos minutos; el robot te avisa al terminar',
          icon: { kind: 'glyph', path: DOWNLOAD_ICON, accent: ACCENT },
          run: () => ctx.ai.pull()
        }
      ]
    case 'pulling':
      return [info(`Descargando ${status.model}… ${Math.round((status.progress ?? 0) * 100)} %`, 'El robot te avisa al terminar')]
  }
}

/** Chat con la IA dentro de la barra. Si la IA está lista no hay filas: la barra muestra la conversación. */
export const ai: CommandModule = {
  id: 'ai',
  name: 'IA',
  prefixes: ['ia', 'chat', '?'],
  hint: 'Pregúntale a la IA local',
  placeholder: 'Pregunta lo que quieras…',
  accent: ACCENT,
  iconPath: SPARKLE_ICON,
  suggest(_query, ctx) {
    return aiStatusRows(ctx.ai.status(), ctx)
  }
}

function snippet(text: string, max = 80): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function textTask(task: Exclude<AiTask, 'chat'>, meta: Omit<CommandModule, 'suggest'>): CommandModule {
  const verb = task === 'summarize' ? 'Resumir' : 'Explicar'
  return {
    ...meta,
    async suggest(query, ctx) {
      const status = ctx.ai.status()
      if (status.state !== 'ready') return aiStatusRows(status, ctx)

      const typed = sanitizeQuery(query)
      const text = typed || (await ctx.clipboardText()).trim()
      if (!text) {
        return [
          {
            title: 'No hay nada que ' + verb.toLowerCase(),
            subtitle: 'Escribe o pega un texto, o copia algo antes de abrir la barra',
            disabled: true,
            run: () => ({ kind: 'error', message: 'Copia o escribe un texto primero' })
          }
        ]
      }
      return [
        {
          title: typed ? `${verb} «${snippet(typed)}»` : `${verb} el portapapeles`,
          subtitle: typed ? 'Con la IA local' : `«${snippet(text)}»`,
          run: () => ({ kind: 'chat', task, text: text.slice(0, 20_000) })
        }
      ]
    }
  }
}

export const summarize = textTask('summarize', {
  id: 'summarize',
  name: 'Resumir',
  prefixes: ['resumir', 'resume'],
  hint: 'Resumir un texto o el portapapeles',
  placeholder: 'Pega un texto (o deja vacío para el portapapeles)…',
  accent: ACCENT,
  iconPath: SUMMARY_ICON
})

export const explain = textTask('explain', {
  id: 'explain',
  name: 'Explicar',
  prefixes: ['explicar', 'explica'],
  hint: 'Explicar un texto, término o código',
  placeholder: 'Pega un texto (o deja vacío para el portapapeles)…',
  accent: ACCENT,
  iconPath: EXPLAIN_ICON
})
