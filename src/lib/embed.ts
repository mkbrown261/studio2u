// Turns a SoundCloud/YouTube/Spotify link into an iframe embed src so engineers can
// showcase work without us hosting any audio/video files ourselves.

export interface EmbedInfo {
  iframeSrc: string
  height: number
}

export function getPortfolioEmbed(url: string): EmbedInfo | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')

  if (host === 'youtube.com' || host === 'youtu.be') {
    let videoId = ''
    if (host === 'youtu.be') {
      videoId = u.pathname.slice(1)
    } else if (u.pathname.startsWith('/embed/')) {
      videoId = u.pathname.split('/embed/')[1]
    } else if (u.pathname.startsWith('/shorts/')) {
      videoId = u.pathname.split('/shorts/')[1]
    } else {
      videoId = u.searchParams.get('v') || ''
    }
    videoId = videoId.split('?')[0].split('&')[0]
    if (!videoId) return null
    return { iframeSrc: `https://www.youtube.com/embed/${videoId}`, height: 220 }
  }

  if (host === 'open.spotify.com') {
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      const [type, id] = parts
      if (['track', 'album', 'playlist', 'episode', 'artist'].includes(type)) {
        return { iframeSrc: `https://open.spotify.com/embed/${type}/${id}`, height: type === 'track' ? 152 : 352 }
      }
    }
    return null
  }

  if (host === 'soundcloud.com') {
    return {
      iframeSrc: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23d9a448&auto_play=false&show_comments=false&visual=false`,
      height: 166
    }
  }

  return null
}
