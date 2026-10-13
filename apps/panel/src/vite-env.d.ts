/// <reference types="vite/client" />

declare module 'mind-ar/dist/mindar-image.prod.js' {
  export class Compiler {
    compileImageTargets(images: HTMLImageElement[], onProgress: (progress: number) => void): Promise<void>
    exportData(): Promise<ArrayBuffer>
  }
}
