import { FastifyPluginAsync } from 'fastify'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const viewerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const artwork = await fastify.prisma.artwork.findUnique({
      where: { slug },
      select: { id: true, title: true, videoKey: true, mindKey: true, imageWidth: true, imageHeight: true },
    })
    if (!artwork) return reply.status(404).send('<h1>Obra no encontrada</h1>')

    const base = process.env.PUBLIC_BASE_URL || ''
    const videoUrl = `${base}/files/${artwork.videoKey}`
    const mindUrl  = `${base}/files/${artwork.mindKey}`
    const ratio    = artwork.imageWidth > 0 ? (artwork.imageHeight / artwork.imageWidth).toFixed(6) : '1'

    // Increment scan count without blocking the response
    fastify.prisma.artwork.update({
      where: { id: artwork.id },
      data: { scanCount: { increment: 1 } },
    }).catch(() => {})

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
    <div class="icon">📷</div>
    <h2>${escapeHtml(artwork.title)}</h2>
    <p>Apunta la cámara a la obra para ver la animación</p>
  </div>

  <a-scene
    mindar-image="imageTargetSrc: ${mindUrl}; autoStart: true; uiLoading: no; uiScanning: no; uiError: no;"
    color-space="sRGB"
    renderer="colorManagement: true; physicallyCorrectLights: true"
    vr-mode-ui="enabled: false"
    device-orientation-permission-ui="enabled: false"
  >
    <a-assets>
      <video id="ar-video" src="${videoUrl}" preload="auto" loop playsinline crossorigin="anonymous"></video>
    </a-assets>

    <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

    <a-entity mindar-image-target="targetIndex: 0">
      <a-plane src="#ar-video" position="0 0 0" width="1" height="${ratio}" rotation="0 0 0"></a-plane>
    </a-entity>
  </a-scene>

  <script>
    const overlay = document.getElementById('overlay')
    const video   = document.getElementById('ar-video')
    const target  = document.querySelector('[mindar-image-target]')

    target.addEventListener('targetFound', () => {
      overlay.classList.add('hidden')
      video.play().catch(() => {})
    })

    target.addEventListener('targetLost', () => {
      overlay.classList.remove('hidden')
      video.pause()
    })
  </script>
</body>
</html>`

    return reply.type('text/html').send(html)
  })
}

export default viewerRoutes
