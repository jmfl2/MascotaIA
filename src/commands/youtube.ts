import { webCommand } from './web'

/** Búsqueda de vídeos en YouTube: "yt receta de tortilla". */
export const youtube = webCommand({
  id: 'youtube',
  name: 'YouTube',
  prefixes: ['yt'],
  hint: 'Buscar vídeos',
  placeholder: 'Buscar en YouTube…',
  accent: '#ef4444',
  iconPath: 'M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M10.5 9.5l4 2.5l-4 2.5z',
  allowedHosts: ['www.youtube.com'],
  buildUrl(query) {
    const url = new URL('https://www.youtube.com/results')
    url.searchParams.set('search_query', query)
    return url
  }
})
