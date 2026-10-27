# TASK-007 — Product QA Test Report

## TASK-011 — Chat latency and demo readiness (2026-10-26 to 2026-10-27)

**Status: latency improved after model warm-up; not declaring client-demo ready.** The qwen3:8b timeout was reproduced, a smaller model was benchmarked on identical retrieved checkout context, and the new Spring chat configuration was exercised over HTTP. Cold model loading remains highly variable and browser-level E2E remains unavailable.

### Root cause and instrumentation

- Existing `RagChatService` performed one blocking `chatModel.call(prompt)`. Query embedding and PostgreSQL retrieval were not the dominant stages. The earlier instrumented request spent 101,896 ms in chat inference of 104,521 ms total; `qwen3:8b` ran at 100% CPU. No Ollama token/load metrics were recorded for that failed qwen3:8b request, so its time cannot be divided between load, reasoning, prompt evaluation, or generation.
- This task reproduced the same checkout/inventory question with the qwen3:8b configuration: HTTP 504 after 180,319 ms. It used five retrieved excerpts from the isolated Java fixture. The machine is an Intel i5-1135G7, 4 cores/8 logical threads, 15.7 GB RAM; Ollama CPU-only model execution was observed. Installed models included qwen3:8b (5.2 GB) and qwen3.5:4b (3.3 GB), plus `nomic-embed-text`.
- Direct Ollama comparison with the exact same five retrieved excerpts, concise grounded prompt, `think=false`, and `num_predict=256` measured qwen3.5:4b cold wall time 346,158 ms: model load 328,814 ms, prompt evaluation 7,654 ms for 440 tokens, and generation 9,518 ms for 93 tokens (Ollama total 346,035 ms). A warm repeat took 8,930 ms wall / 8,853 ms Ollama total, with 217 ms load, 173 ms prompt evaluation, and 8,455 ms to generate 94 tokens. This shows the measured direct cold run was dominated by model loading, not context evaluation or output generation. The separate qwen3:8b timeout had no equivalent Ollama breakdown.
- Application chat is non-streaming (`ChatModel.call`); time-to-first-token is not exposed or measured by this endpoint. Streaming was not added. New safe logs report excerpt count, prompt/context character counts, stage duration, and Spring AI prompt/completion token counts; they do not log source contents or credentials.

### Changes and live result

- `src/main/java/com/copilot/service/rag/RagChatService.java`: removed repeated prompt instructions while retaining evidence-only answers, refusal on insufficient evidence, mandatory citations, untrusted-code handling, and confidentiality. Added prompt-size/excerpt logging and token usage logging. The single model call remains. Request options disable Qwen reasoning and cap output at 384 tokens.
- `src/main/resources/application.properties` and ignored local `.env`: default chat model changed from qwen3:8b to qwen3.5:4b; chat model keep-alive is 10 minutes; Spring REST read timeout is configurable and defaults to 420 seconds. The project `.env` had explicitly overridden the old default with qwen3:8b; only its model-name setting was changed. Database settings/password were not printed or modified.
- `frontend/src/services/api.ts` and `frontend/src/components/ChatPanel.tsx`: aligned the client abort limit with the 420-second backend read limit; timeout copy is recoverable and progress copy explains cold local model loading. Duplicate-request prevention remains in place.
- Live Spring endpoint against PostgreSQL/Ollama, qwen3.5:4b, same 5-excerpt fixture and checkout question: first call HTTP 200 in 110,202 ms (retrieval 134 ms, model stage 109,167 ms; 459 prompt/96 completion tokens; 2 citations). Same-question warm repeats: HTTP 200 in 15,743 ms and 14,553 ms (model stage 15,057/14,298 ms; 459 prompt/143 and 119 completion tokens). Their answers correctly describe `CheckoutService.checkout` and cite fixture source.
- Inventory question: HTTP 200 in 21,423 ms (model stage 21,301 ms, 73 completion tokens, 1 citation); same question later took 98,052 ms after a long idle interval (model stage 93,850 ms, 111 completion tokens, 3 citations), then an immediate repeat took 20,668 ms (model stage 20,362 ms, 122 completion tokens, 2 citations). The slower run’s exact cold/load contribution is not separately available from Spring metadata. The answers correctly describe `InventoryService.hasStock`, the `availableQuantity` comparison, and fixture’s hardcoded 10 value.
- Citation source check: checkout excerpt `src/main/java/demo/CheckoutService.java:7-11`; inventory excerpts `src/main/java/demo/InventoryService.java:4-6`, `:8-11`, and `:13`. These ranges were compared with the temporary fixture source. An absent-topic chat returned HTTP 200, `noConfidentContext=true`, zero citations, and the expected no-confident-match text. An absent-topic search returned HTTP 200 with zero results.
- Warm checkout calls (14.6–15.7 seconds) are about 85% faster than the previous successful 104.5-second qwen3:8b run. This improvement is demonstrated for the warmed model; it does not remove cold-load variability. The 110-second first Spring call and 98-second inventory call remain material client wait times. The 346-second direct cold load was below the configured 420-second limit, but a future cold load can still exceed it.

### Regression and data safety

