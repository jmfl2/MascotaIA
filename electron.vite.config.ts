import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

// electron-vite compila tres "mundos": proceso principal, preload y renderer.
// El main y el preload se detectan solos (src/main/index.ts y src/preload/index.ts).
// El renderer tiene tres páginas: el robot, la barra de comandos y el bocadillo.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rolldownOptions: {
        input: {
          robot: resolve(__dirname, 'src/renderer/robot.html'),
          bar: resolve(__dirname, 'src/renderer/bar.html'),
          bubble: resolve(__dirname, 'src/renderer/bubble.html')
        }
      }
    }
  }
})
