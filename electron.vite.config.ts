import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

// electron-vite compila tres "mundos": proceso principal, preload y renderer.
// El main y el preload se detectan solos (src/main/index.ts y src/preload/index.ts).
// El renderer tiene dos páginas: el robot y la barra de comandos.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rolldownOptions: {
        input: {
          robot: resolve(__dirname, 'src/renderer/robot.html'),
          bar: resolve(__dirname, 'src/renderer/bar.html')
        }
      }
    }
  }
})
