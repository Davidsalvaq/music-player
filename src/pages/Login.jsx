import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ParticleBackground from '../components/ParticleBackground'
import { useTheme } from '../context/ThemeContext'

export default function Login() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    if (mode === 'register') {
      if (!username || /\s/.test(username) || !/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Username inválido (solo letras, números y guiones bajos, sin espacios)')
        setLoading(false)
        return
      }

      const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
      if (existingUser) {
        setError('El username ya está en uso')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      
      if (data?.user) {
        await supabase.from('profiles').update({ username }).eq('id', data.user.id)
      }
      
      navigate('/')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      navigate('/')
    }

    setLoading(false)
  }

  return (
    <div data-theme={theme} className="app-shell">
      <ParticleBackground />

      <motion.footer
  style={{ position: 'fixed', bottom: '1.5rem', left: '2.2rem', zIndex: 10 }}
  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
  transition={{ duration: 0.6, delay: 0.5 }}>
  <p style={{ fontSize: '11px', fontWeight: 300, letterSpacing: '0.08em', color: 'var(--text-secondary)', opacity: 0.6 }}>
    @David Quijada
  </p>
</motion.footer>

      <motion.div
        className="login-container"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.86, 0, 0.07, 1], delay: 0.3 }}
      >
        <div className="login-mode-toggle">
          <button
            className={`theme-pill ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            LOGIN
          </button>
          <button
            className={`theme-pill ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            REGISTER
          </button>
        </div>

        <motion.h1
          className="login-title"
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {mode === 'login' ? 'Welcome back.' : 'Create account.'}
        </motion.h1>

        <div className="login-fields">
          <input
            className="login-input"
            type="email"
            placeholder="EMAIL"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {mode === 'register' && (
            <input
              className="login-input"
              type="text"
              placeholder="USERNAME"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          )}
          <input
            className="login-input"
            type="password"
            placeholder="PASSWORD"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && (
          <motion.p
            className="login-error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            {error}
          </motion.p>
        )}

        <button
          className="login-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '...' : mode === 'login' ? 'ENTER' : 'CREATE'}
        </button>
      </motion.div>
    </div>
  )
}