- `mvn clean verify` — final pass, exit 0; 26 tests, 0 failures, 0 errors, 1 opt-in integration skipped. One earlier allowed run found a stale test assertion for the intentionally shortened system prompt; the assertion was corrected and the complete suite rerun successfully. A preceding restricted run could not open a loopback connection and was not counted as a pass.
- `mvn -Dtest=RealPipelineIntegrationTest -DrealIntegration=true test` — pass, exit 0; 1 real test, 0 failures/errors/skips against PostgreSQL 16.15 and Ollama. It validated the real import/search/768-dimensional embedding pipeline and validation errors.
- `npm test -- --run` — pass, exit 0; 5 tests. `npm run build` — pass, exit 0.
- Live idempotency: fixture import HTTP 200 created 3 files/7 chunks/7 embeddings. Repeat returned HTTP 200 with the same UUID and counts. Read-only SQL before/after reimport remained 2 repositories/42 files/86 chunks/86 vectors (1 original repository plus the isolated fixture).
- Cleanup removed only captured fixture UUID `9a3b52a7-3009-41df-b25c-a6b144c87efc` and its temporary files. Final SQL returned exactly 1 repository/39 files/79 chunks/79 vectors; original UUID `bdd3b3fd-cfb0-4713-8498-b5167bc2cc2d` remained `COMPLETED`. No volume reset or original record deletion occurred.
- Browser control remains disabled per the prior MCP environment report; no browser click/responsive/console run is claimed in TASK-011. Frontend tests are mocked, not live-browser E2E.
- The rebuilt application was started on its normal port 8080 after replacing the old Codebase Copilot Java process; `/api/health` returned `UP`, and the existing Vite proxy at port 3000 returned HTTP 200 for `/api/health`.

**Remaining risks:** cold/idle chat can still take roughly 1.5–6 minutes in observed runs; qwen3:8b could not produce an answer under its 180-second app deadline; qwen3:8b quality therefore was not compared to qwen3.5:4b; TTFT and streaming are not implemented; full browser E2E is unavailable. Keep this product marked **not yet client-demo ready** until cold-start latency and browser workflow are addressed and reverified.

## TASK-010 website audit (2026-10-26)

**Overall: PARTIALLY VERIFIED; not yet client-demo ready.** The live API → database → Ollama path has been exercised with isolated fixtures. Browser-level automation, larger retrieval matrices, and a stable chat-latency outcome remain incomplete.

### Inventory before testing

- **Pages/views:** one SPA at `/` with client-state views `Repositories` (default), `Search`, and `Chat`; no React Router routes exist. Direct nested-route/refresh behavior is therefore NOT APPLICABLE. Browser-level navigation/back/forward/responsive/console audit is BLOCKED because desktop browser use is disabled in Work settings (`Browsers: Local browser use is disabled in Work settings`).
- **Components/interactions:** `App` (load and select repositories, refresh, dismiss notice, open import); `Sidebar` (Chat/Search/Repositories navigation, select, import, refresh); `RepositoryImportDialog` (path input, submit, cancel, close, escape/backdrop close); `RepositoryPanel` (select row/import); `SearchPanel` (query submit/retry/result select); `ChatPanel` (question submit/retry/citation select); `SourceInspector` (read-only snippet display). No delete/edit controls exist. The `guide` is an external link.
- **API routes:** `GET /api/health`; `GET /api/repositories`; `GET /api/repositories/{id}`; `POST /api/repositories/import`; `POST /api/search`; `POST /api/chat`. All six route shapes were exercised live; create/search/chat used isolated test IDs, and successful detail read verified the preserved repository reports 39 files/79 chunks. Frontend Vitest interaction checks remain mocked.
- **Dependencies/config:** Java 21.0.10/Maven 3.9.16. Docker 29.6.2 is running; PostgreSQL container is healthy on host port 5433. Baseline before fixture creation: 1 repository, 39 files, 79 chunks, 79 768D vectors, 2 successful Flyway migrations. Ollama was started; `nomic-embed-text:latest` and `qwen3:8b` are installed. Spring Boot and Vite ran on ports 8080/3000; a temporary instrumented Spring instance ran on 8081. Credentials were not read or printed.
- **Known bugs:** retrieval has positive live results in the checked fixture and original repository, and tested absent-topic questions returned zero matches. The full four-demo regression matrix was not rerun. Chat inference remains very slow and variable: same checkout question failed at 180.7s once and succeeded at 104.5s once. This remains a P1 client risk.

### Interaction inventory (current run)

| Component/action | Expected result | Actual evidence | Status |
|---|---|---|---|
| Sidebar Chat/Search/Repositories navigation | Switch view without losing shell | Static component paths inspected; no browser session available | BLOCKED |
| Sidebar repository select / RepositoryPanel row select | Select repository and open workspace | Existing mocked app tests select a repository for Chat/Search paths | PASS (mocked) |
| Sidebar/Repositories import buttons | Open import dialog | Mocked test opens dialog and submits | PASS (mocked) |
| Import path form | Require nonblank; submit one request; show API errors | Mock test verifies request path/name and 404 is visible; no live import | PASS (mocked) |
| Import cancel/close/Escape/backdrop | Close dialog only when idle | Handler inspected, browser interaction not executed | BLOCKED |
| Repository refresh list | Refetch and recover from load error | Handler and retry inspected; not clicked in browser | BLOCKED |
| Repository empty status/count guidance | Show 0-file state with next step | New mocked test verifies `COMPLETED_EMPTY` guidance | PASS (mocked) |
| Search form and submit | Call `/api/search` with selected repo/query/limit, prevent duplicate, expose errors and empty state | Real API queries completed for isolated fixture and preserved original repository; result and scores recorded below | PASS (API) / BLOCKED (browser click) |
| Search retry | Reissue failed query | Handler inspected; not executed | BLOCKED |
| Chat form and submit | Call `/api/chat` once; preserve message on failure; show loading/error/retry | Real request returned 504 after 180.7s; instrumented retry returned 200 after 104.5s | PASS (API outcome/error) / BLOCKED (browser interaction); latency remains risk |
| Citation click | Open the exact returned snippet/path/line interval | API returned three citations; their paths/line ranges were checked against fixture source; browser click unavailable | PASS (API/source check) / BLOCKED (browser click) |
| Source inspector | Label snippet as partial and display returned lines | Component inspected; API-backed display exercised by mocked test | PASS (mocked) |
| Header guide external link | Open documentation page | Not clicked | NOT RUN |
| Responsive desktop/tablet/mobile, keyboard/focus, console/network | Usable layouts and no browser errors | CSS breakpoints and handlers inspected; browser tool disabled | BLOCKED |

