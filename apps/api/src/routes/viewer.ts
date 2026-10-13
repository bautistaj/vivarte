import { FastifyPluginAsync } from 'fastify'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pos(x: number, y: number, z: number) {
  return `${x} ${y} ${z}`
}

const viewerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const artwork = await fastify.prisma.artwork.findUnique({
      where: { slug },
      select: {
        id: true, title: true, mindKey: true, imageWidth: true, imageHeight: true,
        elements: { orderBy: { order: 'asc' } },
      },
    })
    if (!artwork) return reply.status(404).send('<h1>Obra no encontrada</h1>')

    const base = process.env.PUBLIC_BASE_URL || ''
    const mindUrl = `${base}/files/${artwork.mindKey}`

    fastify.prisma.artwork.update({
      where: { id: artwork.id },
      data: { scanCount: { increment: 1 } },
    }).catch(() => {})

    const elements = artwork.elements
    const hasContent = elements.length > 0

    // <a-assets> — solo video e imagen van aquí; model3d se referencia directo
    const assetTags = elements
      .filter(e => e.type === 'video' || e.type === 'image')
      .map(e => {
        const url = escapeHtml(`${base}/files/${e.fileKey}`)
        const id  = escapeHtml(e.id)
        if (e.type === 'video') {
          return `      <video id="${id}" src="${url}" preload="auto" loop playsinline crossorigin="anonymous"></video>`
        }
        return `      <img id="${id}" src="${url}" crossorigin="anonymous" />`
      })
      .join('\n')

    // entidades A-Frame por elemento
    const entityTags = elements.map(e => {
      const p = escapeHtml(pos(e.posX, e.posY, e.posZ))
      const r = escapeHtml(pos(e.rotX, e.rotY, e.rotZ))
      const s = escapeHtml(pos(e.scaleX, e.scaleY, e.scaleZ))
      const id = escapeHtml(e.id)

      if (e.type === 'video') {
        return `      <a-plane src="#${id}" position="${p}" rotation="${r}" scale="${s}" width="${e.width}" height="${e.height}"></a-plane>`
      }
      if (e.type === 'image') {
        return `      <a-plane src="#${id}" position="${p}" rotation="${r}" scale="${s}" width="${e.width}" height="${e.height}"></a-plane>`
      }
      // model3d
      const url = escapeHtml(`${base}/files/${e.fileKey}`)
      return `      <a-gltf-model src="${url}" position="${p}" rotation="${r}" scale="${s}"></a-gltf-model>`
    }).join('\n')

    // IDs de videos para play/pause en JS
    const videoIds = JSON.stringify(elements.filter(e => e.type === 'video').map(e => e.id))

    const overlayMsg = hasContent
      ? 'Apunta la cámara a la obra para ver la animación'
      : 'Esta obra no tiene contenido AR'

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(artwork.title)} — Vivarte AR</title>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; font-family: sans-serif; }
    #overlay {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,.75); color: #fff;
      z-index: 999; pointer-events: none;
      gap: .75rem; text-align: center; padding: 1rem;
    }
    #overlay.hidden { display: none; }
    #overlay .icon { font-size: 3rem; }
    #overlay h2 { font-size: 1.25rem; }
    #overlay p { font-size: .95rem; opacity: .75; }
  </style>
</head>
<body>
  <div id="overlay">
    <div class="icon">${hasContent ? '📷' : '🖼️'}</div>
    <h2>${escapeHtml(artwork.title)}</h2>
    <p>${overlayMsg}</p>
  </div>

  <a-scene
    mindar-image="imageTargetSrc: ${mindUrl}; autoStart: true; uiLoading: no; uiScanning: no; uiError: no;"
    color-space="sRGB"
    renderer="colorManagement: true; physicallyCorrectLights: true"
    vr-mode-ui="enabled: false"
    webxr="optionalFeatures: "
    device-orientation-permission-ui="enabled: false"
  >
    <a-assets>
${assetTags}
    </a-assets>

    <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

    <a-entity mindar-image-target="targetIndex: 0">
${entityTags}
    </a-entity>
  </a-scene>

  <script>
    const overlay   = document.getElementById('overlay')
    const target    = document.querySelector('[mindar-image-target]')
    const scene     = document.querySelector('a-scene')
    const videoIds  = ${videoIds}
    const hasContent = ${hasContent}

    scene.addEventListener('enter-vr', function() { this.exitVR() })

    if (hasContent) {
      target.addEventListener('targetFound', () => {
        overlay.classList.add('hidden')
        videoIds.forEach(id => {
          const el = document.getElementById(id)
          if (el) el.play().catch(() => {})
        })
      })

      target.addEventListener('targetLost', () => {
        overlay.classList.remove('hidden')
        videoIds.forEach(id => {
          const el = document.getElementById(id)
          if (el) el.pause()
        })
      })
    }
  </script>
</body>
</html>`

    return reply.type('text/html').send(html)
  })
}

export default viewerRoutes
