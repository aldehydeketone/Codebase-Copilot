<div align="center">

# 🔍 Codebase Copilot

**A developer workbench for understanding Java codebases using natural language.**  
Ask questions, get cited answers grounded in your actual source code.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-00C7B7?style=flat-square&logo=render&logoColor=white)](https://codebase-copilot-app.onrender.com/)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-00C7B7?style=flat-square&logo=render&logoColor=white)](https://codebase-copilot-api-r584.onrender.com/api/health)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.16-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Spring AI](https://img.shields.io/badge/Spring%20AI-1.1.8-6DB33F?style=flat-square&logo=spring&logoColor=white)](https://spring.io/projects/spring-ai)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+pgvector-336791?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-black?style=flat-square)](https://ollama.com/)
[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <strong>Chat — RAG Query Console</strong><br/>
      <img src="docs/screenshots/chat-view.png" alt="Chat view" width="480"/>
    </td>
    <td align="center">
      <strong>Repositories — Indexed Workspaces</strong><br/>
      <img src="docs/screenshots/repos-view.png" alt="Repositories view" width="480"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Semantic Search with Source Citations</strong><br/>
      <img src="docs/screenshots/search-view.png" alt="Search view" width="480"/>
    </td>
    <td align="center">
      <strong>Live System Health Monitor</strong><br/>
      <img src="docs/screenshots/health-modal.png" alt="Health modal" width="480"/>
    </td>
  </tr>
</table>

---

## ✨ Features

- **RAG Chat** — Ask natural language questions about any indexed Java codebase; get grounded answers with file + line citations
- **Semantic Search** — Vector similarity search over code chunks (cosine distance via pgvector)
- **Multi-repo support** — Index and switch between multiple Java projects
- **Source Inspector** — Click any citation to view the exact code snippet inline
- **Command Palette** — `Ctrl+K` global quick-find across all views
- **System Health Monitor** — Real-time status of all components (DB, Ollama, chat model, embeddings)
- **Fully local LLM** — 100% private; no data leaves your machine (Ollama)
- **Console-style dark UI** — Hallmark-compliant, zero glassmorphism, developer-first aesthetic

---

## 🏗️ Architecture

```mermaid
flowchart TD
    Browser["🌐 Browser\n(React 19 + TypeScript)"]
    Nginx["Nginx\n(frontend container :3000)"]
    Backend["Spring Boot 3.5\n(backend container :8080)"]
    PG["PostgreSQL 16\n+ pgvector\n(db container :5432)"]
    Ollama["Ollama\n(host machine :11434)"]
    
    Browser -->|"HTTP /api/*"| Nginx
    Nginx -->|"proxy_pass"| Backend
    Backend -->|"JPA / pgvector cosine search"| PG
    Backend -->|"nomic-embed-text 768-dim"| Ollama
    Backend -->|"qwen3.5:4b RAG chat"| Ollama
```

### RAG Pipeline

```mermaid
flowchart LR
    A["📁 Java Repo\n(local path)"] --> B["JavaFileDiscovery\n.java scanner"]
    B --> C["JavaSourceParser\nAST → methods/classes"]
    C --> D["EmbeddingService\nnomic-embed-text 768d"]
    D --> E["pgvector\nCodeChunk table"]
    
    Q["❓ User Question"] --> F["EmbeddingService\nembed query"]
    F --> G["SemanticSearchService\ncosine distance < 0.52"]
    G --> H["QueryAwareSearchRanker\nboost impls over declarations"]
    E --> G
    H --> I["RagChatService\nSpring AI + qwen3.5:4b"]
    I --> J["✅ Grounded Answer\n+ File Citations"]
```

### Data Model

```mermaid
erDiagram
    REPOSITORY {
        uuid id PK
        string name
        string source_path
        string indexing_status
        int indexed_file_count
        int indexed_chunk_count
        timestamp created_at
    }
    FILE {
        uuid id PK
        uuid repository_id FK
        string file_path
        string package_name
        timestamp indexed_at
    }
    CODE_CHUNK {
        uuid id PK
        uuid file_id FK
        int chunk_index
        text content
        string symbol_name
        int start_line
        int end_line
        vector_768 embedding
        timestamp created_at
    }
    REPOSITORY ||--o{ FILE : "contains"
    FILE ||--o{ CODE_CHUNK : "split into"
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Spring Boot 3.5.16, Spring AI 1.1.8, Spring Data JPA |
| **AI / LLM** | Ollama — `qwen3.5:4b` (chat), `nomic-embed-text` (768-dim embeddings) |
| **Database** | PostgreSQL 16 + pgvector extension |
| **Frontend** | React 19, TypeScript 5.8, Vite 6, Lucide icons |
| **Infra** | Docker Compose (3-container), Nginx reverse proxy |
| **Testing** | Vitest (8 unit tests), Spring Boot Test (12 unit/integration tests) |
| **CI/Deploy** | Render (frontend + backend), Cloudflare Tunnel (Ollama bridge) |

---

## 🚀 Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Linux container mode)
- [Ollama](https://ollama.com/) installed and running (`localhost:11434`)
- Git

### 1. Pull Ollama models

```bash
ollama pull qwen3.5:4b
ollama pull nomic-embed-text
```

> `qwen3.5:4b` needs ~4 GB RAM. Cold-start: ~60–340 s on CPU. Warm queries: ~10–25 s.

### 2. Clone & configure

```bash
git clone https://github.com/aldehydeketone/Codebase-Copilot.git
cd Codebase-Copilot
cp .env.example .env
# Edit .env — set COPILOT_DB_PASSWORD to anything strong
```

### 3. Start all services

```bash
docker compose up -d
docker compose ps    # all 3 containers should be healthy
```

| Container | Port | Purpose |
|-----------|------|---------|
| `codebase-copilot-db` | `127.0.0.1:5433` | PostgreSQL 16 + pgvector |
| `codebase-copilot-backend` | `127.0.0.1:8080` | Spring Boot API |
| `codebase-copilot-frontend` | `127.0.0.1:3000` | React UI (Nginx) |

### 4. Open the app

Navigate to **http://localhost:3000** and click **[+ Import repository]** to index a Java project by its absolute path.

---

## 💻 Local Development (no Docker for backend/frontend)

> Requirements: Java 21, Maven 3.9+, Node.js 20+, Docker (for DB only)

```bash
# 1. Start only the database
docker compose up -d db

# 2. Run backend
mvn spring-boot:run

# 3. Run frontend dev server (separate terminal)
cd frontend
npm ci
npm run dev
# → http://localhost:5173 (Vite proxies /api → :8080)
```

---

## 🔌 API Reference

### Health check
```bash
GET /api/health
```
```json
{
  "status": "OPERATIONAL",
  "checks": {
    "ollama": { "status": "UP", "latencyMs": 263 },
    "chatModel": { "status": "UP", "model": "qwen3.5:4b" },
    "embeddingModel": { "status": "UP", "model": "nomic-embed-text" },
    "database": { "status": "UP", "latencyMs": 7 }
  }
}
```

### Import a repository
```bash
POST /api/repositories/import
Content-Type: application/json

{ "path": "/absolute/path/to/java-project", "name": "my-project" }
```

### Semantic search
```bash
POST /api/search
Content-Type: application/json

{ "query": "Where is the order total calculated?", "repositoryId": "<uuid>", "limit": 5 }
```

### RAG chat
```bash
POST /api/chat
Content-Type: application/json

{ "question": "How does authentication work?", "repositoryId": "<uuid>", "topK": 5 }
```

Response includes `answer` (Markdown string) and `citations` (file path + line ranges + snippet).

---

## 🧪 Tests

```bash
# Frontend — 8 unit tests
cd frontend && npm test

# Backend — unit tests (H2 in-memory, no external services)
mvn clean verify

# Backend — full pipeline integration test (needs live PostgreSQL + Ollama)
mvn -Dtest=RealPipelineIntegrationTest -DrealIntegration=true test

# Frontend production build
cd frontend && npm run build
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COPILOT_DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `COPILOT_DB_PORT` | `5433` | PostgreSQL port |
| `COPILOT_DB_NAME` | `copilot_db` | Database name |
| `COPILOT_DB_USER` | `copilot_user` | Database user |
| `COPILOT_DB_PASSWORD` | *(required)* | Database password |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_CHAT_MODEL` | `qwen3.5:4b` | Chat LLM model |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model (768-dim) |
| `OLLAMA_CHAT_KEEP_ALIVE` | `10m` | Keep model loaded in RAM |
| `OLLAMA_CHAT_READ_TIMEOUT` | `420s` | HTTP read timeout for chat |
| `BACKEND_EXTERNAL_PORT` | `8080` | Host port for backend |
| `FRONTEND_EXTERNAL_PORT` | `3000` | Host port for frontend |

---

## 🗃️ Docker Operations

```bash
# Stop (preserve data volumes)
docker compose stop

# Resume
docker compose start

# Remove containers but keep DB data
docker compose down

# ⚠️ WARNING — this DELETES the database permanently
# docker compose down -v

# Rebuild a single image
docker compose build backend

# Database backup
docker compose exec db pg_dump -U copilot_user copilot_db > backup_$(date +%Y%m%d).sql
```

---

## 📂 Project Structure

```
CodebaseCopilot/
├── src/main/java/com/copilot/
│   ├── controller/          # REST endpoints (Chat, Search, Repository, Health)
│   ├── service/
│   │   ├── ingestion/       # JavaFileDiscovery, JavaSourceParser, RepositoryIndexer
│   │   ├── embedding/       # EmbeddingService (nomic-embed-text)
│   │   ├── search/          # SemanticSearchService, QueryAwareSearchRanker
│   │   └── rag/             # RagChatService (Spring AI + Ollama)
│   ├── model/               # JPA entities (Repository, File, CodeChunk)
│   └── config/              # CORS, Ollama client, filters
├── frontend/
│   ├── src/
│   │   ├── components/      # ChatPanel, SearchPanel, RepositoryPanel, Sidebar…
│   │   ├── services/        # api.ts (typed HTTP client)
│   │   └── design.css       # Console theme (Hallmark-compliant, 0 FAIL)
│   └── vite.config.ts
├── docs/screenshots/        # UI screenshots
├── docker-compose.yml
├── Dockerfile
└── pom.xml
```

---

## 🔒 Privacy

All LLM inference runs locally via Ollama. **No code, queries, or answers are sent to any external API.** The only network calls are:
- pgvector queries (local Docker container)
- Ollama HTTP calls (`localhost:11434`)

When deployed to Render, a Cloudflare Tunnel bridges the Render backend to your local Ollama instance.

---

## 📄 License

MIT © [aldehydeketone](https://github.com/aldehydeketone)
