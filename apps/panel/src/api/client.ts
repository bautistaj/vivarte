// BASE_URL termina con '/' (ej. '/vivarte/' en prod, '/' en dev)
const API = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api'

function token() { return localStorage.getItem('token') }

function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const t = token()
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: authHeaders(init.headers),
  })
  if (res.status === 204) return undefined as unknown as T
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data as T
}

// ── Auth ────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  req<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), headers: { 'Content-Type': 'application/json' } })

export const register = (email: string, password: string, name: string) =>
  req<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }), headers: { 'Content-Type': 'application/json' } })

export const getMe = () => req<{ user: User }>('/auth/me')

// ── Artworks ────────────────────────────────────────────────────────────────
export const getArtworks = () => req<{ artworks: Artwork[] }>('/artworks')

export const getArtwork = (id: string) => req<{ artwork: Artwork }>(`/artworks/${id}`)

export async function createArtwork(formData: FormData): Promise<{ artwork: Artwork }> {
  const res = await fetch(API + '/artworks', {
    method: 'POST',
    headers: authHeaders(), // NO Content-Type: el browser pone el multipart boundary
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al crear obra')
  return data
}

export const deleteArtwork = (id: string) =>
  req<void>(`/artworks/${id}`, { method: 'DELETE' })

export async function downloadQr(id: string): Promise<Blob> {
  const res = await fetch(API + `/artworks/${id}/qr`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Error al generar QR')
  return res.blob()
}

// ── Elements ─────────────────────────────────────────────────────────────────
export const getElements = (artworkId: string) =>
  req<{ elements: SceneElement[] }>(`/artworks/${artworkId}/elements`)

export async function createElement(artworkId: string, formData: FormData): Promise<{ element: SceneElement }> {
  const res = await fetch(API + `/artworks/${artworkId}/elements`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al crear elemento')
  return data
}

export const updateElement = (artworkId: string, elemId: string, data: Partial<SceneElement>) =>
  req<{ element: SceneElement }>(`/artworks/${artworkId}/elements/${elemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const deleteElement = (artworkId: string, elemId: string) =>
  req<void>(`/artworks/${artworkId}/elements/${elemId}`, { method: 'DELETE' })

// ── Types ────────────────────────────────────────────────────────────────────
export interface User { id: string; email: string; name?: string; createdAt: string }
export interface AuthResponse { token: string; user: User }
export interface Artwork {
  id: string; slug: string; title: string
  imageKey: string; imageUrl: string; viewerUrl: string
  imageWidth: number; imageHeight: number
  scanCount: number; createdAt: string
}
export interface SceneElement {
  id: string; artworkId: string; type: string; fileKey: string; fileUrl: string
  label: string
  posX: number; posY: number; posZ: number
  rotX: number; rotY: number; rotZ: number
  scaleX: number; scaleY: number; scaleZ: number
  width: number; height: number; order: number; createdAt: string
}
