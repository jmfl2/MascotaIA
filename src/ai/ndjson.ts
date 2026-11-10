/**
 * Ollama responde en streaming con NDJSON: un objeto JSON por línea. Los trozos
 * que llegan por la red no respetan los saltos de línea, así que se acumulan
 * hasta tener líneas completas.
 */
export class NdjsonSplitter {
  private buffer = ''

  /** Añade un trozo de texto y devuelve los objetos de las líneas completas. */
  push(chunk: string): unknown[] {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    return lines.flatMap(parseLine)
  }

  /** Procesa lo que quede al terminar el stream. */
  flush(): unknown[] {
    const rest = this.buffer
    this.buffer = ''
    return parseLine(rest)
  }
}

function parseLine(line: string): unknown[] {
  const trimmed = line.trim()
  if (!trimmed) return []
  try {
    return [JSON.parse(trimmed)]
  } catch {
    return [] // línea corrupta: se ignora
  }
}
