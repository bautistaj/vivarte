import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'

interface RegisterBody {
  email: string
  password: string
  name?: string
}

interface LoginBody {
  email: string
  password: string
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: RegisterBody }>('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, name } = request.body

    const existing = await fastify.prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ error: 'Este correo ya está registrado' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await fastify.prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    })

    const token = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '30d' })
    return reply.status(201).send({ token, user })
  })

  fastify.post<{ Body: LoginBody }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body

    const user = await fastify.prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.status(401).send({ error: 'Credenciales incorrectas' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Credenciales incorrectas' })
    }

    const token = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '30d' })
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    }
  })

  fastify.get('/me', {
    onRequest: [fastify.authenticate],
  }, async (request: FastifyRequest) => {
    const payload = request.user as { sub: string }
    const user = await fastify.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, createdAt: true },
    })
    return { user }
  })
}

export default authRoutes