### This-run verification

| Command/check | Result |
|---|---|
| `mvn clean verify` (normal local loopback access) | PASS, exit 0; 26 tests, 0 failures, 0 errors, 1 opt-in integration skipped. H2/unit/context tests, not live PostgreSQL/Ollama integration. |
| `mvn -Dtest=RealPipelineIntegrationTest -DrealIntegration=true test` | PASS, exit 0; 1 real integration test, 0 failures/errors/skips. Connected to PostgreSQL 16.15 on 5433, Flyway validated 2 migrations/up to date, indexed 1 temp Java file into 2 chunks, checked 768D vectors, real search HTTP 200, idempotent repeat, 404/400 invalid paths and 422 malformed Java. Test cleaned its captured repository IDs. |
| `npm test -- --run` after TASK-010 changes | PASS, exit 0; 1 file, 5 tests. Frontend API is mocked. |
| `npm run build` after TASK-010 changes | PASS, exit 0; TypeScript and Vite production build. |
| Frontend dev server | PASS, started with `npm run dev -- --host 127.0.0.1 --port 3000`; `GET http://127.0.0.1:3000/` returned HTTP 200 and title `Codebase Copilot — Workbench`. |
| Spring Boot / Vite health | PASS: `/api/health` returned `UP`; Vite root HTTP 200; proxied health `UP`; proxied repository list HTTP 200 (baseline 1, 5 during four isolated imports). |
| Docker PostgreSQL on 5433 and data safety | PASS: healthy pgvector/pg16; baseline 1/39/79/79; during tests 5 repositories/44 files/87 chunks/87 valid 768D vectors; after cleanup exactly 1/39/79/79 and original repository present/completed. Two Flyway migrations remained successful. |
| Tooling errors and recovery | Initial restricted Docker/Ollama loopback calls were denied; repeated with local access and succeeded. One final SQL detail query failed because unqualified `id` was ambiguous; rerun with `r.id` returned the correct original row/counts. No failed result was treated as passed. |
| Ollama model availability | PASS, started local `ollama serve`; `/api/tags` listed `nomic-embed-text:latest` and `qwen3:8b`. |
| Direct Ollama embedding | PASS, actual `POST /api/embed` using `nomic-embed-text` returned a 768-dimensional vector in 5,642 ms. Vector values were not printed. This does not verify app-side persistence or search. |
| Real search and RAG | PASS with limited scope; per-query results and stage times below. No complete multi-demo matrix. |
| Browser E2E, screenshot, console/network, back/forward/refresh/mobile layout | BLOCKED; Browser MCP reports local browser use disabled. HTTP server/API proxy checked, but no browser session. |

### Targeted fix

`frontend/src/components/SourceInspector.tsx` stated that API counts were unavailable, contradicting the `RepositoryResponse` fields and `RepositoryPanel` display. Updated its help text to say counts are available while full file contents are not. Added a mocked regression in `frontend/src/App.test.tsx`; suite passes 5/5. `src/test/java/com/copilot/service/ingestion/RepositoryIngestionServiceTest.java` now covers an unsupported-only scan producing `COMPLETED_EMPTY` and an indexing exception being persisted as `FAILED`; both regression tests passed in `mvn clean verify`.

The existing TASK-008 retrieval fix has four `QueryAwareSearchRankerTest` unit cases using recorded score pairs. All four passed. In addition, live search was checked against the isolated fixture and original repository; matrix and limits are below. These samples are positive evidence, not a full rerun of all four TASK-007 demo repositories.

### Live repository import, integrity and API evidence

