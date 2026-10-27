# CodebaseCopilot

A niche developer tool for understanding and searching Java codebases using natural language — built with Spring Boot, Spring AI, pgvector, and React.

---

## Quick Start with Docker (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Linux container mode)
- [Ollama](https://ollama.com/) installed and running on your machine (Windows service on port 11434)
- Git

### 1. Pull Ollama models (one-time)

```powershell
ollama pull qwen3.5:4b
ollama pull nomic-embed-text
```

> **Note:** `qwen3.5:4b` requires ~4 GB RAM for inference. On a CPU-only machine (e.g., i5/16 GB), cold-start takes ~60-340 s; warm repeated queries take ~10-25 s.

### 2. Configure environment

```powershell
Copy-Item .env.example .env
# Open .env and set COPILOT_DB_PASSWORD to a strong password
notepad .env
```

### 3. Start all services

```powershell
docker compose up -d
docker compose ps      # verify all containers are healthy
```

This starts:
| Container | Port | Purpose |
|---|---|---|
| `codebase-copilot-db` | `127.0.0.1:5433` | PostgreSQL 16 + pgvector |
| `codebase-copilot-backend` | `127.0.0.1:8080` | Spring Boot API |
| `codebase-copilot-frontend` | `127.0.0.1:3000` | React UI (Nginx) |

### 4. Open the app

Navigate to **http://localhost:3000** in your browser.

### 5. Import a Java repository

Click **[+ Import repository]** and provide the absolute path to a Java project on your machine (e.g. `D:\src\my-java-app`). Indexing runs in the background; status updates appear in the UI.

---

## Stopping and Starting

```powershell
# Pause containers — volumes and data are preserved
docker compose stop

# Resume
docker compose start

# Remove containers but keep data volumes
docker compose down

# ⚠️  NEVER run this — it deletes the database permanently
# docker compose down -v
```

---

## Environment Variables

All configuration is via `.env` in the project root (gitignored). See [`.env.example`](.env.example) for all variables.

| Variable | Default | Description |
|---|---|---|
| `COPILOT_DB_HOST` | `127.0.0.1` | PostgreSQL host (local dev only; Docker uses `db`) |
| `COPILOT_DB_PORT` | `5433` | PostgreSQL port |
| `COPILOT_DB_NAME` | `copilot_db` | Database name |
| `COPILOT_DB_USER` | `copilot_user` | Database user |
| `COPILOT_DB_PASSWORD` | *(required)* | Database password |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_CHAT_MODEL` | `qwen3.5:4b` | Chat model |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model (768-dim) |
| `OLLAMA_CHAT_KEEP_ALIVE` | `10m` | Keep model in RAM after last call |
| `OLLAMA_CHAT_READ_TIMEOUT` | `420s` | HTTP read timeout for chat |
| `BACKEND_EXTERNAL_PORT` | `8080` | Host port for backend (optional override) |
| `FRONTEND_EXTERNAL_PORT` | `3000` | Host port for frontend (optional override) |

---

## Local Development (without Docker for backend/frontend)

Prerequisites: Java 21, Maven, Node.js 20+, Docker Desktop (for the DB container).

```powershell
# 1. Start the database
docker compose up -d db

# 2. Build and test backend
mvn clean verify

# 3. Start backend
mvn spring-boot:run

# 4. Start frontend dev server (separate terminal)
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. The Vite dev server proxies `/api` to `http://127.0.0.1:8080`.

---

## API Reference

### Import a repository

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/repositories/import `
  -ContentType 'application/json' `
  -Body '{"path":"D:\\src\\my-java-app","name":"my-java-app"}'
```

Response includes `id` (UUID), `status` (`COMPLETED`, `COMPLETED_EMPTY`, `FAILED`), and counts.

### Semantic search

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/search `
  -ContentType 'application/json' `
  -Body '{"query":"Where is the order total calculated?","repositoryId":"<uuid>","limit":5}'
```

### RAG chat

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/chat `
  -ContentType 'application/json' `
  -Body '{"question":"How does authentication work?","repositoryId":"<uuid>","chunks":[...]}'
```

### Health check

```powershell
Invoke-RestMethod http://localhost:8080/api/health
```

---

## Tests

```powershell
# Backend unit + integration tests (H2 in-memory, no external services required)
mvn clean verify

# Backend real-pipeline integration test (requires live PostgreSQL + Ollama)
mvn "-Dtest=RealPipelineIntegrationTest" -DrealIntegration=true test

# Frontend unit tests
cd frontend
npx vitest run --pool=forks

# Frontend production build
npm run build
```

---

## Docker Build Only

```powershell
docker compose build          # build all images
docker compose build backend  # rebuild only the backend image
```

---

## Database Backup

```powershell
docker compose exec db pg_dump -U copilot_user copilot_db > backups\backup_$(Get-Date -Format yyyyMMdd_HHmmss).dump
```

---

## Architecture

```
Browser (React/Vite)
      │  HTTP /api/*
      ▼
  Nginx (frontend container, port 3000)
      │  proxy_pass http://backend:8080/api/
      ▼
  Spring Boot (backend container, port 8080)
      │                        │
      ▼                        ▼
  PostgreSQL + pgvector    Ollama (host machine, port 11434)
  (db container, port 5432) accessed via host.docker.internal
```

- **Parsing:** Java AST via JDK compiler API → methods, classes, line ranges
- **Embedding:** `nomic-embed-text` (768-dim) via Ollama
- **Search:** cosine distance via pgvector with a 0.52 minimum score floor
- **Ranking:** `QueryAwareSearchRanker` boosts implementation code over declarations
- **Chat:** Spring AI `RagChatService` with grounded citation validation

---

## Placement Demo Notes

To run a live demo without a public server:

1. Start everything with `docker compose up -d`
2. Verify `http://localhost:3000` loads and `/api/health` returns `UP`
3. Import a prepared Java repository before the demo (indexing takes ~10-60 s depending on size)
4. Keep the model warm: run one test chat query beforehand
5. For a remote demo over a video call, share your screen — no deployment needed
6. Optional: expose via ngrok: `ngrok http 3000` (ngrok account required)
