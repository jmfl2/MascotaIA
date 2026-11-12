/**
 * Soltar archivos o carpetas encima del robot: sale un bocadillo con lo que se
 * puede hacer con ellos según su tipo (ver services/dropKinds.ts).
 *
 *   💬 Preguntar a la IA   -> con clave de API, Claude los recibe y responde en la
 *                             barra; si no, se copian al portapapeles como archivos
 *                             y se abre la IA para pegarlos con Ctrl+V.
 *   ✨ Resumir             -> un archivo de texto, con la IA local.
 *   🗜️ Comprimir           -> varias cosas o una carpeta, en un .zip al lado.
 *   ⭐ Favoritos · 📋 Copiar la ruta
 */
import type Anthropic from '@anthropic-ai/sdk'
import { shell } from 'electron'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { assistantName } from '../shared/assistants'
import { t } from '../shared/i18n'
import { IPC } from '../shared/ipc'
import { sendFilesToClaude } from './ai/aiChat'
import { aiStatus } from './ai/aiService'
import { openAssistantHome } from './askAssistant'
import { getBarWindow, openBar } from './barWindow'
import { closeBubbleIf, showBubble, toast } from './bubbleWindow'
import { getClaudeKey } from './claudeKey'
import { robotMood } from './robotMood'
import { clipboardWatcher } from './services/clipboardWatcher'
import { dropOptions, kindOf, sendableToApi, zipName, type DroppedItem, type DropOption } from './services/dropKinds'
import { copyFilesToClipboard, zipFiles } from './services/fileActions'
import { addFavorites } from './services/launcher'
import { getConfig } from './store'

const MAX_ITEMS = 10
/** Lo que se le pide a Claude al mandarle archivos (luego se puede seguir preguntando). */
const askPrompt = () =>
  t(
    'Échale un vistazo y dime qué es y lo más importante, de forma breve.',
    'Take a look and tell me briefly what this is and what matters most.'
  )