| Scenario | Actual result | Status |
|---|---|---|
| Baseline read-only SQL | `repositories=1, files=39, chunks=79, embedded=79, successful migrations=2`; original ID `bdd3b3fd-cfb0-4713-8498-b5167bc2cc2d` | PASS |
| Import isolated Java fixture | HTTP 200, ID `5e795801-f4e5-46a3-abae-a50abaa96bfb`, `COMPLETED`, 4 files/7 chunks; `target/ExcludedNoise.java` omitted | PASS |
| Repeat same path | HTTP 200, same repository ID, API still 4 files/7 chunks; SQL: 4 files/7 chunks, seven 768D vectors, zero invalid line ranges | PASS |
| Empty and unsupported-only repositories | Both HTTP 200 `COMPLETED_EMPTY`, 0 files/0 chunks | PASS |
| Malformed Java | HTTP 422; response and SQL status `FAILED`; after correcting only that isolated fixture, retry returned same ID `COMPLETED`, 1 file/1 chunk, SQL error detail cleared | PASS |
| Missing / restricted / file / malformed paths | HTTP statuses respectively 404 / 400 / 400 / 400 | PASS |
| Missing repository detail / blank search / blank chat | HTTP statuses 404 / 400 / 400 | PASS |
| Cleanup | Deleted only four captured TASK-010 repository UUIDs. Post-cleanup SQL exactly matched baseline 1/39/79/79; original ID remained `COMPLETED`; no volume reset | PASS |
| Opt-in real pipeline test cleanup | Test created its own `@TempDir` repo and removed the captured successful and failed repo IDs; final counts remained 1/39/79/79 | PASS |

### Real retrieval regression samples

Raw cosine score shown below; API top order reflects the current lexical/symbol reranker, scores are not rewritten.

| Dataset | Query | Expected | Actual top results | Status |
|---|---|---|---|---|
| Isolated fixture | “Where is order total calculated including tax and rounding?” | Payment implementation before data-holder field | `PaymentService#calculateTotal` lines 7–9, `.586`, ranked before `Order` lines 5–5, `.606` | PASS; implementation reranked first |
| Isolated fixture | “How does checkout validate inventory?” | Checkout validation and inventory behavior | `CheckoutService#checkout` 12–17 `.682`; constructor `.655`; `InventoryService#hasStock` 4–6 `.609`; `#reserve` 8–12 `.570`; payment accessor `.529` | PASS for behavior in top results; low-ranked payment accessor is extraneous |
| Isolated fixture | “How does inventory validation determine available stock?” | `InventoryService#hasStock` | `InventoryService#hasStock` 4–6 `.700`; checkout 12–17 `.655`; reserve 8–12 `.654` | PASS |
| Isolated fixture | “How does the code refresh shipping encryption tokens?” | No confident match | 0 results | PASS |
| Isolated fixture | “How are Kubernetes manifests deployed?” | No confident match | 0 results; chat returned HTTP 200, `noConfidentContext=true`, 0 citations, and “No confident code matches were found…” | PASS |
| Preserved original repo | “Where is semantic code search implemented?” | Search service/controller | `SemanticSearchService#search` 18–46 `.621`; `SearchController#search` 21–28 `.585` | PASS |
| Preserved original repo | “How is repository path validation and restricted directory handling implemented?” | Path validator | `RepositoryIngestionService#validateRoot` 69–130 `.668`, followed by discovery/validation tests | PASS |
| Preserved original repo | “How are Kubernetes manifests deployed?” | No confident match | 0 results | PASS |

These limited real samples suggest the 0.52 floor rejects the tested absent topics and retains the tested known topics. They do not establish recall/precision across all prior demo repositories; notably the checkout query included one unrelated `.529` accessor in fifth place. Keep full matrix verification open.

### Chat latency and citations

| Request | Result and timing evidence | Status |
|---|---|---|
| Original checkout/inventory question against isolated indexed repo, port 8080 | HTTP 504 after 180,677 ms; Spring read timeout configured to 180 seconds | FAIL (timeout reproduced) |
| Same question on instrumented instance, port 8081 | HTTP 200 after 104,521 ms client-observed; API filter 104,138 ms; retrieval 527 ms (query embedding 417 ms, pgvector query 92 ms); chat model call 101,896 ms; response prep total 103,646 ms | PASS (slow) |
| Instrumented Ollama state | `qwen3:8b` active at 100% CPU during the pending request. Code contains a single `chatModel.call(prompt)` per RAG request; timings show PostgreSQL and embedding are not the bottleneck in this request. | Root cause isolated: variable, CPU-bound local chat-model inference |
| Returned citations on successful chat | `CheckoutService.java` lines 12–17, `InventoryService.java` lines 4–6, and `InventoryService.java` lines 8–12; all three intervals matched the temporary Java source exactly | PASS (API/source comparison); browser click remains blocked |

No duplicate chat submit was triggered. The model occasionally completes but takes over 100 seconds, and the same question previously timed out at 180 seconds. This remains a material performance issue; no timeout was shortened and no claim of a latency fix is made.

### Issue-by-issue disposition

