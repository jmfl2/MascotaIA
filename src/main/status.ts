/**
 * Indicadores de estado en la isla: micro y cámara en uso (puntitos) y avisos
 * de batería (al enchufar el cargador y con poca batería).
 *
 * La batería la mide la página de la isla (navigator.getBattery) y la manda
 * aquí; el micro y la cámara los vigila services/privacy.ts.
 */
import type { BatteryReport } from '../shared/ipc'
import { t } from '../shared/i18n'
import { showBubble } from './bubbleWindow'
import { batteryNotice } from './services/battery'
import { currentPrivacy, watchPrivacy } from './services/privacy'
import { getConfig } from './store'
import { setTabPrivacy } from './tabWindow'

let last: BatteryReport | null = null
let warned = new Set<number>()

const pct = (level: number) => `${Math.round(level * 100)} %`

/** Lo que llega de la página de la isla. */
export function batteryReported(raw: unknown): void {
  const r = (raw ?? {}) as Record<string, unknown>
  if (typeof r.level !== 'number' || !Number.isFinite(r.level) || typeof r.charging !== 'boolean') return
  const next: BatteryReport = { level: Math.min(1, Math.max(0, r.level)), charging: r.charging }
  const notice = getConfig().statusIndicators ? batteryNotice(last, next, warned) : null
  // Al cargar, se vuelve a avisar la próxima vez que baje.
  if (next.charging) warned = new Set()
  last = next
  if (!notice) return
  if (notice.kind === 'charging') {
    showBubble({ kind: 'info', title: t(`⚡ Cargando · ${pct(notice.level)}`, `⚡ Charging · ${pct(notice.level)}`), timeoutMs: 2500 })
  } else {
    warned.add(notice.threshold)
    showBubble({
      kind: 'pomodoro', // prioridad media: no la tapa un aviso del portapapeles
      title: t(`🪫 Batería baja: ${pct(notice.level)}`, `🪫 Low battery: ${pct(notice.level)}`),
      text: t('Conecta el cargador pronto', 'Plug in the charger soon'),
      timeoutMs: 8000,
      chime: true,
      notifyIfHidden: true
    })
  }
}

/** Enciende o apaga los puntitos de micro y cámara según los ajustes. */
export function syncStatusIndicators(): void {
  const enabled = getConfig().statusIndicators
  watchPrivacy(enabled, (state) => setTabPrivacy({ ...state, enabled }))
  setTabPrivacy({ ...currentPrivacy(), enabled })
}
