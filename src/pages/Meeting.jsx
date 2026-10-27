import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Background from '../components/Background'
import Navbar from '../components/Navbar'
import BottomNav from '../components/BottomNav'
import { getProfile, getToken } from '../lib/auth'
import { createMeetingInvite, joinMeeting, meetingSocketURL, revokeMeetingInvite } from '../api/meetings'

function VideoTile({ name, stream, local = false, camera = true, mic = true, host = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream || null
    if (stream) ref.current.play().catch(() => {})
    return () => { if (ref.current) ref.current.srcObject = null }
  }, [stream])
  return (
    <div className="relative min-h-52 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low">
      <video ref={ref} autoPlay playsInline muted={local} className={`h-full min-h-52 w-full object-cover ${camera ? '' : 'hidden'} `} />
      {!camera && <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant"><span className="text-4xl font-bold">{(name || 'P').slice(0, 1).toUpperCase()}</span></div>}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2 text-sm text-white">
        <span>{name}{local ? ' (you)' : ''}{host ? ' · Host' : ''}</span>
        <span>{mic ? 'Mic on' : 'Mic off'}</span>
      </div>
    </div>
  )
}

export default function Meeting() {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const [inviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '')
  const profile = getProfile()
  const profileName = profile?.name || ''
  const [name, setName] = useState(profileName)
  const [passcode, setPasscode] = useState('')
  const [phase, setPhase] = useState('ready')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [host, setHost] = useState(false)
  const [roomTitle, setRoomTitle] = useState('ProfConnect meeting')
  const [localStream, setLocalStream] = useState(null)
  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [invitePasscode, setInvitePasscode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const socketRef = useRef(null)
  const localRef = useRef(null)
  const screenRef = useRef(null)
  const peerConnections = useRef(new Map())
  const queuedMessages = useRef(Promise.resolve())
  const leavingRef = useRef(false)

  const send = useCallback((message) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }, [])

  const closeMedia = useCallback(() => {
    for (const { pc } of peerConnections.current.values()) pc.close()
    peerConnections.current.clear()
    localRef.current?.getTracks().forEach(track => track.stop())
    screenRef.current?.getTracks().forEach(track => track.stop())
    localRef.current = null
    screenRef.current = null
    setLocalStream(null)
    setParticipants([])
    setSharing(false)
  }, [])

  const leave = useCallback((goBack = true) => {
    leavingRef.current = true
    const socket = socketRef.current
    socketRef.current = null
    socket?.close()
    closeMedia()
    setPhase('ended')
    if (goBack) navigate('/appointments')
  }, [closeMedia, navigate])

  const addPeer = useCallback((person, initiator, iceServers) => {
    if (peerConnections.current.has(person.id)) return peerConnections.current.get(person.id)
    const pc = new RTCPeerConnection({ iceServers })
    const stream = localRef.current
    stream?.getTracks().forEach(track => pc.addTrack(track, stream))
    const remoteStream = new MediaStream()
    const peer = { pc, stream: remoteStream, queue: [] }
    peerConnections.current.set(person.id, peer)
    setParticipants(previous => previous.some(p => p.id === person.id)
      ? previous
      : [...previous, { ...person, stream: remoteStream, camera: person.camera ?? true, mic: person.mic ?? true }])
    pc.onicecandidate = event => {
      if (event.candidate) send({ type: 'ice', to: person.id, candidate: event.candidate.toJSON() })
    }
    pc.ontrack = event => {
      if (!remoteStream.getTracks().some(track => track.id === event.track.id)) remoteStream.addTrack(event.track)
      setParticipants(previous => previous.map(p => p.id === person.id ? { ...p, stream: new MediaStream(remoteStream.getTracks()) } : p))
    }
    pc.onconnectionstatechange = () => {
      setParticipants(previous => previous.map(p => p.id === person.id ? { ...p, connection: pc.connectionState } : p))
    }
    if (initiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => send({ type: 'offer', to: person.id, sdp: pc.localDescription.sdp }))
        .catch(() => setNotice('Could not negotiate media with a participant.'))
    }
    return peer
  }, [send])

  const handleSignal = useCallback(async (message, iceServers) => {
    if (message.type === 'welcome') {
      setPhase('connected')
      setNotice('')
      for (const person of message.participants || []) addPeer(person, true, iceServers)
      send({ type: 'state', mic: micOn, camera: cameraOn, sharing: false, hand: false })
    } else if (message.type === 'joined') {
      addPeer(message.participant, false, iceServers)
    } else if (['offer', 'answer', 'ice'].includes(message.type)) {
      const peer = peerConnections.current.get(message.from)
      if (!peer) return
      if (message.type === 'ice') {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(message.candidate)
        else peer.queue.push(message.candidate)
      } else {
        await peer.pc.setRemoteDescription({ type: message.type, sdp: message.sdp })
        for (const candidate of peer.queue.splice(0)) await peer.pc.addIceCandidate(candidate)
        if (message.type === 'offer') {
          await peer.pc.setLocalDescription(await peer.pc.createAnswer())
          send({ type: 'answer', to: message.from, sdp: peer.pc.localDescription.sdp })
        }
      }
    } else if (message.type === 'state') {
      setParticipants(previous => previous.map(p => p.id === message.from ? { ...p, ...message.state } : p))
    } else if (message.type === 'left') {
      const peer = peerConnections.current.get(message.id)
      peer?.pc.close()
      peerConnections.current.delete(message.id)
      setParticipants(previous => previous.filter(p => p.id !== message.id))
    } else if (message.type === 'chat') {
      setMessages(previous => [...previous.slice(-99), message])
    } else if (message.type === 'locked') {
      setNotice(message.locked ? 'The host has locked the meeting.' : 'The host has unlocked the meeting.')
    } else if (message.type === 'ended') {
      setNotice('The host ended this meeting.')
      leave(false)
    } else if (message.type === 'error') {
      setError(message.detail || message.message || 'The meeting connection reported an error.')
    }
  }, [addPeer, cameraOn, leave, micOn, send])

  const join = async (event) => {
    event.preventDefault()
    if (phase === 'joining' || phase === 'connected') return
    setError('')
    setNotice('')
    setPhase('joining')
    leavingRef.current = false
    let stream
    try {
      const ticket = await joinMeeting(meetingId, { name: name.trim() || 'Guest', passcode, inviteToken })
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      localRef.current = stream
      setLocalStream(stream)
      setHost(Boolean(ticket.host))
      setRoomTitle(ticket.title || 'ProfConnect meeting')
      const socket = new WebSocket(meetingSocketURL(meetingId))
      socketRef.current = socket
      socket.onopen = () => socket.send(JSON.stringify({ token: ticket.token }))
      socket.onmessage = event => {
        queuedMessages.current = queuedMessages.current
          .then(() => handleSignal(JSON.parse(event.data), ticket.iceServers || []))
          .catch(() => setError('A signalling message could not be processed. Please leave and rejoin.'))
      }
      socket.onerror = () => setError('Could not connect to the meeting server. Check your connection and try again.')
      socket.onclose = () => {
        if (!leavingRef.current) {
          setPhase(current => ['connected', 'joining'].includes(current) ? 'disconnected' : current)
          setNotice('Connection closed. Leave and rejoin to reconnect.')
        }
      }
    } catch (err) {
      stream?.getTracks().forEach(track => track.stop())
      localRef.current = null
      setLocalStream(null)
      setPhase('ready')
      setError(err.message || 'Could not join the meeting. Check camera/microphone permissions and try again.')
    }
  }

  const toggleMic = () => {
    const next = !micOn
    localRef.current?.getAudioTracks().forEach(track => { track.enabled = next })
    setMicOn(next)
    send({ type: 'state', mic: next, camera: cameraOn, sharing, hand: false })
  }
  const toggleCamera = () => {
    const next = !cameraOn
    localRef.current?.getVideoTracks().forEach(track => { track.enabled = next })
    setCameraOn(next)
    send({ type: 'state', mic: micOn, camera: next, sharing, hand: false })
  }
  const toggleScreenShare = async () => {
    try {
      if (!sharing) {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenRef.current = display
        const track = display.getVideoTracks()[0]
        for (const peer of peerConnections.current.values()) {
          const sender = peer.pc.getSenders().find(item => item.track?.kind === 'video')
          if (sender) await sender.replaceTrack(track)
        }
        track.onended = () => stopScreenShare()
        setSharing(true)
        send({ type: 'state', mic: micOn, camera: cameraOn, sharing: true, hand: false })
      } else {
        await stopScreenShare()
      }
    } catch (err) {
      setError(err.message || 'Screen sharing was not started.')
    }
  }
  const stopScreenShare = async () => {
    screenRef.current?.getTracks().forEach(track => track.stop())
    screenRef.current = null
    for (const peer of peerConnections.current.values()) {
      const sender = peer.pc.getSenders().find(item => item.track?.kind === 'video')
      const cameraTrack = localRef.current?.getVideoTracks()[0]
      if (sender) await sender.replaceTrack(cameraTrack || null)
    }
    setSharing(false)
    send({ type: 'state', mic: micOn, camera: cameraOn, sharing: false, hand: false })
  }

  const sendChat = (event) => {
    event.preventDefault()
    const text = chatText.trim()
    if (!text) return
    send({ type: 'chat', text })
    setChatText('')
  }

  const makeInvite = async () => {
    try {
      setError('')
      const result = await createMeetingInvite(meetingId, invitePasscode)
      const link = new URL(`/meeting/${encodeURIComponent(meetingId)}`, window.location.origin)
      link.searchParams.set('invite', result.invite_token)
      setInviteLink(link.href)
      await navigator.clipboard?.writeText(link.href)
      setNotice('Invitation link created and copied.')
    } catch (err) {
      setError(err.message || 'Could not create an invitation link.')
    }
  }

  const revokeInvite = async () => {
    try {
      await revokeMeetingInvite(meetingId)
      setInviteLink('')
      setNotice('Invitation link revoked.')
    } catch (err) {
      setError(err.message || 'Could not revoke the invitation.')
    }
  }

  useEffect(() => {
    // Keep the bearer-like invite token out of the address bar/referrer after capturing it.
    if (inviteToken) {
      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete('invite')
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [inviteToken])

  useEffect(() => () => {
    leavingRef.current = true
    socketRef.current?.close()
    closeMedia()
  }, [closeMedia])

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 pb-28 lg:pb-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ProfConnect · Meeting</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{roomTitle}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">Appointment-linked video room · up to four participants</p>
          </div>
          <button className="rounded-xl border border-outline-variant/30 px-4 py-2 text-sm" onClick={() => navigate('/appointments')}>Back to appointments</button>
        </div>

        {phase !== 'connected' ? (
          <form onSubmit={join} className="mx-auto max-w-xl rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6">
            <h2 className="text-xl font-bold">{phase === 'joining' ? 'Connecting…' : phase === 'disconnected' ? 'Connection lost' : 'Join this meeting'}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">Appointment participants must be signed in. Guests need a valid invitation link.</p>
            {!getToken() && <label className="mt-5 block text-sm font-medium">Your name<input className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-3" value={name} onChange={e => setName(e.target.value)} maxLength={60} required /></label>}
            {inviteToken && <label className="mt-4 block text-sm font-medium">Invitation passcode (if required)<input className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-3" value={passcode} onChange={e => setPasscode(e.target.value)} maxLength={64} type="password" /></label>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}
            <button disabled={phase === 'joining'} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-bold text-white disabled:opacity-50">{phase === 'joining' ? 'Joining…' : 'Join meeting'}</button>
            {!getToken() && !inviteToken && <p className="mt-3 text-xs text-on-surface-variant">Use the invitation URL provided by the meeting host.</p>}
          </form>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <div className="grid gap-3 sm:grid-cols-2">
                <VideoTile name={profileName || name || 'You'} stream={localStream} local camera={cameraOn} mic={micOn} host={host} />
                {participants.map(person => <VideoTile key={person.id} name={person.name} stream={person.stream} camera={person.camera !== false} mic={person.mic !== false} host={person.host} />)}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                <button onClick={toggleMic} className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold">{micOn ? 'Mute microphone' : 'Unmute microphone'}</button>
                <button onClick={toggleCamera} className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold">{cameraOn ? 'Turn camera off' : 'Turn camera on'}</button>
                <button onClick={toggleScreenShare} className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold">{sharing ? 'Stop sharing' : 'Share screen'}</button>
                {host && <button onClick={() => send({ type: 'end' })} className="rounded-xl bg-error px-4 py-3 text-sm font-bold text-white">End meeting</button>}
                {!host && <button onClick={() => leave()} className="rounded-xl bg-error px-4 py-3 text-sm font-bold text-white">Leave meeting</button>}
              </div>
              {notice && <p className="mt-3 text-sm text-on-surface-variant">{notice}</p>}
              {error && <p role="alert" className="mt-3 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}
              {host && <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                <h2 className="font-bold">Invite a guest</h2>
                <p className="mt-1 text-sm text-on-surface-variant">The link grants guest access to this meeting. You can revoke it at any time.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input aria-label="Optional invitation passcode" placeholder="Optional passcode" type="password" maxLength={64} value={invitePasscode} onChange={e => setInvitePasscode(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-outline-variant/30 bg-surface px-3 py-2" />
                  <button onClick={makeInvite} className="rounded-xl bg-primary px-4 py-2 font-bold text-white">Create link</button>
                  <button onClick={revokeInvite} className="rounded-xl border border-error/40 px-4 py-2 text-error">Revoke link</button>
                </div>
                {inviteLink && <div className="mt-3 break-all rounded-xl bg-surface p-3 text-sm">{inviteLink}</div>}
              </div>}
            </section>
            <aside className="flex min-h-80 flex-col rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
              <h2 className="font-bold">Meeting chat</h2>
              <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
                {messages.length === 0 && <p className="text-sm text-on-surface-variant">Messages sent during this meeting appear here.</p>}
                {messages.map((message, index) => <div key={message.created_at || index} className="rounded-xl bg-surface p-3">
                  <p className="text-xs font-bold">{message.name || 'Participant'}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.text}</p>
                </div>)}
              </div>
              <form onSubmit={sendChat} className="mt-4 flex gap-2">
                <input value={chatText} onChange={e => setChatText(e.target.value)} maxLength={2000} placeholder="Write a message…" className="min-w-0 flex-1 rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm" />
                <button className="rounded-xl bg-primary px-3 py-2 font-bold text-white" aria-label="Send message">Send</button>
              </form>
            </aside>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
