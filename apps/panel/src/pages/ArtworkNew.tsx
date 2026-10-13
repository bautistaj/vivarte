import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createArtwork } from '../api/client'

// ── MindAR compiler (import dinámico — Vite lo separa en su propio chunk)
interface MindARCompiler {
  compileImageTargets(imgs: HTMLImageElement[], onProgress: (p: number) => void): Promise<void>
  exportData(): Promise<ArrayBuffer>
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = reject
    img.src = url
  })
}

async function compileMindAR(imageFile: File, onProgress: (p: number) => void): Promise<Blob> {
  // Carga el módulo solo cuando se necesita (lazy chunk)
  const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js') as { Compiler: new () => MindARCompiler }
  const compiler = new Compiler()
  const img = await loadImage(imageFile)
  await compiler.compileImageTargets([img], onProgress)
  const buffer = await compiler.exportData()
  return new Blob([buffer], { type: 'application/octet-stream' })
}

type Step = 'idle' | 'compiling' | 'uploading'

export default function ArtworkNew() {
  const [title, setTitle] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const busy = step !== 'idle'

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!imageFile || !videoFile || !title) return
    setError('')

    try {
      // Dimensiones reales de la imagen (necesarias para el visor AR)
      const img = await loadImage(imageFile)
      const { naturalWidth: imageWidth, naturalHeight: imageHeight } = img

      setStep('compiling')
      setProgress(0)
      const mindBlob = await compileMindAR(imageFile, p => setProgress(Math.round(p * 100)))

      setStep('uploading')
      const fd = new FormData()
      fd.append('title', title)
      fd.append('imageWidth', String(imageWidth))
      fd.append('imageHeight', String(imageHeight))
      fd.append('image', imageFile)
      fd.append('video', videoFile)
      fd.append('mind', mindBlob, 'target.mind')

      await createArtwork(fd)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setStep('idle')
    }
  }

  return (
    <div className="page">
      <h1>Nueva obra</h1>
      <form className="artwork-form" onSubmit={submit}>
        {error && <p className="error">{error}</p>}

        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required disabled={busy} placeholder="Nombre de la obra" />
        </div>

        <div className="field">
          <label htmlFor="image">Foto de la obra <span className="muted">(jpg · png · webp, máx 10 MB)</span></label>
          <input id="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} required disabled={busy} />
          {preview && <img src={preview} alt="preview" className="image-preview" />}
        </div>

        <div className="field">
          <label htmlFor="video">Animación / video <span className="muted">(mp4, máx 50 MB)</span></label>
          <input id="video" type="file" accept="video/mp4" onChange={e => setVideoFile(e.target.files?.[0] ?? null)} required disabled={busy} />
        </div>

        {step === 'compiling' && (
          <div className="progress-wrap">
            <p className="muted">Compilando imagen para AR… {progress}%</p>
            <progress value={progress} max={100} />
          </div>
        )}
        {step === 'uploading' && <p className="muted">Subiendo archivos al servidor…</p>}

        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy || !imageFile || !videoFile || !title}>
            {busy ? 'Procesando…' : 'Compilar y subir'}
          </button>
          <Link to="/"><button className="btn btn-ghost" type="button" disabled={busy}>Cancelar</button></Link>
        </div>
      </form>
    </div>
  )
}
