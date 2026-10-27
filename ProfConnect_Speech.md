# ProfConnect — 2-Minute Presentation Speech

On the frontend, we used React with Vite, styled with Tailwind. We chose this because it let us build a fast, component-based interface with instant reload during development, so we could iterate quickly on real user feedback rather than waiting on slow build times.

On the backend, we used FastAPI with Python, backed by a Supabase Postgres database. FastAPI gave us clean, typed, self-documenting APIs, and Supabase gave us a production-grade Postgres database along with file storage — for profile photos — without us having to manage our own servers.

Authentication is handled with JWTs and bcrypt-hashed passwords, so every request is stateless and verifiable, and passwords are never stored in plain text.

The core of the app is real bookings: a student can request an appointment with a professor, and the professor can accept or decline it, with the full history visible to both sides on an Appointments page.

To make the experience feel alive, we integrated Socket.IO alongside our REST API. This powers two things: a live "Available in Room" toggle for professors that updates instantly for every student browsing, and a real-time notification system — so the moment someone books a session, responds to one, or sends a message, the other person sees it immediately, without refreshing the page.

Messaging itself is fully persisted — every conversation between a student and a professor is saved and can be revisited anytime, and we made sure the app never hardcodes fake data like a made-up achievement or a fake conversation count — every number and detail you see reflects your real activity.

We also gave users real control over their own data: a working account deletion feature that removes your profile, your bookings, your messages, and your notifications — permanently.
