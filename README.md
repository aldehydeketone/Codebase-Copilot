# CodebaseCopilot

## Local development on Windows

Prerequisites: Docker Desktop with the Linux container engine, Java 21, and Maven (or the Maven Wrapper if one is added to this project).

1. Copy `.env.example` to `.env` in the repository root. Keep `.env` local; it is ignored by Git. Set the database values there:

   ```dotenv
   COPILOT_DB_HOST=127.0.0.1
   COPILOT_DB_PORT=5433
   COPILOT_DB_NAME=copilot_db
   COPILOT_DB_USER=copilot_user
   COPILOT_DB_PASSWORD=your-local-password
   ```

   Use the password for the existing `copilot_user` role in the Docker database. Choose a strong local password and use the same value in the Docker and application configuration. Host, port, username, and database name can be changed in this file; the host application connects to the mapped host port.

2. The application ignores legacy `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` environment variables so they cannot redirect the project to another database. Remove any old Windows User or System definitions as cleanup and restart terminals and the IDE after changing them. Use the project-specific `COPILOT_DB_*` names below.

3. Start PostgreSQL with pgvector:

   ```powershell
   docker compose up -d db
   docker compose ps
   ```

   Compose reads the root `.env` for its container settings. It does not export those values into a separate Maven process; `application.properties` explicitly imports `.env` as a properties file when Spring Boot starts.

4. Build and verify:

   ```powershell
   mvn clean verify
   ```

5. Install and start Ollama models used by the application:

   ```powershell
   ollama pull qwen3.5:4b
   ollama pull nomic-embed-text
   ollama serve
   ```

   Keep the chat model selected in the ignored project `.env` using `OLLAMA_CHAT_MODEL`; the example defaults to `qwen3.5:4b`. The chat request disables reasoning mode and limits output to 384 tokens. Ollama may need several minutes to load a model on a CPU-only machine; this was measured at up to 346 seconds on an Intel i5-1135G7 with 16 GB RAM. Once warm, repeated checkout/inventory calls completed in about 14–21 seconds. Models are retained for 10 minutes after use. The backend and frontend both allow up to 420 seconds for chat; the API is non-streaming, so the first token is not shown while inference runs.

6. Start the application from the repository root so the project `.env` is found:

   ```powershell
   mvn spring-boot:run
   ```

   Spring Boot runs Flyway migrations at startup. Confirm the app starts successfully and check migration state and application tables with:

   ```powershell
   docker compose exec db psql -U copilot_user -d copilot_db -c "SELECT version, success FROM flyway_schema_history ORDER BY installed_rank;"
   docker compose exec db psql -U copilot_user -d copilot_db -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
   docker compose exec db psql -U copilot_user -d copilot_db -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;"
   ```

## Phase 2 API

Import and index a local Java repository:

```powershell
$result = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/repositories/import -ContentType 'application/json' -Body (@{ path = 'D:\src\example-java-repo'; name = 'example-java-repo' } | ConvertTo-Json)
$result | ConvertTo-Json -Depth 5
```

The response includes the repository ID and indexing status. Successful imports are `COMPLETED`; invalid paths return 400/404; parser, filesystem, or embedding failures return 422 and persist `FAILED` with `errorDetails`.

Run semantic search against a repository:

```powershell
$body = @{ query = 'Where is the greeting message created?'; repositoryId = $result.id; limit = 5 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/search -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 5
```

Search embeds the query with the configured Ollama `nomic-embed-text` model and runs cosine-distance ordering in PostgreSQL through pgvector.

## Tests

`mvn clean verify` runs the H2 context test and unit tests for parser line ranges, excluded directories, invalid syntax, and embedding dimension validation. Embedding unit tests use a Mockito model and do not persist vectors.

The real integration test is intentionally opt-in because it needs Docker PostgreSQL on port 5433 and a running Ollama service with `nomic-embed-text` installed:

```powershell
mvn "-Dtest=RealPipelineIntegrationTest" -DrealIntegration=true test
```

That test starts the HTTP server, calls repository import and semantic search, verifies PostgreSQL row counts and `vector_dims(embedding)=768`, checks repeat-import idempotency and error status persistence, then deletes only its temporary database records.

For custom database names or users, substitute your `.env` values in the `psql` commands above. The database container is published on `127.0.0.1:5433`; a separate local PostgreSQL server may continue using `5432`. The named `pgdata` volume stores database data. Do not run `docker compose down -v` when you need to preserve that data.

## Frontend workbench

The `frontend` folder contains the React 19 + TypeScript + Vite single-page workbench for importing repositories, semantic search, chat, and source inspection. The API exposes indexed Java-file and chunk counts, but only returns selected code snippets rather than complete file contents. Its Chat, Search, and Repositories views are client-side navigation states; there are no separate URL routes to refresh or bookmark. Start Spring Boot on port 8080 (use a separate PowerShell window):

```powershell
cd D:\project\CodebaseCopilot
mvn spring-boot:run
```

Then start the workbench in a second PowerShell window:

```powershell
cd D:\project\CodebaseCopilot\frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`. The Vite dev server proxies `/api` calls to `http://127.0.0.1:8080` during development. Run `npm test` for mocked frontend interaction tests and `npm run build` for the production build. Repository paths are read by Spring Boot, so it must run on the same Windows machine as the source folders. The root `DESIGN.md` and `.agents/skills/hallmark` guide the frontend’s cream-and-monospace workbench style.
