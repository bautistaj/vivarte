import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import fs from 'fs/promises'
import path from 'path'

interface Storage {
  save(key: string, buffer: Buffer): Promise<void>
  url(key: string): string
  delete(key: string): Promise<void>
}

declare module 'fastify' {
  interface FastifyInstance {
    storage: Storage
  }
}

const storagePlugin: FastifyPluginAsync = fp(async (fastify) => {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  await fs.mkdir(uploadDir, { recursive: true })

  fastify.decorate('storage', {
    async save(key: string, buffer: Buffer) {
      const dest = path.join(uploadDir, key)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.writeFile(dest, buffer)
    },
    url(key: string) {
      return `/files/${key}`
    },
    async delete(key: string) {
      await fs.unlink(path.join(uploadDir, key)).catch(() => {})
    },
  } satisfies Storage)
})

export default storagePlugin
