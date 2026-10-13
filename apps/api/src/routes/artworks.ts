import { FastifyPluginAsync } from 'fastify'
import { randomBytes, randomUUID } from 'crypto'
import slugify from 'slugify'

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_VIDEO = ['video/mp4']
const maxImage = () => parseInt(process.env.MAX_IMAGE_SIZE || '10485760')
const maxVideo = () => parseInt(process.env.MAX_VIDEO_SIZE || '52428800')

function makeSlug(title: string): string {
  const base = slugify(title, { lower: true, strict: true }) || 'obra'
  return `${base}-${randomBytes(3).toString('hex')}`
}

const artworkRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/artworks — lista obras del artista autenticado
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const { sub } = request.user
    const artworks = await fastify.prisma.artwork.findMany({
      where: { userId: sub },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, title: true,
        imageKey: true, imageWidth: true, imageHeight: true,
        scanCount: true, createdAt: true,
      },
    })
    const base = process.env.PUBLIC_BASE_URL || ''
    return {
      artworks: artworks.map(a => ({
        ...a,
        imageUrl: `${base}/files/${a.imageKey}`,
        viewerUrl: `${base}/a/${a.slug}`,
      })),
    }
  })

  // POST /api/artworks — crea obra con archivos
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user

    let title = ''
    let imageWidth = 0
    let imageHeight = 0
    let imageBuffer: Buffer | null = null
    let imageMime = ''
    let videoBuffer: Buffer | null = null
    let mindBuffer: Buffer | null = null

    for await (const part of request.parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'title') title = String(part.value)
        if (part.fieldname === 'imageWidth') imageWidth = parseInt(String(part.value))
        if (part.fieldname === 'imageHeight') imageHeight = parseInt(String(part.value))
        continue
      }
      // file parts
      if (part.fieldname === 'image') {
        if (!ALLOWED_IMAGE.includes(part.mimetype))
          return reply.status(400).send({ error: 'Formato de imagen no válido (jpg, png, webp)' })
        imageBuffer = await part.toBuffer()
        if (imageBuffer.length > maxImage())
          return reply.status(400).send({ error: `Imagen supera ${maxImage() / 1048576}MB` })
        imageMime = part.mimetype
      } else if (part.fieldname === 'video') {
        if (!ALLOWED_VIDEO.includes(part.mimetype))
          return reply.status(400).send({ error: 'Formato de video no válido (mp4)' })
        videoBuffer = await part.toBuffer()
        if (videoBuffer.length > maxVideo())
          return reply.status(400).send({ error: `Video supera ${maxVideo() / 1048576}MB` })
      } else if (part.fieldname === 'mind') {
        mindBuffer = await part.toBuffer()
      } else {
        await part.toBuffer() // drain unknown parts
      }
    }

    if (!title) return reply.status(400).send({ error: 'El título es requerido' })
    if (!imageBuffer) return reply.status(400).send({ error: 'La imagen es requerida' })
    if (!videoBuffer) return reply.status(400).send({ error: 'El video es requerido' })
    if (!mindBuffer) return reply.status(400).send({ error: 'El archivo .mind es requerido' })
    if (!imageWidth || !imageHeight) return reply.status(400).send({ error: 'Dimensiones de imagen requeridas' })

    const folder = randomUUID()
    const ext = imageMime.split('/')[1]
    const imageKey = `artworks/${folder}/image.${ext}`
    const videoKey = `artworks/${folder}/video.mp4`
    const mindKey  = `artworks/${folder}/target.mind`

    await Promise.all([
      fastify.storage.save(imageKey, imageBuffer),
      fastify.storage.save(videoKey, videoBuffer),
      fastify.storage.save(mindKey, mindBuffer),
    ])

    let artwork
    try {
      artwork = await fastify.prisma.artwork.create({
        data: { slug: makeSlug(title), title, userId: sub, imageKey, videoKey, mindKey, imageWidth, imageHeight },
        select: { id: true, slug: true, title: true, imageKey: true, imageWidth: true, imageHeight: true, scanCount: true, createdAt: true },
      })
    } catch (err) {
      await Promise.all([
        fastify.storage.delete(imageKey),
        fastify.storage.delete(videoKey),
        fastify.storage.delete(mindKey),
      ])
      throw err
    }

    const base = process.env.PUBLIC_BASE_URL || ''
    return reply.status(201).send({
      artwork: {
        ...artwork,
        imageUrl: `${base}/files/${artwork.imageKey}`,
        viewerUrl: `${base}/a/${artwork.slug}`,
      },
    })
  })

  // GET /api/artworks/:id
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const artwork = await fastify.prisma.artwork.findFirst({ where: { id, userId: request.user.sub } })
    if (!artwork) return reply.status(404).send({ error: 'Obra no encontrada' })
    const base = process.env.PUBLIC_BASE_URL || ''
    return { artwork: { ...artwork, imageUrl: `${base}/files/${artwork.imageKey}`, viewerUrl: `${base}/a/${artwork.slug}` } }
  })

  // DELETE /api/artworks/:id
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const artwork = await fastify.prisma.artwork.findFirst({ where: { id, userId: request.user.sub } })
    if (!artwork) return reply.status(404).send({ error: 'Obra no encontrada' })

    await Promise.all([
      fastify.storage.delete(artwork.imageKey),
      fastify.storage.delete(artwork.videoKey),
      fastify.storage.delete(artwork.mindKey),
    ])
    await fastify.prisma.artwork.delete({ where: { id } })
    return reply.status(204).send()
  })
}

export default artworkRoutes
