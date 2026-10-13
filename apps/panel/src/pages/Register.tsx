import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuth()
  const navigate = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await register(email, password, name)
      setAuth(token, user)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <h1>Vivarte</h1>
      <form className="auth-form" onSubmit={submit}>
        <h2>Crear cuenta</h2>
        {error && <p className="error">{error}</p>}
        <input type="text" placeholder="Nombre artístico" value={name} onChange={e => setName(e.target.value)} />
        <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input type="password" placeholder="Contraseña (mín. 8 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Creando cuenta…' : 'Crear cuenta'}</button>
        <p className="muted">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </form>
    </div>
  )
}
