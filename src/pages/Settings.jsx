import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const THEME_COLORS = { dark: '#0a0a0a', light: '#efefef', blue: '#4801ff' }
const THEME_LABELS = { dark: '◉ DARK', light: '◉ LIGHT', blue: '◉ BLUE' }

export default function Settings({ monospaced, setMonospaced }) {
  const { user, profile } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [playlists, setPlaylists] = useState([])
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [creating, setCreating] = useState(false)
  const [playlistError, setPlaylistError] = useState('')

  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username || '')
      setEditBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])
  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/login') }

  const fetchPlaylists = async () => {
    const { data } = await supabase.from('playlists').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    setPlaylists(data || [])
  }
  useEffect(() => { fetchPlaylists() }, [user.id])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Math.random()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    setProfileMessage('Subiendo imagen...')
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    if (uploadError) { setProfileMessage('Error: ' + uploadError.message); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
    setAvatarUrl(publicUrl)
    setProfileMessage('Imagen subida. ¡No olvides guardar!')
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    setProfileMessage('')
    
    if (!editUsername || /\s/.test(editUsername) || !/^[a-zA-Z0-9_]+$/.test(editUsername)) {
        setProfileMessage('Username inválido (solo letras, números y guiones bajos)')
        setSavingProfile(false)
        return
    }

    if (editUsername !== profile?.username) {
      const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', editUsername).maybeSingle()
      if (existingUser && existingUser.id !== user.id) {
        setProfileMessage('El username ya está en uso')
        setSavingProfile(false)
        return
      }
    }

    const updates = {
      username: editUsername,
      bio: editBio,
      avatar_url: avatarUrl,
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) { setProfileMessage('Error al guardar: ' + error.message) }
    else { setProfileMessage('Perfil guardado exitosamente. Recarga para ver cambios.') }
    
    setSavingProfile(false)
  }

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) { setPlaylistError('El nombre no puede estar vacío'); return }
    setPlaylistError('')
    setCreating(true)
    const { data } = await supabase.from('playlists').insert({ user_id: user.id, name: newPlaylistName.trim() }).select().single()
    if (data) setPlaylists(prev => [...prev, data])
    setNewPlaylistName('')
    setCreating(false)
  }
  const deletePlaylist = async (id) => {
    await supabase.from('playlists').delete().eq('id', id)
    setPlaylists(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="settings-shell">
      <motion.div
        className="settings-inner"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* ── Title ── */}
        <h1 className="settings-title">AJUSTES</h1>

        {/* ── Account card ── */}
        <div className="account-card">
          <div className="account-avatar" style={{ backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', color: profile?.avatar_url ? 'transparent' : 'inherit' }}>
            {!profile?.avatar_url && (profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U')}
          </div>
          <div className="account-info">
            <p className="account-name">{(profile?.username || user?.email?.split('@')[0] || '').toUpperCase()}</p>
            <p className="account-email">{user?.email}</p>
          </div>
        </div>

        {/* ── Logout button (standalone) ── */}
        <button className="settings-signout-btn" onClick={handleSignOut}>
          <span className="settings-signout-icon">→</span>
          CERRAR SESIÓN
        </button>

        <hr className="settings-divider" />

        {/* ── Tema ── */}
        <div className="settings-section">
          <p className="settings-label">TEMA VISUAL</p>
          <div className="theme-visual-row">
            {Object.entries(THEME_COLORS).map(([key, color]) => (
              <button
                key={key}
                className={`theme-visual-btn ${theme === key ? 'active' : ''}`}
                onClick={() => setTheme(key)}
                style={{ '--theme-color': color }}
              >
                <span className="theme-visual-dot" />
                {key.toUpperCase()}
              </button>
            ))}
            <button
              className={`theme-visual-btn ${monospaced ? 'active' : ''}`}
              onClick={() => setMonospaced(m => !m)}
              style={{ '--theme-color': 'var(--text-primary)' }}
            >
              <span className="theme-visual-dot" style={{ fontFamily: 'monospace', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Aa</span>
              MONO
            </button>
          </div>
        </div>

        <hr className="settings-divider" />

        {/* ── MI PERFIL ── */}
        <div className="settings-section">
          <p className="settings-label">MI PERFIL</p>
          <div className="profile-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div 
                   className="account-avatar" 
                   style={{ width: '60px', height: '60px', flexShrink: 0, cursor: 'pointer', backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', color: avatarUrl ? 'transparent' : 'inherit' }}
                   onClick={() => document.getElementById('avatar-upload').click()}
                >
                   {!avatarUrl && (editUsername?.[0]?.toUpperCase() || 'U')}
                </div>
                <input type="file" id="avatar-upload" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>CLICK EN EL CÍRCULO PARA CAMBIAR FOTO</span>
             </div>
             
             <input className="login-input" type="text" placeholder="USERNAME" value={editUsername} onChange={e => setEditUsername(e.target.value)} />
             <textarea 
               className="login-input" 
               placeholder="BIO" 
               maxLength={150} 
               value={editBio} 
               onChange={e => setEditBio(e.target.value)} 
               style={{ minHeight: '80px', resize: 'none', fontFamily: 'inherit' }}
             />
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <button className="settings-logout-btn" onClick={saveProfile} disabled={savingProfile}>
                 {savingProfile ? 'GUARDANDO...' : 'GUARDAR'}
               </button>
               {profileMessage && <span style={{ fontSize: '0.8rem', color: profileMessage.includes('Error') || profileMessage.includes('uso') || profileMessage.includes('inválido') ? 'rgb(255, 100, 100)' : 'var(--text-secondary)' }}>{profileMessage}</span>}
             </div>
          </div>
        </div>

        <hr className="settings-divider" />

        {/* ── Playlists ── */}
        <div className="settings-section">
          <p className="settings-label">MIS PLAYLISTS — {playlists.length}</p>
          <div className="playlist-create-row">
            <input
              className="login-input"
              type="text"
              placeholder="NOMBRE DE PLAYLIST"
              value={newPlaylistName}
              onChange={e => { setNewPlaylistName(e.target.value); setPlaylistError('') }}
              onKeyDown={e => e.key === 'Enter' && createPlaylist()}
            />
            <button
              className="settings-logout-btn"
              onClick={createPlaylist}
              disabled={creating}
              style={{ fontSize: '0.9rem', opacity: newPlaylistName.trim() ? 1 : 0.3, flexShrink: 0 }}
            >
              CREAR
            </button>
          </div>
          {playlistError && <p className="login-error">{playlistError}</p>}
          {playlists.length === 0 ? (
            <p className="settings-empty">Sin playlists todavía.</p>
          ) : (
            <div className="playlist-list">
              {playlists.map((pl, i) => (
                <motion.div
                  key={pl.id}
                  className="playlist-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <span className="playlist-item-name">
                    <span style={{ opacity: 0.4, marginRight: '0.5rem', fontFamily: 'monospace' }}>▶</span>
                    {pl.name}
                  </span>
                  <button className="lib-action-btn lib-delete-btn" onClick={() => deletePlaylist(pl.id)}>✕</button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}