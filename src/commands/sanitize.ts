/** Longitud máxima de una consulta (después de limpiarla). */
export const MAX_QUERY_LENGTH = 500

/**
 * Limpia lo que escribe el usuario antes de meterlo en una URL:
 * - normaliza Unicode (NFC) para que "é" compuesta y descompuesta sean iguales;
 * - elimina caracteres de control (\p{Cc}) y de formato invisibles (\p{Cf}),
 *   como los de ancho cero o los que invierten la dirección del texto,
 *   que se usan para camuflar contenido;
 * - colapsa espacios y recorta a MAX_QUERY_LENGTH.
 *
 * La codificación para la URL NO se hace aquí: la hace `URLSearchParams`
 * o `encodeURIComponent` en cada comando.
 */
export function sanitizeQuery(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim()
}
