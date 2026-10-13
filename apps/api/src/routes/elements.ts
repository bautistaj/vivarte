import { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = ['video', 'image', 'model3d'] as const
type ElementType = typeof ALLOWED_TYPES[number]

const ALLOWED_MIME: Record<ElementType, string[]> = {
  video: ['video/mp4'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
  model3d: ['model/gltf-binary', 'application/octet-stream'],
}

const MAX_SIZE: Record<ElementType, number> = {
  video: parseInt(process.env.MAX_VIDEO_SIZE || '52428800'),
  image: parseInt(process.env.MAX_IMAGE_SIZE || '10485760'),
  model3d: parseInt(process.env.MAX_MODEL_SIZE || '26214400'),
}

const FILE_EXT: Record<ElementType, string> = {
  video: 'mp4',
  image: 'bin',
  model3d: 'glb',
}

function mimeToExt(type: ElementType, mime: string): string {
  if (type === 'image') {
    const m = mime.split('/')[1]
    return m === 'jpeg' ? 'jpg' : m
  }
  return FILE_EXT[type]
}

const elementRoutes: FastifyPluginAsync = async (fastify) => {
  // Verifica que la obra exista y pertenezca al usuario autenticado
  async function getArtwork(artworkId: string, userId: string) {
    return fastify.prisma.artwork.findFirst({ where: { id: artworkId, userId } })
  }

  // GET /api/artworks/:id/elements
  fastify.get('/:id/elements', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const artwork = await getArtwork(id, request.user.sub)
    if (!artwork) return reply.status(404).send({ error: 'Obra no encontrada' })

    const elements = await fastify.prisma.sceneElement.findMany({
      where: { artworkId: id },
      orderBy: { order: 'asc' },
    })

    const base = process.env.PUBLIC_BASE_URL || ''
    return {
      elements: elements.map(e => ({ ...e, fileUrl: `${base}/files/${e.fileKey}` })),
    }
  })

  // POST /api/artworks/:id/elements
  fastify.post('/:id/elements', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const artwork = await getArtwork(id, request.user.sub)
    if (!artwork) return reply.status(404).send({ error: 'Obra no encontrada' })

    let elementType: ElementType | null = null
    let label = ''
    let fileBuffer: Buffer | null = null
    let fileMime = ''

    for await (const part of request.parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'type') {
          const v = String(part.value) as ElementType
          if (!ALLOWED_TYPES.includes(v))
            return reply.status(400).send({ error: `Tipo inválido. Usa: ${ALLOWED_TYPES.join(', ')}` })
          elementType = v
        }
        if (part.fieldname === 'label') label = String(part.value)
        continue
      }
      if (part.fieldname === 'file') {
        fileBuffer = await part.toBuffer()
        fileMime = part.mimetype
      } else {
        await part.toBuffer()
      }
    }

    if (!elementType) return reply.status(400).send({ error: 'El campo type es requerido' })
    if (!fileBuffer) return reply.status(400).send({ error: 'El archivo es requerido' })

    // Validar MIME — model3d acepta application/octet-stream por compatibilidad de navegadores
    if (!ALLOWED_MIME[elementType].includes(fileMime))
      return reply.status(400).send({ error: `MIME no válido para ${elementType}: ${fileMime}` })

    if (fileBuffer.length > MAX_SIZE[elementType])
      return reply.status(400).send({ error: `Archivo supera el límite de ${MAX_SIZE[elementType] / 1048576}MB` })

    const folder = randomUUID()
    const ext = mimeToExt(elementType, fileMime)
    const fileKey = `artworks/${artwork.id}/elements/${folder}/file.${ext}`

    await fastify.storage.save(fileKey, fileBuffer)

    let element
    try {
      element = await fastify.prisma.sceneElement.create({
        data: { artworkId: id, type: elementType, fileKey, label },
      })
    } catch (err) {
      await fastify.storage.delete(fileKey)
      throw err
    }

    const base = process.env.PUBLIC_BASE_URL || ''
    return reply.status(201).send({
      element: { ...element, fileUrl: `${base}/files/${element.fileKey}` },
    })
  })

  // PATCH /api/artworks/:id/elements/:eid
  fastify.patch('/:id/elements/:eid', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id, eid } = request.params as { id: string; eid: string }
    const artwork = await getArtwork(id, request.user.sub)
    if (!artwork) return reply.status(404).send({ error: 'Obra no encontrada' })

    const existing = await fastify.prisma.sceneElement.findFirst({ where: { id: eid, artworkId: id } })
    if (!existing) return reply.status(404).send({ error: 'Elemento no encontrado' })

    const body = request.body as Record<string, unknown>
    const allowed = ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scaleX', 'scaleY', 'scaleZ', 'width', 'height', 'label', 'order']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) data[key] = body[key]
    }

    const element = await fastify.prisma.sceneElement.update({ where: { id: eid }, data })
    const base = process.env.PUBLIC_BASE_URL || ''
    return { element: { ...element, fileUrl: `${base}/files/${element.fileKey}` } }
  })

  // DELETE /api/artworks/:id/elements/:eid
  fastify.delete('/:id/elements/:eid', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id, eid } = request.params as { id: string; eid: string }
    const artwork = await getArtwork(id, request.user.sub)
    if (!artwork) return reply.status(404).send({ error: 'Obra no encontrada' })

    const element = await fastify.prisma.sceneElement.findFirst({ where: { id: eid, artworkId: id } })
    if (!element) return reply.status(404).send({ error: 'Elemento no encontrado' })

    await fastify.storage.delete(element.fileKey)
    await fastify.prisma.sceneElement.delete({ where: { id: eid } })
    return reply.status(204).send()
  })
}

export default elementRoutes
