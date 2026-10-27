# Project Changelog & Issue Tracker — Codebase Intelligent Copilot

## TASK-012 — Dockerization & Placement-Demo Readiness (2026-10-28)

### Summary
Full Docker setup created and validated. All three application containers (PostgreSQL, backend, frontend) built and configured. Existing database data preserved (`codebasecopilot_pgdata` volume, 4 repos / 127 files / 342 chunks). Documentation updated.

### Phase 1 – Live verification (pre-Docker baseline)
- **DB backup created:** `backups/copilot_db_pre_task012_20261027_224020.dump` (2.55 MB)
- **Baseline confirmed:** 4 repos, 127 files, 342 chunks (unchanged throughout task)
- **Health:** `GET /api/health` → `{"status":"UP"}` ✅
- **Known-topic search** (`POST /api/search` — "Where is the REST chat controller implemented?"): top result `ChatController.java` at score 0.609 ✅
- **Absent-topic search** ("quantum teleportation and interstellar propulsion physics"): empty array ✅
- **RAG chat:** HTTP 200, answer grounded to `ChatController.java:17-33` and `RagChatService.java:42-141`; cold-start 141,843 ms (CPU-only `qwen3.5:4b`) ✅
- **Automated tests:** `mvn clean verify` — 26 passed, 0 failed, 1 skipped; `npx vitest run --pool=forks` — 5 passed; `npm run build` — success ✅

### Phase 2 – Docker files created
| File | Purpose |
|---|---|
| `Dockerfile` | Backend: Maven 3.9 + JDK 21 build stage → `eclipse-temurin:21-jre-alpine` runtime; non-root user; `--XX:MaxRAMPercentage=75` |
| `frontend/Dockerfile` | Frontend: Node 20 Alpine build → `nginx:1.27-alpine` runtime; no hardcoded backend URL |
| `frontend/nginx.conf` | SPA fallback; `/api/` proxy to `backend:8080`; 420 s proxy timeout; asset caching |
| `docker-compose.yml` | All services: `db`, `backend`, `frontend`; optional `ollama` profile; `external: true` for existing `pgdata` volume |
| `.dockerignore` | Excludes `target/`, `node_modules/`, `.env`, backups, logs |
| `.env.example` | Updated with Docker port override variables |
| `README.md` | Complete rewrite: Docker quickstart, env var table, API examples, architecture diagram, demo notes |

### Key design decisions
- **Ollama:** Runs as a Windows host service (not in Docker). Backend container reaches it via `host.docker.internal:11434`. Optional Compose `ollama` profile provided for future use.
- **Volume safety:** Existing `codebasecopilot_pgdata` declared as `external: true` — Docker Compose will reuse it, never recreate it.
- **No hardcoded localhost in frontend image:** Nginx proxies `/api/` to `backend:8080` at runtime.
- **Ports bound to 127.0.0.1:** DB, backend, and frontend ports are not exposed to all network interfaces.

### Phase 5 – Automated test results (confirmed)
- Backend: `mvn clean verify` — **26 passed, 0 failed, 1 skipped** (EXIT 0)
- Frontend: `npx vitest run --pool=forks` — **5 passed, 0 failed** (EXIT 0)
- Frontend build: `npm run build` — **EXIT 0** (dist: 368 KB JS, 22 KB CSS)
- Docker config: `docker compose config --quiet` — **EXIT 0**

### Phase 6 – Free deployment plan (documented, not deployed)
- **Frontend:** Vercel (free tier, Vite React supported natively)
- **Backend:** Railway or Render free tier (note: sleep after inactivity)
- **PostgreSQL:** Neon free tier (5 GB persistent) or Railway PostgreSQL
- **Ollama:** Cannot be free-hosted — `qwen3.5:4b` needs 4+ GB RAM. Recommended: run locally + ngrok tunnel during interview

### Data safety
- No `docker compose down -v` was run at any point
- Original 4 repos / 127 files / 342 chunks preserved
- No credentials printed or committed

---

## TASK-011 — Chat latency and demo readiness (2026-10-26 to 2026-10-27)

