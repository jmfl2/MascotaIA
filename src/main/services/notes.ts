/** Notas rápidas guardadas en notes.json (la más reciente primero). */
import type { Note } from '../../commands'
import { arrayOf, isNum, isStr, newId, readJson, writeJson } from './jsonFile'

const FILE = 'notes.json'
const MAX_NOTES = 1000
const MAX_LENGTH = 2000

let notes: Note[] | null = null

function load(): Note[] {
  notes ??= readJson(
    FILE,
    (raw) =>
      arrayOf(raw, (n) =>
        isStr(n.id, 64) && isStr(n.text, MAX_LENGTH) && isNum(n.createdAt)
          ? { id: n.id, text: n.text, createdAt: n.createdAt }
          : null
      ),
    () => []
  )
  return notes
}

export const notesService = {
  all: (): Note[] => load(),
  add(text: string): Note {
    const note: Note = { id: newId(), text: text.slice(0, MAX_LENGTH), createdAt: Date.now() }
    notes = [note, ...load()].slice(0, MAX_NOTES)
    writeJson(FILE, notes)
    return note
  },
  remove(id: string): boolean {
    const before = load().length
    notes = load().filter((n) => n.id !== id)
    if (notes.length === before) return false
    writeJson(FILE, notes)
    return true
  }
}
