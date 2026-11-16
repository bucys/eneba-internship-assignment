# Client (React SPA)

The browser app for the Eneba marketplace: Vite, React, TypeScript, Tailwind CSS, TanStack Query, React Router.

Setup, environment variables, architecture, and tradeoffs are in the [root README](../README.md).

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev            # http://localhost:5173
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

Conventions for contributors and agents: [AGENTS.md](AGENTS.md).