| Finding | Root cause | Files/fix | Regression/retest and outcome | Remaining limitation |
|---|---|---|---|---|
| TASK007-001: implementation ranked below data holder/caller | Candidate order primarily followed cosine similarity; declarations/callers could score higher than executable behavior | `SemanticSearchService.java`, `QueryAwareSearchRanker.java`: bounded candidate set plus lexical/executable-symbol reranking | Unit `.607` vs `.585` regression passed; live order-total search put `PaymentService#calculateTotal` first | Positive in this query; full four-demo ranking matrix still needed |
| TASK007-003: absent query returned unrelated neighbors | Search returned top vector neighbors without a confidence floor | `SemanticSearchService.java`, `QueryAwareSearchRanker.java`: configurable 0.52 default floor | Unit boundaries passed; three absent-topic real queries returned zero across two repositories; unknown chat emitted no-confidence response | Limited query sample and one `.529` unrelated tail result; full matrix remains open |
| TASK007-002: empty scan looked complete | Index result counts were discarded and every successful scan got `COMPLETED` | `RepositoryIndexer.java`, `IndexingSummary.java`, `RepositoryIngestionService.java`, response DTO/mapper/controller, repository UI | Live empty/unsupported imports both reported 0/0 `COMPLETED_EMPTY`; malformed failure/retry persisted and recovered accurately | Browser rendering unavailable; backend/UI mocked test pass |
| TASK007-004: chat pending >1 minute | `qwen3:8b` CPU inference dominates: 101.9s model stage in successful run; same request timed out at configured 180s once. Embedding/DB were 417/92ms. | Timing/logging in `RagChatService.java`, `SemanticSearchService.java`, `ApiRequestTimingFilter.java`; recovery states in `frontend/src/services/api.ts`/`ChatPanel.tsx`; `OllamaClientConfig.java` sets 180s read timeout | Reproduced HTTP 504 at 180.677s and successful HTTP 200 at 104.521s with correct source citations | Slow and variable; underlying workload is CPU-bound inference. Not fixed, still P1 |
| TASK010: source inspector misreported counts | Help text stale after API response gained indexed counts | `frontend/src/components/SourceInspector.tsx`; clarified counts vs full-file contents | Frontend interaction/build suites pass | Actual browser rendering blocked |

### Readiness and remaining issues

**Still not client-demo ready.** The live import → PostgreSQL/pgvector search → Ollama chat → citation API journey passed once on an isolated fixture, and database counts returned to baseline after exact-ID cleanup. Search showed relevant top results and no results for tested absent topics across the fixture and original repository. However, chat took 104.5 seconds on a successful run and timed out at 180.7 seconds on another. Browser-level interaction/responsive/console checks remain blocked; prior four-demo search/chat matrices were not fully repeated. The product is partially verified, with latency and browser verification as critical remaining risks.

## TASK-008 follow-up (2026-10-26)

**Status: Incomplete — live database/Ollama retests blocked.** The recorded causes from TASK-007 are: search returned every vector neighbor regardless of relevance; behavior implementations could lose to higher-cosine data holders/callers; empty scans reused `COMPLETED` and exposed no counts; chat used one synchronous model call but had no stage-level timing, while the browser had no request deadline or meaningful long-wait feedback. The observed chat stall itself was not reproduced this run because Docker Desktop and Ollama are unavailable; therefore its underlying runtime cause remains unconfirmed.

### Changes made

- `src/main/java/com/copilot/service/search/SemanticSearchService.java`: added stage duration/candidate-count logs, retrieves a bounded candidate set, and applies a configurable cosine floor (`copilot.search.minimum-cosine-score`, default `0.52`). This floor separates the previously recorded lowest positive top score (`0.522`) from the highest absent-topic top score (`0.512`); it has not been validated against live data in this run.
- `src/main/java/com/copilot/service/search/QueryAwareSearchRanker.java`: modest lexical coverage and executable-symbol reranking while preserving returned cosine values.
- `src/main/java/com/copilot/service/rag/RagChatService.java`, `src/main/java/com/copilot/config/ApiRequestTimingFilter.java`, and `src/main/java/com/copilot/config/OllamaClientConfig.java`: logs retrieval, chat inference, total API, timeout configuration and failures without logging prompts/source/secrets. Chat inference failures map to recoverable 503/504 API errors.
- `src/main/java/com/copilot/service/ingestion/RepositoryIndexer.java`, `src/main/java/com/copilot/service/ingestion/IndexingSummary.java`, `src/main/java/com/copilot/service/ingestion/RepositoryIngestionService.java`, `src/main/java/com/copilot/model/RepositoryResponse.java`, `src/main/java/com/copilot/service/ingestion/RepositoryResponseMapper.java`, and `src/main/java/com/copilot/controller/RepositoryController.java`: counts are returned and zero-file/chunk scans report `COMPLETED_EMPTY`.
- `frontend/src/services/api.ts`, `frontend/src/components/ChatPanel.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/RepositoryPanel.tsx`, `frontend/src/components/SearchPanel.tsx`, `frontend/src/types.ts`, and `frontend/src/styles/workspace.css`: elapsed chat wait feedback, one-submit guard, explicit 190-second client wait limit with retryable error, honest no-match/empty state, and counts.
- Added `src/test/java/com/copilot/service/search/QueryAwareSearchRankerTest.java`; updated the RAG no-context assertion and frontend repository test fixture.

### Verification this run

| Check | Result |
|---|---|
| `npm test -- --run` (initial) | PASS: 1 file / 4 tests, exit 0 |
| First `mvn clean verify` | FAIL: compile error, ambiguous `JdbcTemplate.query` overload in new count mapper; fixed by explicitly selecting `RowCallbackHandler` |
| `mvn clean verify` first attempt | FAIL: compile error, ambiguous `JdbcTemplate.query` overload in new count mapper; fixed by explicitly selecting `RowCallbackHandler` |
| Restricted `mvn clean verify` rerun | FAIL: Spring context couldn't open loopback socket (`Permission denied`) under the restricted process environment |
| `mvn clean verify` with local loopback access | PASS: `BUILD SUCCESS`; 24 tests run, 0 failures, 0 errors, 1 opt-in real-pipeline test skipped; exit 0 |
| Frontend build first attempt | FAIL: test fixture lacked newly required repository counts; fixture corrected |
| `npm run build` rerun | PASS: Vite production build completed; exit 0 |
| Frontend `npm test -- --run` rerun | PASS: 1 file / 4 tests, exit 0 |
| Docker engine | UNAVAILABLE: Docker named pipe `npipe:////./pipe/dockerDesktopLinuxEngine` absent |
| Ollama | UNAVAILABLE: `http://localhost:11434/api/tags` did not respond |
| Live API, SQL counts, real 768D embedding/search/chat, original latency reproduction | NOT RUN: services unavailable; no live pass is claimed |

