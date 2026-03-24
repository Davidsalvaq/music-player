// Portadas placeholder para canciones sin cover_url
// Selección determinista por song.id — siempre la misma portada para la misma canción

export const COVERS = [
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=400',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=400',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400',
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=400',
  'https://images.unsplash.com/photo-1518080064506-6f81e19d7da9?q=80&w=400',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=400',
  'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=400',
  'https://images.unsplash.com/photo-1507608616769-52e691bbdb77?q=80&w=400',
  'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=400',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=400',
  'https://images.unsplash.com/photo-1500462918059-b1d0cb94ceac?q=80&w=400',
  'https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=400',
  'https://images.unsplash.com/photo-1536881773038-0ed0efbb44f3?q=80&w=400',
  'https://images.unsplash.com/photo-1532156821868-b7eb4ce415b4?q=80&w=400',
  'https://images.unsplash.com/photo-1540324155274-0f1c322b64dd?q=80&w=400',
  'https://images.unsplash.com/photo-1503925802536-c402b80065be?q=80&w=400',
  'https://images.unsplash.com/photo-1518882194910-c4fe7edfcdd0?q=80&w=400',
  'https://images.unsplash.com/photo-1490218153026-621aa9aeb4ba?q=80&w=400',
  'https://images.unsplash.com/photo-1492321936769-b49815aa6f20?q=80&w=400',
  'https://images.unsplash.com/photo-1509611394553-52467d328328?q=80&w=400'
]

/**
 * Devuelve siempre la misma portada placeholder para el mismo song.id
 * Usa los primeros 8 caracteres del UUID como número hexadecimal
 */
export function getCover(song) {
  if (song?.cover_url) return song.cover_url
  if (!song?.id) return COVERS[0]
  const hash = parseInt(song.id.replace(/-/g, '').substring(0, 8), 16)
  return COVERS[hash % COVERS.length]
}
