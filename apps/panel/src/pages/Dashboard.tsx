import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getArtworks, deleteArtwork, Artwork } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    getArtworks()
      .then(({ artworks }) => setArtworks(artworks))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) return
    await deleteArtwork(id)
    setArtworks(prev => prev.filter(a => a.id !== id))
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Vivarte</h1>
        <div className="header-right">
          <span className="muted">{user?.name || user?.email}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main>
        <div className="toolbar">
          <h2>Mis obras</h2>
          <Link to="/nueva"><button className="btn">+ Nueva obra</button></Link>
        </div>

        {loading && <div className="loading">Cargando…</div>}

        {!loading && artworks.length === 0 && (
          <p className="muted">No tienes obras aún. <Link to="/nueva">Crea tu primera obra →</Link></p>
        )}

        <div className="artwork-grid">
          {artworks.map(a => (
            <div key={a.id} className="artwork-card">
              <img className="card-thumb" src={a.imageUrl} alt={a.title} loading="lazy" />
              <div className="card-body">
                <h3>{a.title}</h3>
                <p className="muted">{a.scanCount} escaneos · {new Date(a.createdAt).toLocaleDateString('es-MX')}</p>
                <div className="card-actions">
                  <a href={a.viewerUrl} target="_blank" rel="noreferrer">Ver visor</a>
                  <button className="btn btn-danger" onClick={() => handleDelete(a.id, a.title)}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