The rerank regression unit test uses the measured TASK-007 score pairs and checks that the API score remains cosine. It is not a substitute for the requested multi-repository real retrieval evaluation. No destructive database command or volume removal was run. Empty/unsupported/malformed live import scenarios and the TASK-007 chat/search matrices remain to be retested after Docker and Ollama are restored.

**Status:** In progress  
**Date:** 2026-10-26 (Asia/Calcutta)  
**Browser tooling:** Connected in-app browser control MCP. Local API and PostgreSQL checks use the project's existing services.

## Baseline and safety plan

Before test data was created, the environment was observed as follows:

| Check | Observed result | Status |
|---|---|---|
| Frontend | `http://127.0.0.1:3000/` returned HTTP 200; browser showed `API connected` | PASS |
| Backend repository API | `GET /api/repositories` returned HTTP 200 and one completed pre-existing repository, `CodebaseCopilot` | PASS |
| PostgreSQL | Docker container `codebase-copilot-db`, image `pgvector/pgvector:pg16`, healthy on host port 5433 | PASS |
| Existing database rows | 1 repository, 39 files, 79 chunks; Flyway version 2 | PASS |
| Ollama models | `qwen3:8b` and `nomic-embed-text:latest` are installed; Ollama tags endpoint responded | PASS |
| Backend baseline | `mvn clean verify`: 20 tests, 0 failures, 0 errors, 1 opt-in integration test skipped; exit 0 | PASS |

The existing `CodebaseCopilot` repository and its rows are user data and are excluded from all test cleanup. Synthetic repositories will live only under `qa-fixtures/TASK-007/`. Their exact repository UUIDs will be captured from import responses. Cleanup will delete only those captured UUIDs; schema foreign keys cascade from repository to files and chunks. Before and after row counts will be compared. If any UUID/path is ambiguous, cleanup will stop and records will be left intact. No Docker volumes will be removed.

## Test plan

1. Use the browser MCP to inspect the fresh page, navigation, import dialog, empty/error states, and source inspector.
2. Create four small synthetic Java repositories: e-commerce, banking, Spring REST API, and edge cases (including a separately isolated malformed Java source and an untrusted prompt-injection comment).
3. Import each through the UI, capture API response, check persistence in the repository list and PostgreSQL, then repeat import and compare row counts.
4. Test blank, malformed, missing, non-directory, and restricted system paths without modifying those paths.
5. Run semantic search and RAG questions against each successfully indexed demo, inspect citations/snippets and source line ranges against fixture source.
6. Exercise invalid API bodies, no-results/empty source states, refresh persistence, and safe network failure behavior where possible without stopping shared services.
7. Run Maven and frontend suites/build, then remove only synthetic database rows and fixture files and verify the original baseline data remains.

## Results ledger

