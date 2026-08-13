import { useEffect, useRef, useState } from 'react'
import { fetchAllAvailability } from '../api/availability'
import { subscribeToStatusUpdates } from '../api/professorStatus'

// Returns live "available in room" data, keyed by real teacher_id — sourced
// from each professor's own Dashboard toggle (see api/availability.js) and
// pushed to every connected tab over the same status:update socket channel
// the legacy door-unit bridge (professorStatus.js) used. If the API is
// unreachable (e.g. local dev without the server running), statusMap stays
// empty and callers should fall back to their own default status.
export default function useLiveStatus() {
  const [statusMap, setStatusMap] = useState({})
  const [connected, setConnected] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    fetchAllAvailability()
      .then((map) => {
        if (!mounted.current) return
        setStatusMap((prev) => ({ ...map, ...prev }))
      })
      .catch(() => {
        // API not reachable — silently keep using each page's static fallback.
      })

    const unsubscribe = subscribeToStatusUpdates(
      (payload) => {
        if (!mounted.current) return
        setStatusMap((prev) => ({
          ...prev,
          [payload.id]: { status: payload.status, updatedAt: payload.updatedAt, note: payload.note },
        }))
      },
      { onConnectionChange: (v) => mounted.current && setConnected(v) }
    )

    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [])

  // Convenience getter: liveStatus(id, fallback)
  const liveStatus = (id, fallback) => statusMap[id]?.status ?? fallback

  return { statusMap, connected, liveStatus }
}
