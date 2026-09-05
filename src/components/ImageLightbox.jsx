import { useEffect } from 'react'

// A simple full-screen enlarge-on-click viewer for a profile photo — used
// by both StudentProfile.jsx (own profile, with upload controls layered
// around it) and Profile.jsx (a professor's public profile, read-only).
// Closes on backdrop click, the close button, or Escape.
export default function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-10"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2 rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 transition-all"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-[22px]">close</span>
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
      />
    </div>
  )
}