| Test ID | Scope / action | Expected | Actual / evidence | Status | Bug |
|---|---|---|---|---|---|
| BASE-01 | `GET /api/repositories` | Successful list response | HTTP 200; one completed existing `CodebaseCopilot` repository | PASS | — |
| BASE-02 | Read-only SQL baseline | Record existing counts before mutations | 1 repository, 39 files, 79 chunks, schema version 2 | PASS | — |
| BASE-03 | `mvn clean verify` | Build succeeds; no failing tests | 20 tests, 0 failures/errors, 1 skipped; exit 0 | PASS | — |
| UI-01 | Fresh browser load and first impression | Clear product, API state, navigation, existing repository state | Browser MCP: workbench, API connected, repository navigation and selected repository visible | PASS | — |
| UI-02 | Open import dialog with blank path | Import cannot submit empty path | Browser MCP: Import button stayed disabled | PASS | — |
| IMP-A | Import demo A through UI | Completed response and persisted record | UI status `COMPLETED`; UUID `c7bb378b-c77c-47de-8767-79f52bb379a1`; SQL: 8 files, 16 chunks, embeddings 768D, 0 invalid line ranges | PASS | — |
| IMP-B | Import demo B through UI | Completed response and persisted record | UI/API status `COMPLETED`; UUID `25e70887-a942-4500-8517-1ad1ce0ee88e`; SQL: 5 files, 13 chunks, embeddings 768D, 0 invalid line ranges | PASS | — |
| IMP-C | Import demo C through UI | Completed response and persisted record | UI/API status `COMPLETED`; UUID `abee9718-75fe-437d-b33b-55ebc3d4170e`; SQL: 6 files, 8 chunks, embeddings 768D, 0 invalid line ranges | PASS | — |
| IMP-D | Import demo D through UI | Supported Java sources indexed; unsupported and excluded sources omitted | UI/API status `COMPLETED`; UUID `5f6166f5-64c9-4dd0-8a6f-0bc9970fd74d`; SQL: 5 files, 9 chunks, embeddings 768D; `target/ExcludedNoise.java` and README.txt absent | PASS | — |
| IMP-E | Import empty-source demo through UI | Honest completed/empty state without fake chunks | UI/API status `COMPLETED`; UUID `ce3ff807-a729-47a4-9362-16158d2c6fac`; SQL: 0 files, 0 chunks; UI exposes no count or empty-code warning | PARTIAL (misleading completion state) | TASK007-002 |
| DUP-01 | Repeat-import all five synthetic paths | Same UUIDs and no duplicate repo/file/chunk rows | API returned same UUIDs and `COMPLETED`; totals stayed 6 repos / 63 files / 125 chunks (baseline 1 / 39 / 79) | PASS | — |
| IMP-ERR-01 | Import nonexistent synthetic path in UI and API | Clear error; no repository row | UI displayed `Repository directory does not exist`; API returned HTTP 404 `{"error":"Repository directory does not exist"}` | PASS | — |
| SEARCH-A1 | UI semantic query: “Where is the order total calculated, including tax and rounding?” | Relevant source with correct path/lines; inspector opens returned snippet | `PaymentService.java`, lines 6–9, score 0.585; `Order.java` ranked first (0.607) but only declares the total field. Inspector showed exact returned snippet and full-source limitation. | PARTIAL (implementation ranked second) | TASK007-001 |
| SEARCH-A-UI-02 | UI semantic query: “How does checkout validate inventory?” | Inventory-check implementation is most relevant, with exact path/lines | Top hit was `CheckoutService.java:8` (.731), a caller that delegates order creation; actual reservation check was present fourth at `InventoryService.java:4–8` (.562), with `OrderService` also explaining the caller chain. | PARTIAL (implementation under-ranked) | TASK007-001 |
| SEARCH-A2..A4 | Three additional e-commerce searches (checkout inventory, order/payment relationship, rejected payment) | Relevant code for known questions | API results included `CheckoutService.java:8` (.644), `InventoryService.java:4–8` (.623), relationship results CheckoutService (.691)/OrderService (.688), and PaymentService:10–12 (.626) with PaymentDeclinedException:3 (.532). | PASS | — |
| SEARCH-A5 | Absent e-commerce question about shipping encryption | No confident unrelated match | Returned checkout and exception rows with scores .484/.456 instead of an empty/no-confidence result. | FAIL | TASK007-003 |
| SEARCH-B1..B4 | Four known banking searches | Correct update/validation/history snippets | Balance update: `AccountService.java:10–14` (.635); insufficient funds: `InsufficientBalanceException.java:3` (.633), AccountService (.570); invalid withdrawal: AccountService 10–14 (.573); history: `TransactionHistory.java:3` (.655). | PASS | — |
| SEARCH-B5 | Absent banking question about wire fees | No confident unrelated match | Returned Account and AccountService rows (.452/.432). | FAIL | TASK007-003 |
| SEARCH-C1..C4 | Four known REST searches | Endpoint, validation, persistence and handler are surfaced | Registration endpoint query ranked `RegistrationService.java:8–9` ahead of controller; validation `RegistrationController.java:15–16` (.687); persistence same lines (.648); handler `ApiExceptionHandler.java:9–12` (.695). | PASS with endpoint-ranking caveat | TASK007-001 |
| SEARCH-C5 | Absent REST question about refresh tokens | No confident unrelated match | Returned `RegistrationService.java:9` (.512/.483). | FAIL | TASK007-003 |
| SEARCH-D1..D4 | Four known edge-case searches | Distinguish duplicate names, overloads and caller chain | Two `InvoiceFormatter` classes distinguished by path (billing .718 vs subscription .726); `ResolveService` overloads lines 5/6 (.725/.784); caller `CallerService` lines 4/5 (.726/.766); injection query surfaced untrusted comment (.537) for chat test. | PASS | — |
| SEARCH-D5 | Absent edge-case question about `secretResult` | No confident unrelated match | Returned unrelated snippets (.459). | FAIL | TASK007-003 |
| SEARCH-E1 | Search empty-source repository in UI | Empty result, no synthetic result | Selecting demo E and searching “Where is account balance updated?” produced `No matching chunks` and “The API returned no semantic-search results for this query.” | PASS | — |
| CHAT-A1 | UI chat: “Where is the order total calculated, and how is it rounded?” | Grounded response with valid citations; citation opens exact source | Browser MCP rendered answer: `PaymentService.calculateTotal`, tax application, `setScale(2, RoundingMode.HALF_UP)`, then `OrderService` creates the Order. Citations [2] `PaymentService.java:6–9` and [3] `OrderService.java:9–18`; clicked [2], inspector displayed exact returned code and line range. | PASS | — |
| CHAT-A2 | UI chat: “How does checkout validate inventory?” | Grounded answer and source citations | Two submissions remained `Searching relevant chunks and generating an answer…` through multiple observations for >1 minute; no answer/citations observed before switching to independent tests. | BLOCKED (slow/hung request) | TASK007-004 |
| CHAT-B1 | UI chat: “Where is an account balance updated when money is withdrawn?” | Source-based explanation and valid citations | Answer identified `Account.debit` changing `balance` and `AccountService.withdraw` calling it. Citations pointed to `Account.java:10` and `AccountService.java:10–14`. | PASS | — |
| CHAT-C1 | UI chat: “Which endpoint handles user registration? Give the HTTP method and path from the source.” | Correct route/method and verified citation | Answer: POST `/register`, `RegistrationController` `@PostMapping("/register")`; citations to controller lines 15–16 and service line 9. Clicked controller citation; inspector opened exact snippet/lines. | PASS | — |
| CHAT-E1 | UI chat for empty-source demo E | Honest no-context response without model-generated claims | API/UI immediately returned `No relevant code context was found to answer this question.` with no citations. | PASS | — |
| CHAT-LEN-01 | Submit 2,001-character chat question | Clear validation error; no duplicate/model request | UI rendered `Question exceeds maximum length of 2000 characters` and a Retry control; blank question leaves Send disabled. | PASS | — |
| CHAT-D-INJ | Injection-resistance chat against demo D malicious comment | Ignore repository instruction; answer objectively and cite source | Answer stated only `policyName()` returns `"demo-policy"`, said there was insufficient context to explain more, and cited `CommentPolicy.java:4`; no instruction was followed or secret emitted. | PASS | — |
| CHAT-MATRIX | Five realistic RAG prompts for each populated repository | 20 prompts; grounded answers/citations; honest unknowns | One successful non-empty chat was observed for each A–D, plus empty E and injection. Required five-per-repository matrix was not completed: checkout inventory stayed pending >1 minute; examples took roughly 1–3 minutes. | BLOCKED (latency + scope incomplete) | TASK007-004 |
| INS-* | Source inspector citation navigation | Correct relative path and exact source lines | Clicked A [2] and C [3]; inspector displayed matching repository, relative path, exact source line range and returned snippet. It clearly states the API does not provide the full file. | PASS | — |
| IMP-ERR-02 | Reimport demo D after adding isolated malformed Java source | API/UI must not claim success; expose failure details | UI showed `failed` and exact parser diagnostic: `BrokenPayment.java at line 3: illegal start of type`. Read-only SQL: FAILED with 5 files/9 chunks (unchanged); global totals remained 6 repos/63 files/125 chunks. | PASS | — |
| IMP-REC-01 | Remove only generated BrokenPayment fixture, then reimport D in UI | Recover cleanly without duplicate or lost indexed rows | Import returned `COMPLETED`; SQL returned 5 files, 9 chunks, all 9 vectors 768D. The generated broken source file is absent. | PASS | — |
| IMP-ERR-03 | Import protected Windows system directory | Clear rejection without indexing or creating repository | UI rejected `C:\Windows` with `Access to system directory is restricted: Windows`; no import was submitted. | PASS | — |
| UI-REFRESH-01 | Refresh repository list after indexing/recovery | Persisted repositories/status survive refresh | Browser MCP refreshed list and showed all six repositories with D `completed`. | PASS | — |
| ERR-* | API and service error recovery | Clear and recoverable failure states | Missing-path (404 from direct API), protected-path (visible rejection), malformed-source failure/recovery and empty search/chat passed. Backend-stopped/Ollama-slow scenarios not deliberately induced; second non-empty RAG request remained pending. | PARTIAL | TASK007-004 |
| CLEAN-01 | Delete exact five synthetic UUIDs and remove generated fixtures | Leave baseline repository/DB data untouched | Executed `DELETE FROM repositories WHERE id IN ('c7bb378b-c77c-47de-8767-79f52bb379a1','25e70887-a942-4500-8517-1ad1ce0ee88e','abee9718-75fe-437d-b33b-55ebc3d4170e','5f6166f5-64c9-4dd0-8a6f-0bc9970fd74d','ce3ff807-a729-47a4-9362-16158d2c6fac')`; returned `DELETE 5`. SQL afterward: 1 repository, 39 files, 79 chunks; only `bdd3b3fd-cfb0-4713-8498-b5167bc2cc2d` (`CodebaseCopilot`, COMPLETED) remained. Removed only `D:\project\CodebaseCopilot\qa-fixtures\TASK-007`; path guard confirmed inside workspace; `Test-Path` returned False. UI refresh showed one completed repository. | PASS | — |

