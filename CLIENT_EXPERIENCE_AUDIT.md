# TASK-007 — Client Experience Audit

## TASK-011 audit update — 2026-10-26 to 2026-10-27

**Status: warmer-request latency improved, but not yet client-demo ready.** The qwen3:8b checkout/inventory request was reproduced as HTTP 504 at 180.3 seconds. On the same CPU-only i5-1135G7/16 GB machine, a direct qwen3.5:4b run over the same five retrieved excerpts took 346.2 seconds cold; 328.8 seconds were model loading, while prompt evaluation and 93-token generation were about 7.7 and 9.5 seconds. Warm direct repeats and live Spring API repeats were much faster, showing cold/idle model residency is a large source of variability.

The live Spring app using qwen3.5:4b returned checkout HTTP 200 in 110.2 seconds on its first call, then 15.7 and 14.6 seconds on two repeated warm calls. Inventory answers returned HTTP 200 in 21.4 seconds, 98.1 seconds after an idle gap, then 20.7 seconds on immediate repeat. The answer text and returned citation ranges were checked against the isolated Java fixture. The absent-topic chat returned the existing no-confident-context response without citations. The application still does not stream tokens; progress is elapsed-time only, and the client/server wait limit is now 420 seconds with recoverable timeout messaging.

`RagChatService` keeps its one model call, shortens repeated prompt instructions without removing evidence/citation/untrusted-input rules, sets Qwen `think=false` and 384 output tokens, and logs prompt/context character counts and response token usage. qwen3.5:4b is selected in the ignored project `.env` and as the application fallback; keep-alive is 10 minutes. The direct Ollama benchmark’s TTFT was not measured, and the existing Spring endpoint cannot expose TTFT because it is non-streaming.

Verification: backend suite 26 tests/0 failures/0 errors/1 opt-in skip; real PostgreSQL/Ollama integration 1/1 passed; frontend tests 5/5 and production build passed. Live import repeat preserved the same UUID and counts. Cleanup restored exact original counts (1 repository/39 files/79 chunks/79 768D vectors) and retained the original completed repository. Browser navigation, rendered source-click behavior, responsive layout, and browser console/network checks remain unverified because local browser automation is disabled in this environment. Cold/idle waits remain too variable for a client-readiness claim.

The rebuilt backend is now running on port 8080, and the already-running Vite frontend proxy on port 3000 returned HTTP 200 for `/api/health`.

## TASK-010 audit update — 2026-10-26

**Status: partially verified; not client-demo ready.** This is a single-page workbench at `/` with client-side Chat, Search, and Repositories views (no nested router paths). Core controls and current request/response usage were inspected. Mocked frontend tests cover repository import success/error, search request and result inspector, chat request and citation inspector, and empty-index messaging. Live API/database checks covered isolated import, repeat import, search, chat/no-confidence, validation errors and source line references. The external guide and modal escape/backdrop/keyboard behavior were code-inspected but not browser-tested.

Docker is running PostgreSQL/pgvector on host port 5433. Baseline SQL was 1 repo/39 files/79 chunks/79 vectors and returned to exactly those counts after cleanup. Ollama returned a real 768-dimensional `nomic-embed-text` vector (5,642 ms on that direct call). The app ran at port 8080 and Vite at 3000; Vite root, proxied health and repository list returned HTTP 200. The desktop browser MCP reports local browser use disabled, so screenshots, full UI click/navigation, responsive layouts, and console/network inspection remain blocked.

The one verified client-facing copy defect was stale Source Inspector text claiming counts were unavailable; it was corrected. `mvn clean verify` passes 26 tests, 0 failures/errors, with 1 opt-in integration skipped; the opt-in real integration passed 1/1; `npm test -- --run` passes 5/5; `npm run build` passes. New backend tests cover `COMPLETED_EMPTY` and persisted/recoverable `FAILED` indexing. Live tests confirmed empty/unsupported imports, malformed failure and successful retry.

Live search results on an isolated four-file fixture and the preserved original repository placed expected implementation code near the top and returned zero for the tested absent topics. The implementation-vs-data-holder case returned `PaymentService#calculateTotal` first despite its lower cosine score. This limited sample supports the current 0.52 floor but does not replace the complete four-demo known/absent matrix. The checkout/inventory latency defect was reproduced: HTTP 504 after 180.7 seconds once; instrumented retry returned HTTP 200 after 104.5 seconds, with model inference taking 101.9 seconds while query embedding and DB retrieval took 417 ms and 92 ms. Ollama reported `qwen3:8b` at 100% CPU. This remains a serious client experience problem; there is no latency fix claimed. No original database rows or Docker volumes were changed; four exact test IDs were removed and baseline counts restored.

Interaction inventory and statuses are recorded in the TASK-010 section of `QA_TEST_REPORT.md`.

**Status:** In progress  
**Date:** 2026-10-26

## First impression observed with browser MCP

