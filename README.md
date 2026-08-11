# ProfConnect

Frontend for bridging students and professors, including live "is my
professor in?" availability sourced from a Raspberry Pi unit mounted on
each professor's door.

- `src/` — the React/Vite frontend (this folder)
- `server/` — the cloud status API that bridges the frontend and the Pi units (see `server/README.md`)
- `pi-client/` — reference Python client that runs on each Raspberry Pi door unit

## Running everything locally

```bash
# 1. Status API (Python/FastAPI)
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && cp devices.example.json devices.json
python run.py

# 2. Frontend (separate terminal, from repo root)
npm install && cp .env.example .env && npm run dev
```

The Explore and Profile pages will show a "Live" badge once connected to
the status API and update professor availability dots in real time.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
