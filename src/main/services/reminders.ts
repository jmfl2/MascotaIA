/**
 * Recordatorios guardados en reminders.json.
 *
 * En lugar de un setTimeout por recordatorio (se desajustan si el PC se
 * suspende y no admiten más de ~24 días), se revisa la lista cada pocos
 * segundos. Los que vencieron con la app cerrada avisan al arrancar.
 */
import type { Reminder } from '../../commands'
import { arrayOf, isNum, isStr, newId, readJson, writeJson } from './jsonFile'

const FILE = 'reminders.json'
const CHECK_EVERY_MS = 5_000
const MAX_REMINDERS = 200

let reminders: Reminder[] | null = null
let timer: NodeJS.Timeout | null = null
let onDue: (r: Reminder, lateMs: number) => void = () => {}

function load(): Reminder[] {
  reminders ??= readJson(
    FILE,
    (raw) =>
      arrayOf(raw, (r) =>
        isStr(r.id, 64) && isStr(r.text, 500) && isNum(r.dueAt) && isNum(r.createdAt)
          ? { id: r.id, text: r.text, dueAt: r.dueAt, createdAt: r.createdAt }
          : null
      ),
    () => []
  )
  return reminders
}

function save(): void {
  writeJson(FILE, load())
}

function check(): void {
  const now = Date.now()
  const due = load().filter((r) => r.dueAt <= now)
  if (!due.length) return
  reminders = load().filter((r) => r.dueAt > now)
  save()
  for (const r of due) onDue(r, now - r.dueAt)
}

export const remindersService = {
  all: (): Reminder[] => load(),
  add(text: string, dueAt: number): Reminder {
    const r: Reminder = { id: newId(), text: text.slice(0, 500), dueAt, createdAt: Date.now() }
    reminders = [...load(), r].slice(-MAX_REMINDERS)
    save()
    return r
  },
  remove(id: string): boolean {
    const before = load().length
    reminders = load().filter((r) => r.id !== id)
    if (reminders.length === before) return false
    save()
    return true
  },
  /** Empieza a vigilar; `cb` recibe cada recordatorio vencido y cuánto lleva de retraso. */
  start(cb: (r: Reminder, lateMs: number) => void): void {
    onDue = cb
    check()
    timer ??= setInterval(check, CHECK_EVERY_MS)
  },
  stop(): void {
    if (timer) clearInterval(timer)
    timer = null
  }
}
