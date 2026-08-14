import { useEffect, useRef, useState, useCallback } from 'react'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from '../api/notifications'
import { getToken } from '../lib/auth'

// Powers the notification bell in Navbar.jsx — loads the signed-in user's
// existing notifications on mount, then keeps them live via the shared
// notification:new socket channel. Not authenticated? Just returns an
// empty, non-loading state (no bell content, no errors).
export default function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    fetchNotifications(token)
      .then((rows) => {
        if (mounted.current) setNotifications(rows)
      })
      .catch(() => {
        // Silent — the bell just stays empty rather than erroring loudly.
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })

    const unsubscribe = subscribeToNotifications(token, (payload) => {
      if (!mounted.current) return
      setNotifications((prev) => [payload, ...prev])
    })

    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = useCallback((id) => {
    const token = getToken()
    if (!token) return
    setNotifications((prev) => prev.map((n) => (n.notification_id === id ? { ...n, read: true } : n)))
    markNotificationRead(id, token).catch(() => {})
  }, [])

  const markAllRead = useCallback(() => {
    const token = getToken()
    if (!token) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllNotificationsRead(token).catch(() => {})
  }, [])

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