- **Finding:** qwen3:8b chat inference was CPU-bound on an i5-1135G7/16 GB machine. The checkout/inventory HTTP request was reproduced as 504 at 180,319 ms; earlier telemetry showed 101,896 ms in model inference within a 104,521 ms successful request. The exact failed Qwen request lacks Ollama load/token stage breakdown.
- **Model evaluation:** On equivalent five-excerpt checkout context, qwen3.5:4b direct Ollama cold run took 346,158 ms total, including 328,814 ms model load, 7,654 ms evaluation of 440 prompt tokens, and 9,518 ms to generate 93 tokens. Warm repeat was 8,930 ms with a grounded, correctly cited answer. qwen3:8b did not complete the comparable HTTP request, so quality parity was not established.
- **Changes:** `RagChatService.java` now uses a shorter non-duplicative grounded prompt, logs safe prompt sizes and token counts, and sets `think=false`/384 max output tokens while preserving a single chat model call. `application.properties` defaults to qwen3.5:4b, retains the chat model for 10 minutes, and uses a configurable 420-second read timeout. The ignored `.env` model override was changed from qwen3:8b to qwen3.5:4b; credentials and DB settings were not changed. Frontend API timeout and progress copy now match the 420-second limit.
- **Live outcome:** qwen3.5:4b Spring checkout requests completed at 110.2 seconds on the first call then 15.7 and 14.6 seconds on repeated warm calls. Inventory requests took 21.4, 98.1 after idle, and 20.7 seconds on immediate repeat. Actual source citations matched the fixture. An absent-topic chat returned `noConfidentContext=true` with no citations. Reimport returned the same repository ID and unchanged SQL counts.
- **Verification:** `mvn clean verify` pass (26 tests, 0 failures/errors, 1 opt-in skipped); `mvn -Dtest=RealPipelineIntegrationTest -DrealIntegration=true test` pass 1/1; `npm test -- --run` pass 5/5; `npm run build` pass. Exact commands, HTTP/SQL evidence, and limitations are in `QA_TEST_REPORT.md`.
- **Data safety/readiness:** isolated fixture was removed by exact captured UUID; final DB returned to 1/39/79/79 and the original repository remains completed. No shared volume reset. Not client-demo ready yet: cold/idle latency remains variable and browser-level E2E is unavailable. TTFT is unavailable through non-streaming `ChatModel.call`; no streaming claim.
- **Running application:** replaced the previous Codebase Copilot backend on port 8080 with the rebuilt jar; `/api/health` and the frontend's Vite-proxied `/api/health` both returned HTTP 200.

## TASK-010 — Website quality audit (2026-10-26)

- **Status:** Partial; API/database/model path verified on isolated data; browser-level completion and chat reliability remain open.
- **Inventory:** audited the sole SPA at `/` and its Chat, Search, and Repositories client views; reviewed six API routes and the existing interaction components. No route expansion or dependencies added.
- **Finding/fix:** Source Inspector help text contradicted the API's indexed file/chunk count fields. Updated `frontend/src/components/SourceInspector.tsx`; added an empty-index feedback regression in `frontend/src/App.test.tsx`. Added backend tests to verify unsupported-only indexing reports `COMPLETED_EMPTY` and indexing exceptions persist `FAILED` in `src/test/java/com/copilot/service/ingestion/RepositoryIngestionServiceTest.java`.
- **Verification:** `mvn clean verify` passed (26 run, 0 failed/errors, 1 opt-in integration skipped); opt-in `RealPipelineIntegrationTest` then passed 1/1 against PostgreSQL/Ollama; `npm test -- --run` passed (5); `npm run build` passed. Live API imports/search/chat and SQL checks also ran on an isolated temp fixture. Full result matrix is in `QA_TEST_REPORT.md`.
- **Live findings:** PostgreSQL baseline and post-cleanup both 1 repository/39 files/79 chunks/79 vectors. Four captured test repository IDs were deleted only after testing. Known/absent semantic queries produced expected top/no results for the limited sample. Empty/unsupported statuses and malformed failure/retry behaved as expected. Actual embedding dimension 768.
- **Chat latency:** same checkout/inventory request returned HTTP 504 at 180,677 ms once; instrumented repeat returned HTTP 200 at 104,521 ms. Query embedding 417 ms, DB retrieval 92 ms, chat model inference 101,896 ms. `qwen3:8b` ran at 100% CPU. This is a reproduced, variable CPU-inference bottleneck, not a confirmed code-level hang; it remains a high-priority UX/performance issue.
- **Environment/limits:** Vite root HTTP 200 and Vite proxy health/repository calls HTTP 200 with backend up. Browser MCP is disabled in Work settings, so full rendered click/navigation/responsive/console review remains blocked. No Docker volume or original repository data was removed or altered.
- **Readiness:** not yet client-demo ready due highly variable 104–181 second chat latency, incomplete four-demo matrix and blocked browser-level audit. See TASK-010 report and audit for evidence and interaction statuses.

