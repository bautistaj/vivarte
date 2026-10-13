import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Login() {
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
      const { token, user } = await login(email, password)
      setAuth(token, user)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <h1>Vivarte</h1>
      <form className="auth-form" onSubmit={submit}>
        <h2>Iniciar sesión</h2>
        {error && <p className="error">{error}</p>}
        <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input type="password" placeholder="Contraseña (mín. 8 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        <p className="muted">¿No tienes cuenta? <Link to="/register">Regístrate</Link></p>
      </form>
    </div>
  )
}
