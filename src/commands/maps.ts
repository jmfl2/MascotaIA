import { webCommand } from './web'

/** Lugares y direcciones en Google Maps: "maps cafetería cerca". */
export const maps = webCommand({
  id: 'maps',
  name: 'Google Maps',
  prefixes: ['maps', 'map'],
  hint: 'Buscar lugares y rutas',
  placeholder: 'Buscar un lugar…',
  accent: '#22c55e',
  iconPath: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z M12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5z',
  allowedHosts: ['www.google.com'],
  buildUrl(query) {
    // API de URLs oficial de Maps: https://developers.google.com/maps/documentation/urls
    const url = new URL('https://www.google.com/maps/search/')
    url.searchParams.set('api', '1')
    url.searchParams.set('query', query)
    return url
  }
})
