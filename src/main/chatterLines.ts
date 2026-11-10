/** Frases del modo hablador (sin Electron, para poder probarlo). */
import { getLang, t, type Lang } from '../shared/i18n'

export type ChatterMoment = 'pomodoro-half' | 'pomodoro-last' | 'break' | 'late' | 'wake'

const LINES: Record<Lang, Record<ChatterMoment, string[]>> = {
  es: {
    'pomodoro-half': ['¡Vas por la mitad! 💪', 'Mitad del pomodoro. ¡Sigue así!', 'Medio camino hecho 🍅'],
    'pomodoro-last': ['¡Último minuto! Remata 🏁', 'Queda un minuto. ¡Ya casi!'],
    break: ['Llevas un buen rato. ¿Estiramos un poco? 🧘', '¿Un vaso de agua? Llevas mucho seguido 💧', 'Pausa de 2 minutos: tus ojos te lo agradecerán 👀'],
    late: ['Es muy tarde… ¿no deberías descansar? 😴', 'Trasnochando, ¿eh? Mañana me lo agradecerás 🌙'],
    wake: ['¡Uy! Me había quedado dormido 😅', '¡Hola de nuevo! 👋']
  },
  en: {
    'pomodoro-half': ["You're halfway there! 💪", 'Half the pomodoro done. Keep it up!', 'Halfway done 🍅'],
    'pomodoro-last': ['Last minute! Finish strong 🏁', 'One minute left. Almost there!'],
    break: ["You've been at it a while. Time for a stretch? 🧘", "A glass of water? You've been going for ages 💧", 'A 2-minute break: your eyes will thank you 👀'],
    late: ["It's really late… shouldn't you get some rest? 😴", "Up late, huh? You'll thank me tomorrow 🌙"],
    wake: ['Oops! I dozed off 😅', 'Hello again! 👋']
  }
}

export function pickLine(moment: ChatterMoment, rand: number, _name: string): string {
  const list = LINES[getLang()][moment]
  return list[Math.min(list.length - 1, Math.floor(rand * list.length))]
}

/** Saludo según la hora: "¡Buenos días! Soy Robi ☀️". */
export function pickGreeting(hour: number, rand: number, name: string): string {
  const intro = rand < 0.5 ? t(`Soy ${name}`, `I'm ${name}`) : t('Aquí estoy', 'Here I am')
  if (hour >= 6 && hour < 13) return t(`¡Buenos días! ${intro} ☀️`, `Good morning! ${intro} ☀️`)
  if (hour >= 13 && hour < 20) return t(`¡Buenas tardes! ${intro} 👋`, `Good afternoon! ${intro} 👋`)
  if (hour >= 20) return t(`¡Buenas noches! ${intro} 🌙`, `Good evening! ${intro} 🌙`)
  return t(`¿Trasnochando? ${intro} 🦉`, `Up late? ${intro} 🦉`)
}
