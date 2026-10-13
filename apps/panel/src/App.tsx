import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ArtworkNew from './pages/ArtworkNew'
import SceneComposer from './pages/SceneComposer'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/nueva" element={<ProtectedRoute><ArtworkNew /></ProtectedRoute>} />
          <Route path="/obras/:id/compositor" element={<ProtectedRoute><SceneComposer /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
