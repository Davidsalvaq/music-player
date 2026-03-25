import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCover } from '../lib/covers'

function cleanTitle(title) {
  if (!title) return ''
  return title.replace(/\(MP3[^)]*\)/gi, '').replace(/_+/g, ' ').trim()
}

async function readTags(file) {
  try {
    const id3 = await import('id3js')
    
    // Fallback timeout in case file is virtual/cloud and hangs reader
    const parsePromise = id3.fromFile(file)
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout parsing ID3')), 3000))
    
    const tags = await Promise.race([parsePromise, timeoutPromise])
    
    let coverUrl = null
    if (tags?.images?.length > 0) {
      const img = tags.images[0]
      const blob = new Blob([img.data], { type: img.mime })
      coverUrl = URL.createObjectURL(blob)
    }
    return { title: tags?.title || '', artist: tags?.artist || '', coverUrl }
  } catch (err) {
    console.warn("Error leyendo metadatos:", err)
    return { title: '', artist: '', coverUrl: null }
  }
}

export default function Library() {
  const { user } = useAuth()

  // ── Upload state ─────────────────────────────────────────
  const [songs, setSongs] = useState([])          // pending uploads
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [success, setSuccess] = useState(false)

  // ── Library (DB) state ────────────────────────────────────
  const [library, setLibrary] = useState([])
  const [loadingLib, setLoadingLib] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // song id pending confirm

  // ── Edit modal state (shared for upload queue & library) ──
  const [editTarget, setEditTarget] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLibrary = useMemo(() => {
    if (!searchQuery.trim()) return library
    const q = searchQuery.toLowerCase()
    return library.filter(s =>
      s.title?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q)
    )
  }, [library, searchQuery])

  // ── Fetch library ─────────────────────────────────────────
  const fetchLibrary = async () => {
    setLoadingLib(true)
    const { data } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setLibrary(data || [])
    setLoadingLib(false)
  }

  useEffect(() => { fetchLibrary() }, [user.id])

  // ── Upload queue handlers ─────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }

  const handleFiles = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const filesList = e.dataTransfer ? e.dataTransfer.files : e.target.files
    if (!filesList || filesList.length === 0) return
    
    // JS-side validation instead of HTML 'accept' attribute (which breaks iOS)
    const validFiles = Array.from(filesList).filter(f => {
      const isAudio = f.type.startsWith('audio/') || f.type.startsWith('video/')
      const hasExt = f.name.match(/\.(mp3|wav|m4a|aac|ogg|flac|mpe?g)$/i)
      return isAudio || hasExt
    })
    
    if (validFiles.length === 0) {
      setUploadError('Formato no válido. Selecciona archivos de música.')
      return
    }

    const files = validFiles.slice(0, 10)
    setUploadError('')
    setSuccess(false)
    setProgress(0)
    const parsed = await Promise.all(files.map(async (file) => {
      const tags = await readTags(file)
      return { file, title: cleanTitle(tags.title || file.name.replace(/\.[^.]+$/, '')), artist: tags.artist || '', coverUrl: tags.coverUrl, status: 'pending' }
    }))
    setSongs(parsed)
  }

  const openQueueEdit = (i) => {
    setEditTarget({ source: 'queue', index: i })
    setEditTitle(songs[i].title)
    setEditArtist(songs[i].artist)
  }

  const handleUploadAll = async () => {
    if (songs.length === 0) return
    setUploading(true)
    setUploadError('')
    setSuccess(false)
    let uploaded = 0
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      setSongs(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'uploading' } : s))
      const fileExt = song.file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`
      const { error: storErr } = await supabase.storage.from('songs').upload(fileName, song.file)
      if (storErr) {
        console.error('Storage upload error:', storErr.message)
        setSongs(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s))
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('songs').getPublicUrl(fileName)

      // Upload cover art if exists
      let coverPublicUrl = null
      if (song.coverUrl) {
        try {
          const coverResp = await fetch(song.coverUrl)
          const coverBlob = await coverResp.blob()
          const coverExt = coverBlob.type.split('/')[1] || 'jpg'
          const coverPath = `${user.id}/${Date.now()}_${i}_cover.${coverExt}`
          const { error: covErr } = await supabase.storage.from('covers').upload(coverPath, coverBlob)
          if (!covErr) {
            const { data: { publicUrl: covUrl } } = supabase.storage.from('covers').getPublicUrl(coverPath)
            coverPublicUrl = covUrl
          }
        } catch { /* cover upload failed, continue without */ }
      }

      const { error: dbErr } = await supabase.from('songs').insert({
        user_id: user.id, title: song.title, artist: song.artist,
        file_url: publicUrl, cover_url: coverPublicUrl
      })
      if (dbErr) {
        console.error('DB insert error:', dbErr.message)
        setSongs(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s))
        continue
      }
      setSongs(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s))
      uploaded++
      setProgress(uploaded)
    }
    setUploading(false)
    setSuccess(true)
    fetchLibrary()
  }

  // ── Library handlers ─────────────────────────────────────
  const openLibraryEdit = (song) => {
    setEditTarget({ source: 'library', song })
    setEditTitle(song.title)
    setEditArtist(song.artist || '')
  }

  const confirmEdit = async () => {
    if (!editTarget) return
    if (editTarget.source === 'queue') {
      setSongs(prev => prev.map((s, i) => i === editTarget.index ? { ...s, title: editTitle, artist: editArtist } : s))
    } else {
      const { error } = await supabase.from('songs')
        .update({ title: editTitle, artist: editArtist })
        .eq('id', editTarget.song.id)
      if (!error) {
        setLibrary(prev => prev.map(s => s.id === editTarget.song.id ? { ...s, title: editTitle, artist: editArtist } : s))
      }
    }
    setEditTarget(null)
  }

  const deleteSong = async (song) => {
    // Remove from DB
    await supabase.from('songs').delete().eq('id', song.id)
    // Remove from storage — derive path from file_path if stored, else from URL
    const path = song.file_path || song.file_url?.split('/storage/v1/object/public/songs/')[1]
    if (path) await supabase.storage.from('songs').remove([path])
    setLibrary(prev => prev.filter(s => s.id !== song.id))
    setDeleteConfirm(null)
  }

  const editSource = editTarget?.source
  const editingSong = editSource === 'library' ? editTarget?.song : songs[editTarget?.index]

  return (
    <>
      {/* ── Modal Portal ─────────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {editTarget !== null && (
            <>
              <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditTarget(null)} />
              <motion.div className="edit-modal" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.2 }}>
                {editingSong?.coverUrl && <img src={editingSong.coverUrl} className="modal-cover" alt="" />}
                <p className="modal-label">EDITANDO</p>
                <input className="login-input" type="text" placeholder="TÍTULO" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <input className="login-input" type="text" placeholder="ARTISTA" value={editArtist} onChange={e => setEditArtist(e.target.value)} />
                <div className="modal-actions">
                  <button className="login-btn" onClick={confirmEdit}>ACEPTAR</button>
                  <button className="login-btn" style={{ opacity: 0.4 }} onClick={() => setEditTarget(null)}>CANCELAR</button>
                </div>
              </motion.div>
            </>
          )}
          {deleteConfirm !== null && (
            <>
              <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm(null)} />
              <motion.div className="edit-modal" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.2 }}>
                <p className="modal-label">ELIMINAR CANCIÓN</p>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.9rem', opacity: 0.7 }}>¿Estás seguro? Esta acción no se puede deshacer.</p>
                <div className="modal-actions">
                  <button className="login-btn" style={{ opacity: 0.9 }} onClick={() => deleteSong(deleteConfirm)}>ELIMINAR</button>
                  <button className="login-btn" style={{ opacity: 0.4 }} onClick={() => setDeleteConfirm(null)}>CANCELAR</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Main Layout ──────────────────────────────────── */}
      <div className="library-shell">

        {/* UPLOAD SECTION */}
        <motion.div
          className="library-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="library-section-title">SUBIR MÚSICA</p>

          <div
            className="upload-container"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleFiles}
            style={{
              border: isDragging ? '2px dashed var(--text-primary)' : '2px dashed transparent',
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: isDragging ? 'rgba(255,255,255,0.03)' : 'transparent',
              transition: 'all 0.3s ease'
            }}
          >
            {songs.length === 0 ? (
              <label className="file-label-big" style={{ opacity: 0.8, cursor: 'pointer', position: 'relative' }}>
                <input type="file" className="hidden-file-input" multiple onChange={handleFiles} />
                {isDragging ? 'SUELTA AQUÍ' : '+ SELECCIONAR ARCHIVOS'}
              </label>
            ) : (
              <>
                <div className="songs-list">
                  {songs.map((song, i) => (
                    <motion.div
                      key={i}
                      className={`song-item ${song.status}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => song.status === 'pending' && openQueueEdit(i)}
                    >
                      <div className="song-item-header">
                        {song.coverUrl
                          ? <img src={song.coverUrl} className="song-thumb" alt="" />
                          : <div className="song-thumb-placeholder">♪</div>
                        }
                        <div className="song-item-info">
                          <span className="song-item-title">{cleanTitle(song.title) || 'Sin título'}</span>
                          <span className="song-item-artist">{song.artist || 'Artista desconocido'}</span>
                        </div>
                        <span className="song-item-status">
                          {song.status === 'done' && '✓'}
                          {song.status === 'uploading' && '···'}
                          {song.status === 'error' && '✗'}
                          {song.status === 'pending' && '✎'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {uploading && <p className="upload-progress">{progress} / {songs.length} subidas</p>}
                {uploadError && <p className="login-error">{uploadError}</p>}
                {success && (
                  <motion.p className="upload-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    ¡{progress} canción{progress > 1 ? 'es' : ''} subida{progress > 1 ? 's' : ''} exitosamente!
                  </motion.p>
                )}

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
                  <button className="login-btn" onClick={handleUploadAll} disabled={uploading}>
                    {uploading ? 'SUBIENDO...' : 'SUBIR TODAS'}
                  </button>
                  <button className="login-btn" style={{ opacity: 0.4, fontSize: '1rem' }} onClick={() => { setSongs([]); setSuccess(false) }} disabled={uploading}>
                    LIMPIAR
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* LIBRARY SECTION */}
        <motion.div
          className="library-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <p className="library-section-title">
            TU BIBLIOTECA — {library.length} CANCIONES
          </p>

          {!loadingLib && library.length > 0 && (
            <input
              className="lib-search-input"
              type="text"
              placeholder="BUSCAR POR TÍTULO O ARTISTA"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          )}

          {loadingLib ? (
            <p className="player-empty">Cargando...</p>
          ) : library.length === 0 ? (
            <p className="player-empty">Aún no has subido canciones.</p>
          ) : filteredLibrary.length === 0 ? (
            <p className="player-empty">Sin resultados para "{searchQuery}".</p>
          ) : (
            <div className="library-song-list">
              {filteredLibrary.map((song, i) => (
                <motion.div
                  key={song.id}
                  className="library-song-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <img
                    src={getCover(song)}
                    className="song-thumb cover-img"
                    alt=""
                    style={{ width: '40px', height: '40px', flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <div className="song-item-info">
                    <span className="song-item-title">{cleanTitle(song.title)}</span>
                    <span className="song-item-artist">{song.artist || 'Artista desconocido'}</span>
                  </div>
                  <div className="library-song-actions">
                    <button className="lib-action-btn" title="Editar" onClick={() => openLibraryEdit(song)}>✎</button>
                    <button className="lib-action-btn lib-delete-btn" title="Eliminar" onClick={() => setDeleteConfirm(song)}>✕</button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </>
  )
}