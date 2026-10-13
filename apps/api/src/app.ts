import Fastify, { FastifyRequest, FastifyReply } from 'fastify'
import jwtPlugin from '@fastify/jwt'
import cors from '@fastify/cors'
import staticFiles from '@fastify/static'
import fs from 'fs'
import path from 'path'

import prismaPlugin from './plugins/prisma'
import storagePlugin from './plugins/storage'
import authRoutes from './routes/auth'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string }
    user: { sub: string; email: string }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

async function build() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  })

  await app.register(jwtPlugin, { secret: process.env.JWT_SECRET! })

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'No autorizado' })
    }
  })

  await app.register(prismaPlugin)
  await app.register(storagePlugin)

  // Serve uploaded files at /files/*
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  await app.register(staticFiles, {
    root: uploadDir,
    prefix: '/files/',
    decorateReply: false,
  })

  // Serve built panel (populated in Phase 2)
  const publicDir = path.join(__dirname, 'public')
  if (fs.existsSync(publicDir)) {
    await app.register(staticFiles, {
      root: publicDir,
      prefix: '/',
      decorateReply: false,
    })
  }

  await app.register(authRoutes, { prefix: '/api/auth' })

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}

async function main() {
  const app = await build()
  try {
    await app.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