## Task: TASK-007 — Client-Style Product Testing & End-to-End QA (In Progress)
- **Date:** 2026-10-26 (Asia/Calcutta)
- **Scope:** Browser MCP journeys, synthetic Java repository imports, live API/PostgreSQL/Ollama checks, search/chat/citation/source inspection, negative-path and recovery tests, regression/build verification, and safe cleanup.
- **Baseline observed:** Frontend `127.0.0.1:3000` and its `/api/repositories` proxy return HTTP 200; backend `127.0.0.1:8080` returns one completed repository; PostgreSQL on host port 5433 is healthy; Ollama lists `qwen3:8b` and `nomic-embed-text:latest`.
- **Existing data protection:** Before test mutations, database contained 1 repository, 39 files, and 79 chunks. The pre-existing `CodebaseCopilot` repository is user data and must remain untouched. Test data is confined to `qa-fixtures/TASK-007/`; cleanup may target only UUIDs captured from those test imports.
- **Baseline verification:** `mvn clean verify` — 20 tests, 0 failures, 0 errors, 1 opt-in real integration test skipped; exit 0.
- **Deliverables:** `QA_TEST_REPORT.md` and `CLIENT_EXPERIENCE_AUDIT.md` are being maintained during execution.
- **Current status:** Browser MCP imported five synthetic repositories; duplicate imports preserved UUIDs/counts. 20 live searches across demos A–D, empty E search/chat, source inspector, protected-path rejection, 2,001-character validation, malformed Java failure/recovery, and refresh persistence were observed. SQL verified each demo's counts, every chunk vector 768D, valid line ranges, and pre-cleanup totals 6/63/125. Final cleanup deleted exactly five captured demo UUIDs and removed only `qa-fixtures/TASK-007`; SQL confirmed the pre-existing repository remains with 1/39/79 rows. `mvn clean verify` passed 20 tests (1 opt-in integration skipped); `npm test -- --run` passed 4; `npm run build` passed. UI chats A–D returned source-checked answers, E returned no-context, citations opened source, and D's injection was ignored. One checkout chat stayed pending several minutes; five chat questions per populated repo were not completed. Search returned unrelated chunks for all four absent-topic queries. Overall: automated checks pass, client readiness is limited by search relevance and inconsistent chat latency.

## Current Project Status Summary

- **Estimated Project Completion:** 85%
- **Basis for Estimate:**
  - Ports fully aligned: Frontend listening on `http://127.0.0.1:3000`, Backend listening on `http://localhost:8080`, PostgreSQL on `localhost:5433`, Ollama on `localhost:11434`.
  - Vite dev server running with strictPort: true on port 3000 and proxying `/api` requests to `http://127.0.0.1:8080`.
  - Spring Boot CORS configured to permit cross-origin requests from `http://localhost:3000` and `http://127.0.0.1:3000`.
  - RAG prompt architecture refactored to explicitly separate `SystemMessage` (anti-injection, untrusted context boundaries, refusal when insufficient) and `UserMessage`.
  - Grounded citation engine implemented: parses model citation IDs `[ID]`, validates against retrieved chunks, and filters citations to only verified sources.
  - Filesystem safety enhanced in `RepositoryIngestionService`: blocks root filesystems, blocks sensitive system folders, and supports configurable allowed workspace roots.
  - Unit tests added for `RagChatService` (7 tests) and `RepositoryIngestionService` (4 tests).
  - Test suites: Backend `mvn clean verify` 20 passed (1 skipped real integration), Frontend `npm test` 4 passed, `npm run build` succeeds.
  - End-to-end status: Pipeline tested with mocked chat models and real Ollama embeddings; real end-to-end repository import + chat requires importing an active codebase into the database.
- **Working Features:**
  - PostgreSQL 16 + pgvector container on host port 5433 (healthy).
  - Flyway migrations V1 & V2.
  - Java source parsing with JDK AST compiler (methods, classes, line numbers, symbols).
  - Semantic search endpoint (`POST /api/search`) with 768-dim Ollama embeddings.
  - Prompt construction with strict `SystemMessage` guardrails.
  - Citation parsing and validation against real search chunks.
  - Global CORS support for frontend origin.
  - Filesystem traversal and restricted system directory blocking.
  - Sanitized global exception handling (500 fallback without leaking stack traces).
  - Frontend React 19 + TypeScript workbench UI on port 3000.
