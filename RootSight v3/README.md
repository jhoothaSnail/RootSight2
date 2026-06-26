# RootSight

AI-powered Incident Intelligence and Organizational Dependency Intelligence platform.

RootSight ingests organizational documents (architecture docs, service catalogs,
incident history), builds a dependency graph in Neo4j, simulates incidents, and
uses Gemini to correlate symptoms to a root cause, surface structural risks, and
generate remediation runbooks.

## Project structure

```
.
├── frontend/            React + Vite + TypeScript UI
│   ├── index.html
│   └── src/
│       ├── api/         API client (live calls + automatic mock fallback)
│       ├── components/  Screens (Home, Dashboard, Architecture, Runbooks, OrgIntelligence, ...)
│       ├── data/        Offline scenario fixtures
│       └── ...
├── backend/             Express API + ingestion pipeline
│   ├── server.js        REST API (upload, graph, simulate, analyze, org-intelligence, runbooks)
│   ├── scenarios.js     Incident scenario library
│   ├── loadGraph.js     Load backend/graph.json into Neo4j
│   ├── testGemini.js    Gemini connectivity check (writes backend/graph.json)
│   ├── testNeo4j.js     Neo4j connectivity check
│   └── graph.json       Sample graph used by loadGraph.js
├── shared/
│   └── mocks/           API contract fixtures (used by both frontend and backend)
├── vite.config.ts       Vite config (root -> frontend, /api proxy -> :3001)
├── tsconfig.json
└── package.json
```

## Prerequisites

- Node.js (v20+)
- A `.env` file at the project root. Copy `.env.example` to `.env` and fill in:

```
GEMINI_API_KEY=...
NEO4J_URI=...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...
```

The app is designed to degrade gracefully: if Neo4j or Gemini are unreachable,
the backend serves curated mock data and the frontend falls back to local mocks,
so the UI always works.

## Demo mode (guaranteed-stable, no backend needed)

Every screen has a built-in fallback layer, so you can demo RootSight even with
no API server, no Neo4j, and no Gemini key:

- Backend fallback: each endpoint in `backend/server.js` catches Neo4j/Gemini
  failures and serves the curated fixtures from `shared/mocks/`.
- Frontend fallback: `frontend/src/api/client.ts` retries every call against the
  live backend first, then transparently falls back to the local mocks if the
  server is unreachable.

To force the frontend into fully-offline demo mode (never call the backend at
all), set `VITE_USE_MOCKS=true` in `.env` before running `npm run dev`.

## Run locally

1. Install dependencies:
   ```
   npm install
   ```
2. Run the frontend and backend together:
   ```
   npm run dev:all
   ```
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

   Or run them separately with `npm run dev` (frontend) and `npm run server` (API).

## Other scripts

- `npm run build` — production build of the frontend to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — TypeScript type check (`tsc --noEmit`)
- `npm run load:graph` — load `backend/graph.json` into Neo4j
- `npm run test:neo4j` / `npm run test:gemini` — connectivity checks
