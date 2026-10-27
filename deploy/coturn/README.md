# Self-hosted STUN/TURN for meetings

ProfConnect meetings are peer-to-peer WebRTC: audio and video go directly
between the two browsers, and the backend only relays signalling. Two browsers
behind different routers (campus Wi-Fi, mobile data) usually cannot connect
without help, which is the job of **STUN** (discover your public address) and
**TURN** (relay the media when a direct path is impossible).

The meeting backend does **not** use any public STUN/TURN service. Run your own
coturn server, which provides both on port 3478.

## 1. Run coturn on a Linux VPS

Needs a public IPv4 address and these ports open in the cloud and host
firewalls: **UDP+TCP 3478** and **UDP 49160-49200** (the relay range).

```bash
cd deploy/coturn
export MEETING_TURN_SECRET="$(openssl rand -hex 32)"   # keep this value
export TURN_REALM=turn.example.com                      # your TURN hostname
export TURN_EXTERNAL_IP=203.0.113.10                    # the VPS public IPv4
docker compose up -d
```

## 2. Point the backend at it

Set these on the **backend** (Render environment) and redeploy:

```dotenv
MEETING_STUN_URLS=stun:turn.example.com:3478
MEETING_TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
MEETING_TURN_SECRET=<the same secret as above>
```

The backend hands each participant a temporary credential derived from the
secret when they join; the secret itself never reaches the browser.

## 3. Check it

Join a meeting from two different networks (for example, one device on mobile
data). In Chrome open `chrome://webrtc-internals` and confirm the selected
candidate pair is `relay` when a direct path is blocked.

## Limits worth knowing

- UDP/TCP 3478 does not get through every locked-down network; TURN over TLS
  on 443 would need a certificate and extra setup, which this profile omits.
- Without any STUN/TURN configured, calls only connect when both people can
  reach each other directly (the same network, or the same computer).