function snippet(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Lee lo soltado (solo lo que existe) y averigua el tipo de cada cosa. */
function readItems(paths: string[]): DroppedItem[] {
  const items: DroppedItem[] = []
  for (const path of paths.slice(0, MAX_ITEMS)) {
    try {
      const st = statSync(path)
      items.push({ path, name: basename(path) || path, kind: kindOf(path, st.isDirectory()), size: st.isDirectory() ? 0 : st.size })
    } catch {
      /* ya no existe o no hay permiso */
    }
  }
  return items
}

const IMAGE_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

/** Bloque para la API de Claude con el contenido del archivo. */
function toBlock(item: DroppedItem): Anthropic.Beta.BetaContentBlockParam {
  const data = readFileSync(item.path)
  if (item.kind === 'image') {
    return { type: 'image', source: { type: 'base64', media_type: IMAGE_TYPES[extname(item.path).toLowerCase()], data: data.toString('base64') } }
  }
  if (item.kind === 'pdf') {
    return { type: 'document', title: item.name, source: { type: 'base64', media_type: 'application/pdf', data: data.toString('base64') } }
  }
  return { type: 'document', title: item.name, source: { type: 'text', media_type: 'text/plain', data: data.toString('utf8') } }
}

async function askAboutFiles(items: DroppedItem[]): Promise<void> {
  const assistant = getConfig().askAi
  // Con clave de API, Claude recibe los archivos y responde dentro de la barra.
  if (assistant === 'claude' && getClaudeKey() && items.every(sendableToApi)) {
    try {
      const blocks = items.map(toBlock)
      openBar()
      getBarWindow()?.webContents.send(IPC.barEnterChat, 'claude')
      await sendFilesToClaude(blocks, items.map((i) => i.name), askPrompt())
    } catch {
      robotMood.flash('confused')
      toast(t('No pude leer el archivo', "I couldn't read the file"))
    }
    return
  }
  // Si no: los archivos al portapapeles (como Ctrl+C en el Explorador) y abrir la IA para pegarlos.
  try {
    await copyFilesToClipboard(items.map((i) => i.path))
  } catch (err) {
    console.warn('[soltar] no se pudo copiar al portapapeles:', err)
    robotMood.flash('confused')
    toast(t('No pude copiar el archivo', "I couldn't copy the file"))
    return
  }
  const ok = await openAssistantHome(assistant)
  robotMood.flash(ok ? 'happy' : 'confused')
  if (ok) {
    toast(
      items.length === 1
        ? t(`Archivo copiado: pégalo en ${assistantName(assistant)} con Ctrl+V`, `File copied: paste it into ${assistantName(assistant)} with Ctrl+V`)
        : t(`Archivos copiados: pégalos en ${assistantName(assistant)} con Ctrl+V`, `Files copied: paste them into ${assistantName(assistant)} with Ctrl+V`)
    )
  }
}

function summarize(item: DroppedItem): void {
  try {
    const text = readFileSync(item.path, 'utf8').slice(0, 20_000)
    void import('./features').then(({ askAiAbout }) => askAiAbout('summarize', text))
  } catch {
    robotMood.flash('confused')
    toast(t('No pude leer el archivo', "I couldn't read the file"))
  }
}

async function zip(items: DroppedItem[]): Promise<void> {
  const dir = dirname(items[0].path)
  const base = items.length === 1 ? items[0].name : t('Archivos', 'Files')
  const dest = join(dir, zipName(base, (name) => existsSync(join(dir, name))))
  const bubbleId = showBubble({ kind: 'info', title: t('🗜️ Comprimiendo…', '🗜️ Compressing…'), text: basename(dest), timeoutMs: null })
  try {
    await zipFiles(
      items.map((i) => i.path),
      dest
    )
    robotMood.flash('wink')
    toast(t(`🗜️ Listo: ${basename(dest)}`, `🗜️ Done: ${basename(dest)}`))
    shell.showItemInFolder(dest)
  } catch (err) {
    console.warn('[soltar] no se pudo comprimir:', err)
    robotMood.flash('confused')
    toast(t('No se pudo comprimir', "Couldn't compress"))
  } finally {
    if (bubbleId) closeBubbleIf(bubbleId)
  }
}

function addToFavorites(items: DroppedItem[]): void {
  const added = addFavorites(items.map((i) => i.path))
  if (added.length) {
    robotMood.flash('happy')
    showBubble({
      kind: 'favorite',
      title: added.length === 1 ? t('⭐ Añadido a favoritos', '⭐ Added to favorites') : t(`⭐ ${added.length} favoritos nuevos`, `⭐ ${added.length} new favorites`),
      text: `${snippet(added.join(', '), 90)}\n${t(`Ábrelo con «abrir ${snippet(added[0], 20)}».`, `Open it with "open ${snippet(added[0], 20)}".`)}`,
      timeoutMs: 4000
    })
  } else {
    robotMood.flash('confused')
    toast(t('Ya estaba en favoritos', 'Already in favorites'))
  }
}

function copyPaths(items: DroppedItem[]): void {
  clipboardWatcher.copy(items.map((i) => i.path).join('\n'))
  robotMood.flash('wink')
  toast(items.length === 1 ? t('Ruta copiada', 'Path copied') : t('Rutas copiadas', 'Paths copied'))
}

function action(option: DropOption, items: DroppedItem[]): { id: string; label: string; run: () => void } {
  switch (option) {
    case 'ask':
      return { id: 'ask', label: `💬 ${t('Preguntar a', 'Ask')} ${assistantName(getConfig().askAi)}`, run: () => void askAboutFiles(items) }
    case 'summarize':
      return { id: 'summarize', label: t('✨ Resumir', '✨ Summarize'), run: () => summarize(items[0]) }
    case 'zip':
      return { id: 'zip', label: t('🗜️ Comprimir', '🗜️ Compress'), run: () => void zip(items) }
    case 'favorite':
      return { id: 'favorite', label: t('⭐ Favoritos', '⭐ Favorites'), run: () => addToFavorites(items) }
    case 'copyPath':
      return { id: 'copyPath', label: items.length === 1 ? t('📋 Copiar ruta', '📋 Copy path') : t('📋 Copiar rutas', '📋 Copy paths'), run: () => copyPaths(items) }
  }
}

export function showDropMenu(paths: string[]): void {
  const items = readItems(paths)
  if (!items.length) {
    robotMood.flash('confused')
    return
  }
  const options = dropOptions(items, { localAiReady: aiStatus().state === 'ready' })
  robotMood.flash('happy')
  showBubble({
    kind: 'favorite',
    title:
      items.length === 1
        ? t(`¿Qué hago con «${snippet(items[0].name, 40)}»?`, `What should I do with "${snippet(items[0].name, 40)}"?`)
        : t(`¿Qué hago con estas ${items.length} cosas?`, `What should I do with these ${items.length} items?`),
    text: items.length > 1 ? snippet(items.map((i) => i.name).join(', '), 100) : undefined,
    timeoutMs: 15_000,
    actions: options.map((o, i) => ({ ...action(o, items), primary: i === 0 }))
  })
}