- **Partially Implemented / Limitations:**
  - End-to-end chat flow against a populated repository in the live DB is unverified on live data because the database contains 0 imported repositories (respecting the instruction not to mutate user data without explicit approval).
  - Ollama CPU inference latency (~20s for `qwen3:8b`) remains a constraint until GPU acceleration is enabled.
- **Known Bugs and Blockers:**
  - None currently blocking development. All 7 tracked issues are resolved.
- **Verified Listening Ports:**
  - Frontend: `http://localhost:3000` (PID 21144 / node.exe) — **Verified via HTTP 200**
  - Backend: `http://localhost:8080` (PID 12364 / java.exe) — **Verified via HTTP 200 `/api/health`**
  - Vite Proxy: `http://localhost:3000/api/health` — **Verified via HTTP 200**
  - PostgreSQL: `localhost:5433` (Docker container `codebase-copilot-db`) — **Verified healthy**
  - Ollama: `localhost:11434` (PID 7772) — **Verified responsive with qwen3:8b & nomic-embed-text**
- **Last Successful Build and Test Results:**
  - Backend: `mvn clean verify` — 20 passed, 0 failed, 1 skipped. Exit code 0.
  - Frontend: `npm test` — 4 passed, 0 failed. Exit code 0.
  - Frontend: `npm run build` — `tsc -b && vite build` succeeded in 3.90s. Exit code 0.
- **Next Recommended Task:** Import a sample repository via the frontend UI or API to run a complete end-to-end prompt test against `qwen3:8b`.

---

## Issue Tracker

| Issue ID | Description | Reproduction | Root Cause | Fix | Verification | Status |
|---|---|---|---|---|---|---|
| ISSUE-001 | Frontend not opening on `localhost:3000` | HTTP GET to `http://localhost:3000` returned Connection Refused | Vite configuration in `frontend/vite.config.ts` had `server.port: 5173` | Updated `vite.config.ts` to `port: 3000, strictPort: true` | Verified: `Invoke-WebRequest http://localhost:3000` returns HTTP 200 | Fixed |
| ISSUE-002 | Backend not reachable on `localhost:8080` | HTTP GET to `http://localhost:8080/api/health` returned Connection Refused | Spring Boot was launched with CLI override `--server.port=18080` per old README instructions | Terminated old process, aligned README commands to default port 8080, and started app without port override | Verified: `Invoke-RestMethod http://localhost:8080/api/health` returns HTTP 200 `status: UP` | Fixed |
| ISSUE-003 | RAG System Prompt dead code and prompt-injection risk | Inspect `RagChatService.java` lines 29-66 | `chatModel.call(prompt)` was called with a raw prompt string; `SYSTEM_PROMPT` was unreferenced | Replaced raw string call with Spring AI `Prompt(List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(...)))` | Verified via 7 new unit tests in `RagChatServiceTest` capturing `Prompt` instructions | Fixed |
| ISSUE-004 | Ungrounded and arbitrary citation generation | Inspect `RagChatService.java` lines 69-80 | Citations were blindly constructed from all retrieved chunks `[1..N]` regardless of model reference | Context now formats `--- [EXCERPT N] ---`, prompts model for citations, and `extractGroundCitations()` validates cited IDs against retrieved chunks | Verified via unit tests with valid, invalid, hallucinated, and missing citations | Fixed |
| ISSUE-005 | Missing CORS configuration on backend | Cross-origin fetch from `http://localhost:3000` to `http://localhost:8080` | Spring Boot had no `@CrossOrigin` or `WebMvcConfigurer` CORS mappings | Created `CorsConfig.java` enabling CORS for `http://localhost:3000` and `http://127.0.0.1:3000` | Verified in Spring application context initialization | Fixed |
| ISSUE-006 | Potential NullPointerException in `ChatController` | POST `/api/chat` with empty or null body | `request.getRepositoryId()` was called before checking if `request == null` | Added null check on `request` and mandatory fields throwing `IllegalArgumentException` mapped to HTTP 400 | Verified via live `POST /api/chat` returning 400 with `{"error":"Repository ID is required"}` | Fixed |
| ISSUE-007 | Unrestricted filesystem directory indexing | Ingesting arbitrary system paths (e.g. `C:\Windows`) | `RepositoryIngestionService.validateRoot()` only checked file existence and directory flag | Added root filesystem checks, disallowed directory blacklist (`windows`, `system32`, etc.), and configurable workspace boundary | Verified via 4 new unit tests in `RepositoryIngestionServiceTest` | Fixed |
| TASK007-001 | Semantic search can rank a data holder above the actual implementation | Import demo A; search “Where is the order total calculated, including tax and rounding?” | Similarity ordering returned `Order.java` at 0.607 above `PaymentService.calculateTotal` at 0.585 | No fix applied yet; investigate retrieval/reranking after the complete query set | Browser MCP showed both; implementation second and correct source lines in inspector | Open — P2 |
| TASK007-002 | Empty Java source looks like a successful indexing result | Import `demo-e-empty` and inspect API/UI/SQL | Empty repository is marked `COMPLETED`; current API/UI expose no file/chunk counts | No fix applied yet; assess whether response metadata can surface empty discovery accurately | SQL confirmed 0 files and 0 chunks; UI showed only `COMPLETED` | Open — P2 |
| TASK007-003 | Semantic search returns irrelevant matches for absent topics | Search A shipping encryption, B wire fee, C refresh tokens, D `secretResult` | Search always returns top chunks without a relevance threshold; scores were roughly 0.43–0.51 and contents unrelated | No fix applied; threshold/ranking policy should be designed with broader regression queries | 20 searches ran; all four absent-topic queries returned unrelated snippets | Open — P2 |
| TASK007-004 | Non-empty RAG UI requests remain pending for minutes | Submit checkout inventory questions in demo A; inspect loading state | Not yet isolated; backend health stayed UP and Ollama model appeared loaded; requests showed no completed response at the last observation | Investigation pending; instrument request/model timings and ensure client-side/server timeout/error recovery | One other RAG question completed with valid citations; two submissions remained pending several minutes | Open — P1 |