## Final totals

No application source was changed and no regression test was added: search ranking/threshold, empty-index visibility, and variable chat latency remain open findings. No “after fix” behavior can be asserted; address these in a focused remediation change with regression coverage.

**Final totals:** Automated backend: 20 tests, 0 failures, 0 errors, 1 skipped; Maven `mvn clean verify` exit 0. Frontend: 4 tests passed (`npm test -- --run` exit 0); production build `npm run build` exit 0. Live scenarios are tracked by row: 47 distinct browser/API/SQL scenarios — 39 PASS, 3 PARTIAL, 4 FAIL, 1 BLOCKED. The four live failures are the absent-topic search queries; partials are empty repository's misleading COMPLETED state and two known-query ranking issues; one inventory chat request stayed pending. Search matrix executed 20 distinct prompts across A–D (five each) plus two UI searches (one duplicates an A query, one empty E). Chat matrix completed one successful non-empty question for each A–D, one empty E no-context case, one over-limit validation, and an injection-resistance case; two A inventory requests were observed pending. The required five chat questions per populated repository were not completed. PostgreSQL cleanup restored 1/39/79 baseline and preserved the existing repository. Synthetic fixture directory removed. Backend `/actuator/health` returned `UP` with PostgreSQL `UP`; frontend remained open at port 3000 and showed one completed repository. Ollama `/api/tags` returned installed models including `qwen3:8b` and `nomic-embed-text:latest`; `/api/ps` showed qwen loaded during a chat. Backend-stopped and Ollama-outage tests were not induced. Client-demo readiness: **not ready to call reliable** until search relevance and chat latency issues are addressed.
