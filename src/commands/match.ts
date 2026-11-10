/** Quita tildes y pasa a minúsculas: "Música" -> "musica". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/**
 * Puntúa de 0 a 100 cuánto se parece `name` a lo que se escribe.
 *   100 igual · 90 empieza igual · 75 alguna palabra empieza igual
 *   65 iniciales ("vsc" -> Visual Studio Code) · 55 contiene · 25 letras en orden
 */
export function matchScore(name: string, query: string): number {
  const n = normalize(name)
  const q = normalize(query)
  if (!q || !n) return 0
  if (n === q) return 100
  if (n.startsWith(q)) return 90
  const words = n.split(/[\s\-_.()]+/).filter(Boolean)
  if (words.some((w) => w.startsWith(q))) return 75
  if (q.length >= 2 && words.map((w) => w[0]).join('').startsWith(q)) return 65
  if (n.includes(q)) return 55
  if (q.length >= 3 && isSubsequence(q.replace(/\s+/g, ''), n)) return 25
  return 0
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const ch of haystack) {
    if (ch === needle[i]) i++
    if (i === needle.length) return true
  }
  return false
}

/** Devuelve los elementos que encajan, ordenados por relevancia. */
export function rank<T>(items: readonly T[], query: string, getText: (item: T) => string): Array<{ item: T; score: number }> {
  return items
    .map((item) => ({ item, score: matchScore(getText(item), query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}