- The workbench opened at `http://127.0.0.1:3000/` and reported `API connected`.
- Main navigation exposes Chat, Search, and Repositories.
- A pre-existing completed `CodebaseCopilot` repository was visible; the repository pane says file/chunk totals are not exposed by the API.
- The source inspector correctly explains that it shows returned snippets rather than full file contents when no result is selected.
- The import dialog disables its submit button while the path is blank. A nonexistent path produced a visible, understandable error in the form.
- During real indexing, the submit control changed to `Indexing repository…` and was disabled; after the server response, the UI displayed `COMPLETED`.
- Empty-source directories are accepted as `COMPLETED` with zero files and chunks. The UI does not expose those counts, so “completed” can be mistaken for “code indexed.”
- A real semantic-search query returned the correct `PaymentService.calculateTotal` excerpt at lines 6–9. However, the `Order` record ranked above it because its cosine score was slightly higher.

## Client journey findings

The 20 live query set is recorded in `QA_TEST_REPORT.md`; UI search on demo A and empty demo E was also exercised. Search can rank callers/data holders above implementation code and return unrelated chunks for absent topics.
One UI chat each on demos A–D produced source-grounded responses; A and C citations opened exact path/line snippets. Chat for an empty repository clearly returned no context. A malicious-comment query ignored the injected instruction, stated insufficient context, and cited its source. A checkout-inventory request remained loading for several minutes without an observed answer; other non-empty replies were also slow. RAG responsiveness is an unresolved client concern, and the requested five-question-per-repository chat matrix was not completed.
Malformed Java source made the repository visibly `failed` with an exact parser diagnostic. SQL confirmed the prior five files/nine chunks were preserved; after removing only the test-created invalid source, reimport restored `completed` with the same counts and dimensions.
A 2,001-character UI chat submission returned a visible validation message; blank chat submission is disabled. A protected `C:\Windows` import was visibly rejected.

## Prioritized issues

- **TASK007-001 — P2, search ranking confidence:** For the e-commerce query “Where is the order total calculated, including tax and rounding?”, `Order.java` ranked first (0.607) while containing only a total field; `PaymentService.calculateTotal` ranked second (0.585). The implementation was available, but a first result could mislead a client. Reproduce after indexing demo A. Retrieval/reranking should be tuned and retested against all demos before calling search reliable.
- **TASK007-002 — P2, empty indexing ambiguity:** A directory with no Java files returns `COMPLETED`; the UI provides no indexed-file/chunk counts. Users cannot distinguish empty source from successful indexing. Confirmed against demo E: 0 files / 0 chunks in PostgreSQL.
- **TASK007-003 — P2, no low-relevance/unknown-topic guard:** The 20 live semantic-search queries for A–D included one absent-topic question per repository; every absent question still returned unrelated snippets (best scores roughly 0.43–0.51). The UI presents them as matching chunks without a confidence warning. Confirmed for absent shipping encryption, wire fee, refresh tokens, and `secretResult`.
- **TASK007-004 — P1, non-empty RAG responsiveness not reliable:** Two UI requests about checkout inventory stayed on “Searching relevant chunks and generating an answer…” through repeated observations for several minutes; no final response was observed. Backend health responded and the model appeared loaded during a subsequent check. Root cause remains unisolated; this blocks a reliable core chat journey.

## Readiness assessment

**Not ready for a confident client demo yet.** Repository import/list, duplicate idempotency, SQL persistence, 768D vectors, 20 search queries, empty search/chat behavior, grounded answers for A–D, and clickable source citations were observed. Malformed-source failure and recovery were confirmed. The prompt-injection comment did not override the system prompt. Unrelated results for absent questions and one multi-minute pending non-empty chat request can undermine trust or block the core journey. Backend-stopped and Ollama-outage scenarios were not induced; the required five-question-per-repository chat matrix remains incomplete. All TASK-007 synthetic rows and fixture files were cleaned; the original repository remains.
# TASK-008 update — 2026-10-26

**Readiness: not client-ready / verification incomplete.** Changes now distinguish an indexed repository from a successful empty scan (`COMPLETED_EMPTY` with indexed file/chunk counts), filter below the initial 0.52 vector-score floor, rerank behavior symbols using query-token overlap, and show chat elapsed time plus a recoverable 190-second client wait error. API logs capture request duration and service logs capture retrieval/model timings without source text or credentials.

The recorded TASK-007 behavior is the basis for fixes, but no live verification was possible in this session: Docker Desktop's engine pipe was missing and Ollama's tags endpoint was unavailable. Thus the original >1-minute checkout/inventory failure was not reproduced/retested, semantic search wasn't issued against PostgreSQL, and live empty/unsupported/malformed repository states were not checked. The score floor's evidence comes only from prior QA score snapshots (positive boundary .522, absent boundary .512), not a fresh all-demo evaluation. The five-query search and multi-question chat matrices, browser console/network review, and live citation checks remain open.

`QA_TEST_REPORT.md` contains this run's command-level outcomes and remaining work. No shared Docker volume or original repository records were removed.
