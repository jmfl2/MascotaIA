/** Frases del modo hablador (sin Electron, para poder probarlo). */

export type ChatterMoment = 'pomodoro-half' | 'pomodoro-last' | 'break' | 'late' | 'wake'

const LINES: Record<ChatterMoment, string[]> = {
  'pomodoro-half': ['¡Vas por la mitad! 💪', 'Mitad del pomodoro. ¡Sigue así!', 'Medio camino hecho 🍅'],
  'pomodoro-last': ['¡Último minuto! Remata 🏁', 'Queda un minuto. ¡Ya casi!'],
  break: ['Llevas un buen rato. ¿Estiramos un poco? 🧘', '¿Un vaso de agua? Llevas mucho seguido 💧', 'Pausa de 2 minutos: tus ojos te lo agradecerán 👀'],
  late: ['Es muy tarde… ¿no deberías descansar? 😴', 'Trasnochando, ¿eh? Mañana me lo agradecerás 🌙'],
  wake: ['¡Uy! Me había quedado dormido 😅', '¡Hola de nuevo! 👋']
}

export function pickLine(moment: ChatterMoment, rand: number, _name: string): string {
  const list = LINES[moment]
  return list[Math.min(list.length - 1, Math.floor(rand * list.length))]
}

/** Saludo según la hora: "¡Buenos días! Soy Robi ☀️". */
export function pickGreeting(hour: number, rand: number, name: string): string {
  const intro = rand < 0.5 ? `Soy ${name}` : 'Aquí estoy'
  if (hour >= 6 && hour < 13) return `¡Buenos días! ${intro} ☀️`
  if (hour >= 13 && hour < 20) return `¡Buenas tardes! ${intro} 👋`
  if (hour >= 20) return `¡Buenas noches! ${intro} 🌙`
  return `¿Trasnochando? ${intro} 🦉`
}
