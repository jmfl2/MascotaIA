/**
 * Fechas especiales: el robot se ambienta solo cuando llegan (Navidad,
 * Halloween, Año Nuevo, San Valentín). Sin Electron, para poder probarlo.
 *
 * Cada fecha pone un accesorio (que ocupa su zona solo mientras dura, sin tocar
 * lo que hayas elegido) y unas partículas alrededor del robot.
 */
import type { AccessoryId } from './appearance'
import type { Text } from './i18n'

export type SeasonFx = 'snow' | 'bats' | 'confetti' | 'hearts'

export interface Season {
  id: 'ano-nuevo' | 'navidad' | 'halloween' | 'san-valentin'
  name: Text
  emoji: string
  accessories: AccessoryId[]
  fx: SeasonFx
  greeting: Text
}

export const SEASONS: readonly Season[] = [
  {
    id: 'ano-nuevo',
    name: { es: 'Año Nuevo', en: "New Year's" },
    emoji: '🎉',
    accessories: ['gorro-fiesta'],
    fx: 'confetti',
    greeting: { es: '¡Feliz Año Nuevo! 🎉', en: 'Happy New Year! 🎉' }
  },
  {
    id: 'navidad',
    name: { es: 'Navidad', en: 'Christmas' },
    emoji: '🎄',
    accessories: ['gorro-navidad', 'bufanda'],
    fx: 'snow',
    greeting: { es: '¡Feliz Navidad! 🎄', en: 'Merry Christmas! 🎄' }
  },
  {
    id: 'halloween',
    name: { es: 'Halloween', en: 'Halloween' },
    emoji: '🎃',
    accessories: ['sombrero-bruja', 'calabaza'],
    fx: 'bats',
    greeting: { es: '¡Feliz Halloween! 🎃', en: 'Happy Halloween! 🎃' }
  },
  {
    id: 'san-valentin',
    name: { es: 'San Valentín', en: "Valentine's Day" },
    emoji: '💘',
    accessories: ['gafas-corazon'],
    fx: 'hearts',
    greeting: { es: '¡Feliz San Valentín! 💘', en: "Happy Valentine's Day! 💘" }
  }
]

/** Mes (1-12) y día en que empieza y termina cada fecha (ambos incluidos). */
const RANGES: Record<Season['id'], Array<[number, number, number, number]>> = {
  // Año Nuevo va antes que Navidad: en Nochevieja y el 1 de enero, fiesta.
  'ano-nuevo': [
    [12, 31, 12, 31],
    [1, 1, 1, 1]
  ],
  navidad: [
    [12, 1, 12, 30],
    [1, 2, 1, 6]
  ],
  halloween: [[10, 24, 11, 1]],
  'san-valentin': [[2, 10, 2, 14]]
}

/** La fecha especial de hoy, o null si no hay ninguna. */
export function seasonFor(date: Date): Season | null {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const key = m * 100 + d
  for (const season of SEASONS) {
    for (const [m1, d1, m2, d2] of RANGES[season.id]) {
      if (key >= m1 * 100 + d1 && key <= m2 * 100 + d2) return season
    }
  }
  return null
}
