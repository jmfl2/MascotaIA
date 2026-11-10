import type { CommandModule } from './types'

/** Nombre de usuario u organización / repositorio válidos en GitHub. */
const REPO_PATTERN = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/

/**
 * GitHub: "gh electron/electron" abre el repositorio directamente;
 * cualquier otra cosa ("gh spring animation") busca repositorios.
 */
export const github: CommandModule = {
  id: 'github',
  name: 'GitHub',
  prefixes: ['gh'],
  hint: 'Repositorios y código',
  placeholder: 'usuario/repo o búsqueda…',
  accent: '#8b5cf6',
  iconPath: 'M8.5 8L4.5 12l4 4 M15.5 8l4 4l-4 4 M13.5 5.5l-3 13',
  allowedHosts: ['github.com'],
  buildUrl(query) {
    const repo = REPO_PATTERN.exec(query)
    if (repo && repo[2] !== '.' && repo[2] !== '..') {
      const owner = encodeURIComponent(repo[1])
      const name = encodeURIComponent(repo[2])
      return new URL(`https://github.com/${owner}/${name}`)
    }
    const url = new URL('https://github.com/search')
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'repositories')
    return url
  }
}