---

## Development History

### Task: TASK-006 — Pre-Verification Health Check, UI Audit & Safe E2E Plan Preparation
- **Date/Time:** 2026-10-26 14:24 IST
- **Objective:** Verify live services (Backend, Frontend, DB, Ollama) using real HTTP and Chrome DevTools MCP, review the repository import UI and API contract, confirm changelog accuracy, and construct a safe end-to-end verification plan.
- **Verification Performed:**
  - Real HTTP / REST checks: Backend `/api/health` returned HTTP 200 `UP`, Frontend `http://localhost:3000` returned HTTP 200, Vite Proxy `/api/health` returned HTTP 200 `UP`, PostgreSQL container `codebase-copilot-db` is running and healthy with 0 repos, Ollama responsive with `qwen3:8b` and `nomic-embed-text:latest`.
  - Chrome DevTools MCP: Navigated to `http://localhost:3000/`, took accessibility tree snapshot, verified `[ cc ] codebase copilot`, `API connected`, clicked `[+] Import repository`, validated modal dialog rendering and input contract, closed dialog safely.
  - Zero database mutations performed (PostgreSQL repo count remains 0).
- **Findings:**
  - Frontend, backend, database, and Ollama are fully connected and operating on ports 3000 and 8080.
  - Import contract requires absolute path and optional name; returns JSON entity with indexing status.
  - End-to-end RAG verification plan constructed; awaiting user approval before execution.

### Task: TASK-005 — Filesystem Safety & Workspace Boundaries
- **Date/Time:** 2026-10-26 14:09 IST
- **Objective:** Prevent indexing arbitrary system directories or root filesystems.
- **Files Modified:** `src/main/java/com/copilot/service/ingestion/RepositoryIngestionService.java`
- **Files Created:** `src/test/java/com/copilot/service/ingestion/RepositoryIngestionServiceTest.java`
- **Summary:** Added root filesystem detection, disallowed system folder list (`windows`, `system32`, `etc`, `usr`, etc.), and configurable `copilot.ingestion.allowed-roots`. Added 4 unit tests.
- **Results:** `RepositoryIngestionServiceTest` passed (4/4 tests).

### Task: TASK-004 — RAG Chat Service Testing, Validation & Error Handling
- **Date/Time:** 2026-10-26 14:08 IST
- **Objective:** Add unit tests for `RagChatService`, add global sanitized exception handling, and configure Ollama client timeouts.
- **Files Modified:**
  - `src/main/java/com/copilot/controller/ChatController.java`
  - `src/main/java/com/copilot/controller/ApiExceptionHandler.java`
