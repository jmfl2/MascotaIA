import { webCommand } from './web'

/** Búsqueda en Google. Es el comando por defecto (sin prefijo). */
export const google = webCommand({
  id: 'google',
  name: 'Google',
  prefixes: ['g'],
  hint: 'Buscar en la web',
  placeholder: 'Buscar en Google…',
  accent: '#3b82f6',
  iconPath: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13z M15.3 15.3L20 20',
  allowedHosts: ['www.google.com'],
  buildUrl(query) {
    const url = new URL('https://www.google.com/search')
    url.searchParams.set('q', query)
    return url
  }
})
