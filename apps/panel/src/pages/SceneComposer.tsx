import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getArtwork, getElements, createElement, updateElement, deleteElement,
  Artwork, SceneElement,
} from '../api/client'

const CANVAS_W = 800

const COLORS: Record<string, string> = {
  video:   '#6c63ff',
  image:   '#27ae60',
  model3d: '#e67e22',
}

const ICONS: Record<string, string> = {
  video:   '▶',
  image:   '◼',
  model3d: '◆',
}

// ── Preview HTML generator ────────────────────────────────────────────────
function buildPreviewHtml(aw: Artwork, elems: SceneElement[]): string {
  function abs(url: string) {
    try { return new URL(url, location.href).href } catch { return url }
  }
  const ar = (aw.imageHeight / aw.imageWidth).toFixed(6)
  const sorted = [...elems].sort((a, b) => a.order - b.order)

  const assetTags = [
    `<img id="bg" src="${abs(aw.imageUrl)}" crossorigin="anonymous" />`,
    ...sorted
      .filter(e => e.type !== 'model3d')
      .map(e => e.type === 'video'
        ? `<video id="el-${e.id}" src="${abs(e.fileUrl)}" autoplay muted loop playsinline crossorigin="anonymous"></video>`
        : `<img id="el-${e.id}" src="${abs(e.fileUrl)}" crossorigin="anonymous" />`
      ),
  ].join('\n      ')

  const entityTags = sorted.map(e => {
    const p = `${e.posX} ${e.posY} ${e.posZ}`
    const r = `${e.rotX} ${e.rotY} ${e.rotZ}`
    const s = `${e.scaleX} ${e.scaleY} ${e.scaleZ}`
    if (e.type === 'video')
      return `<a-plane src="#el-${e.id}" position="${p}" rotation="${r}" scale="${s}" width="${e.width}" height="${e.height}"></a-plane>`
    if (e.type === 'image')
      return `<a-plane src="#el-${e.id}" position="${p}" rotation="${r}" scale="${s}" width="${e.width}" height="${e.height}"></a-plane>`
    return `<a-gltf-model src="${abs(e.fileUrl)}" position="${p}" rotation="${r}" scale="${s}"></a-gltf-model>`
  }).join('\n    ')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://aframe.io/releases/1.5.0/aframe.min.js"><\/script>
  <style>* { margin: 0; } html, body { width: 100%; height: 100%; overflow: hidden; background: #111; }</style>
</head>
<body>
  <a-scene vr-mode-ui="enabled: false" renderer="colorManagement: true; physicallyCorrectLights: true">
    <a-assets>
      ${assetTags}
    </a-assets>
    <a-sky color="#1a1a1a"></a-sky>
    <a-light type="ambient" intensity="2"></a-light>
    <a-light type="directional" position="1 2 3" intensity="1"></a-light>
    <a-plane src="#bg" position="0 0 0" width="1" height="${ar}"></a-plane>
    ${entityTags}
    <a-camera position="0 0 2" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
  </a-scene>
</body>
</html>`
}

export default function SceneComposer() {
  const { id } = useParams<{ id: string }>()

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [elements, setElements] = useState<SceneElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [bgLoaded, setBgLoaded] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgRef = useRef<HTMLImageElement | null>(null)
  const elemRef = useRef(elements)
  const dragRef = useRef<{
    id: string; x0: number; y0: number; mx: number; my: number
  } | null>(null)

  useEffect(() => { elemRef.current = elements }, [elements])

  useEffect(() => {
    if (!id) return
    getArtwork(id).then(({ artwork }) => {
      setArtwork(artwork)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { bgRef.current = img; setBgLoaded(true) }
      img.src = artwork.imageUrl
    })
    getElements(id).then(({ elements }) => setElements(elements))
  }, [id])

  // Redraw canvas when elements, selection, or background change
  useEffect(() => {
    const canvas = canvasRef.current
    const bg = bgRef.current
    if (!canvas || !bg || !bgLoaded) return

    const raf = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')!
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(bg, 0, 0, W, H)

      const sorted = [...elements].sort((a, b) => a.order - b.order)
      for (const el of sorted) {
        const cx = el.posX * W + W / 2
        const cy = -el.posY * W + H / 2
        const rw = el.width * W
        const rh = el.height * W
        const color = COLORS[el.type] || '#999'
        const isSel = el.id === selectedId

        ctx.save()
        ctx.fillStyle = color + '30'
        ctx.fillRect(cx - rw / 2, cy - rh / 2, rw, rh)
        ctx.strokeStyle = color
        ctx.lineWidth = isSel ? 2.5 : 1
        ctx.setLineDash(isSel ? [] : [5, 3])
        ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh)
        ctx.setLineDash([])
        ctx.fillStyle = color
        ctx.font = 'bold 11px system-ui'
        const lbl = (el.label || el.type).slice(0, 20)
        ctx.fillText(lbl, cx - rw / 2 + 4, cy - rh / 2 + 14)
        ctx.restore()
      }
    })

    return () => cancelAnimationFrame(raf)
  }, [elements, selectedId, bgLoaded])

  // ── Coordinate helpers ───────────────────────────────────────────────────

  function canvasXY(clientX: number, clientY: number) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return {
      x: (clientX - r.left) * c.width / r.width,
      y: (clientY - r.top) * c.height / r.height,
    }
  }

  function hitTest(cx: number, cy: number): SceneElement | null {
    const c = canvasRef.current!
    const W = c.width, H = c.height
    // Check topmost (highest order) first
    for (const el of [...elemRef.current].sort((a, b) => b.order - a.order)) {
      const ex = el.posX * W + W / 2
      const ey = -el.posY * W + H / 2
      const rw = el.width * W
      const rh = el.height * W
      if (cx >= ex - rw / 2 && cx <= ex + rw / 2 && cy >= ey - rh / 2 && cy <= ey + rh / 2) return el
    }
    return null
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  function startDrag(clientX: number, clientY: number) {
    const { x, y } = canvasXY(clientX, clientY)
    const el = hitTest(x, y)
    if (!el) { setSelectedId(null); return }
    setSelectedId(el.id)
    dragRef.current = { id: el.id, x0: el.posX, y0: el.posY, mx: clientX, my: clientY }
  }

  function moveDrag(clientX: number, clientY: number) {
    const d = dragRef.current
    if (!d || !canvasRef.current) return
    const rw = canvasRef.current.getBoundingClientRect().width
    const dx = (clientX - d.mx) / rw
    const dy = -(clientY - d.my) / rw
    setElements(prev => prev.map(e =>
      e.id === d.id ? { ...e, posX: d.x0 + dx, posY: d.y0 + dy } : e
    ))
  }

  async function endDrag() {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !id) return
    const el = elemRef.current.find(e => e.id === d.id)
    if (!el) return
    try {
      const { element } = await updateElement(id, d.id, { posX: el.posX, posY: el.posY })
      setElements(prev => prev.map(e => e.id === element.id ? element : e))
    } catch { /* drag PATCH failures are silent — position stays local */ }
  }

  // ── Element CRUD ─────────────────────────────────────────────────────────

  function addElement(type: 'video' | 'image' | 'model3d') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = type === 'video' ? 'video/mp4'
      : type === 'image' ? 'image/jpeg,image/png,image/webp'
      : '.glb,model/gltf-binary,application/octet-stream'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || !id) return
      setUploading(type)
      setError('')
      try {
        const fd = new FormData()
        fd.append('type', type)
        fd.append('label', file.name.replace(/\.[^.]+$/, ''))
        fd.append('file', file)
        const { element } = await createElement(id, fd)
        setElements(prev => [...prev, element])
        setSelectedId(element.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al subir archivo')
      } finally {
        setUploading(null)
      }
    }
    input.click()
  }

  async function removeElement(elemId: string) {
    if (!id) return
    try {
      await deleteElement(id, elemId)
      setElements(prev => prev.filter(e => e.id !== elemId))
      if (selectedId === elemId) setSelectedId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  async function reorder(elemId: string, dir: -1 | 1) {
    if (!id) return
    const sorted = [...elements].sort((a, b) => a.order - b.order)
    const i = sorted.findIndex(e => e.id === elemId)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    const newOrders: Record<string, number> = {}
    sorted.forEach((el, idx) => { newOrders[el.id] = idx })
    await Promise.all(
      sorted
        .filter((el, idx) => el.order !== idx)
        .map(el => updateElement(id!, el.id, { order: newOrders[el.id] }))
    )
    setElements(prev => prev.map(e => ({ ...e, order: newOrders[e.id] ?? e.order })))
  }

  async function patchProp(key: string, value: number | string) {
    if (!selectedId || !id) return
    try {
      const { element } = await updateElement(id, selectedId, { [key]: value })
      setElements(prev => prev.map(e => e.id === element.id ? element : e))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  // ── Preview ──────────────────────────────────────────────────────────────

  function openPreview() {
    if (!artwork) return
    const html = buildPreviewHtml(artwork, elements)
    const blob = new Blob([html], { type: 'text/html' })
    setPreviewUrl(URL.createObjectURL(blob))
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const selected = elements.find(e => e.id === selectedId) ?? null
  const sorted = [...elements].sort((a, b) => a.order - b.order)
  const cH = artwork ? Math.round(CANVAS_W * artwork.imageHeight / artwork.imageWidth) : 450

  return (
    <div className="compositor">
      <header className="compositor-header">
        <Link to="/" className="compositor-back">← Obras</Link>
        <h1 className="compositor-title">{artwork?.title ?? '…'}</h1>
        <button
          className="btn btn-sm"
          onClick={openPreview}
          disabled={!artwork || elements.length === 0}
        >
          Preview AR
        </button>
      </header>

      {error && <div className="compositor-error">{error}</div>}

      <div className="compositor-body">

        {/* ── Left sidebar ── */}
        <aside className="compositor-sidebar">
          <div className="comp-add-btns">
            <button className="btn btn-sm" disabled={!!uploading} onClick={() => addElement('video')}>
              {uploading === 'video' ? '↑ Subiendo…' : '+ Video'}
            </button>
            <button className="btn btn-sm" disabled={!!uploading} onClick={() => addElement('image')}>
              {uploading === 'image' ? '↑ Subiendo…' : '+ Imagen'}
            </button>
            <button className="btn btn-sm" disabled={!!uploading} onClick={() => addElement('model3d')}>
              {uploading === 'model3d' ? '↑ Subiendo…' : '+ 3D'}
            </button>
          </div>

          <p className="comp-section">Elementos ({sorted.length})</p>
          {sorted.length === 0 && (
            <p className="compositor-empty">Agrega elementos con los botones de arriba.</p>
          )}

          <ul className="element-list">
            {sorted.map((el, i) => (
              <li
                key={el.id}
                className={`element-item${selectedId === el.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(el.id)}
              >
                <span className="el-icon" style={{ color: COLORS[el.type] }}>{ICONS[el.type]}</span>
                <span className="el-label">{el.label || el.type}</span>
                <div className="el-actions">
                  <button className="btn-icon" title="Subir en orden"
                    disabled={i === 0}
                    onClick={e => { e.stopPropagation(); reorder(el.id, -1) }}>↑</button>
                  <button className="btn-icon" title="Bajar en orden"
                    disabled={i === sorted.length - 1}
                    onClick={e => { e.stopPropagation(); reorder(el.id, 1) }}>↓</button>
                  <button className="btn-icon btn-icon-del" title="Eliminar"
                    onClick={e => { e.stopPropagation(); removeElement(el.id) }}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Canvas ── */}
        <main className="compositor-canvas-area">
          {!bgLoaded && <p className="loading">Cargando imagen…</p>}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={cH}
            className="compositor-canvas"
            style={{ display: bgLoaded ? 'block' : 'none' }}
            onMouseDown={e => startDrag(e.clientX, e.clientY)}
            onMouseMove={e => moveDrag(e.clientX, e.clientY)}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY) }}
            onTouchEnd={endDrag}
          />
        </main>

        {/* ── Right props ── */}
        <aside className="compositor-props">
          {!selected
            ? <p className="compositor-empty">Selecciona un elemento en el canvas o en la lista para editar sus propiedades.</p>
            : (
              <div className="props-panel">
                <p className="comp-section">Propiedades</p>
                <Field label="Etiqueta" value={selected.label} type="text"
                  onCommit={v => patchProp('label', v)} />

                <p className="comp-section">Posición</p>
                <Field label="posX" value={selected.posX} type="number" step={0.01}
                  onCommit={v => patchProp('posX', Number(v))} />
                <Field label="posY" value={selected.posY} type="number" step={0.01}
                  onCommit={v => patchProp('posY', Number(v))} />
                <Field label="posZ" value={selected.posZ} type="number" step={0.01}
                  onCommit={v => patchProp('posZ', Number(v))} />

                <p className="comp-section">Rotación (°)</p>
                <Field label="rotX" value={selected.rotX} type="number" step={1}
                  onCommit={v => patchProp('rotX', Number(v))} />
                <Field label="rotY" value={selected.rotY} type="number" step={1}
                  onCommit={v => patchProp('rotY', Number(v))} />
                <Field label="rotZ" value={selected.rotZ} type="number" step={1}
                  onCommit={v => patchProp('rotZ', Number(v))} />

                <p className="comp-section">Escala</p>
                <Field label="scaleX" value={selected.scaleX} type="number" step={0.1}
                  onCommit={v => patchProp('scaleX', Number(v))} />
                <Field label="scaleY" value={selected.scaleY} type="number" step={0.1}
                  onCommit={v => patchProp('scaleY', Number(v))} />
                <Field label="scaleZ" value={selected.scaleZ} type="number" step={0.1}
                  onCommit={v => patchProp('scaleZ', Number(v))} />

                <p className="comp-section">Tamaño (unidades AR)</p>
                <Field label="width" value={selected.width} type="number" step={0.05}
                  onCommit={v => patchProp('width', Number(v))} />
                <Field label="height" value={selected.height} type="number" step={0.05}
                  onCommit={v => patchProp('height', Number(v))} />
              </div>
            )
          }
        </aside>

      </div>

      {/* ── Preview modal ── */}
      {previewUrl && (
        <div className="preview-modal">
          <button className="preview-close" onClick={closePreview}>✕ Cerrar</button>
          <iframe
            src={previewUrl}
            className="preview-iframe"
            title="Preview AR"
          />
        </div>
      )}

    </div>
  )
}

// ── Prop field ─────────────────────────────────────────────────────────────
function Field({
  label, value, type, step, onCommit,
}: {
  label: string; value: string | number; type: 'text' | 'number'
  step?: number; onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <div className="prop-field">
      <label>{label}</label>
      <input
        type={type}
        step={type === 'number' ? step : undefined}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={e => e.key === 'Enter' && onCommit(draft)}
      />
    </div>
  )
}