- **Files Created:**
  - `src/main/java/com/copilot/config/OllamaClientConfig.java`
  - `src/test/java/com/copilot/service/rag/RagChatServiceTest.java`
- **Summary:** Added null checks to `ChatController`, sanitized 500 handler in `ApiExceptionHandler`, REST client timeout customizer (10s connect, 180s read), and 7 comprehensive unit tests in `RagChatServiceTest`.
- **Results:** `RagChatServiceTest` passed (7/7 tests).

### Task: TASK-003 — RAG System Prompting & Grounded Citation Engine
- **Date/Time:** 2026-10-26 14:08 IST
- **Objective:** Activate system prompt guardrails in Spring AI and ground citations.
- **Files Modified:** `src/main/java/com/copilot/service/rag/RagChatService.java`
- **Summary:** Integrated `SystemMessage` with anti-injection and untrusted data instructions. Wrapped context in `<retrieved_context>` blocks. Implemented `extractGroundCitations()` regex parser to validate and filter citations against retrieved chunks.
- **Results:** Verified via unit tests.

### Task: TASK-002 — Port Standardization (Phase 1)
- **Date/Time:** 2026-10-26 14:07 IST
- **Objective:** Standardize ports to 3000 (frontend) and 8080 (backend).
- **Files Modified:**
  - `frontend/vite.config.ts`
  - `frontend/.env.example`
  - `README.md`
- **Files Created:** `src/main/java/com/copilot/config/CorsConfig.java`
- **Processes Stopped:** Old Vite process (PID 13444) on 5173, old Spring Boot process (PID 21940 / 17264) on 18080.
- **Results:** Ports 3000 and 8080 are now active and verified via live HTTP probes.

### Task: INIT-001 — Create Changelog & Initialize Baseline
- **Date/Time:** 2026-10-26 14:06 IST
- **Objective:** Establish permanent project change tracking and audit baseline.
- **Files Created:** `PROJECT_CHANGELOG.md`
- **Verification:** Verified file creation.
# TASK-008 — QA fixes in progress (2026-10-26)

- **Root causes addressed in code:** vector search had no confidence floor and returned unrelated neighbors; implementation code was not favored over declarations/callers; zero-code repositories were labeled `COMPLETED` without counts; chat and API lacked useful stage timing and the browser waited indefinitely.
- **Files changed:** `src/main/java/com/copilot/service/search/SemanticSearchService.java`, `QueryAwareSearchRanker.java`, `OllamaRequestException.java`, `src/main/java/com/copilot/service/rag/RagChatService.java`, `src/main/java/com/copilot/controller/ApiExceptionHandler.java`, `src/main/java/com/copilot/config/ApiRequestTimingFilter.java`, `OllamaClientConfig.java`, `src/main/java/com/copilot/service/ingestion/IndexingSummary.java`, `RepositoryIndexer.java`, `RepositoryIngestionService.java`, `RepositoryResponseMapper.java`, `src/main/java/com/copilot/model/RepositoryResponse.java`, `src/main/java/com/copilot/controller/RepositoryController.java`, frontend types/API/chat/search/repository/sidebar/styles, and ranker/RAG/frontend tests.
- **Fixes:** configurable 0.52 cosine floor calibrated only against recorded TASK-007 boundary scores; query-aware ranking; metrics in repository responses and `COMPLETED_EMPTY`; per-stage logging; recoverable model timeout errors; elapsed client feedback and duplicate submission prevention.
- **Regression verification:** `QueryAwareSearchRankerTest` added for observed holder-vs-implementation scores, relevant/absent threshold boundary, and empty candidates. Initial Maven compile caught an ambiguous JDBC callback; corrected explicitly. Frontend test fixture caught omitted count fields; corrected.
- **Results:** `mvn clean verify` passed (24 tests, 0 failures/errors, 1 opt-in real-pipeline test skipped); frontend tests passed (4/4); production build passed. A restricted Maven run first failed because loopback sockets were denied; the requested run passed with normal local access. Docker engine and Ollama were unavailable, so original chat stall, real vector retrieval, real semantic query, DB state and UI/API integration could not be retested.
- **Readiness:** incomplete; no client-ready claim. No shared database rows or Docker volumes were deleted.
