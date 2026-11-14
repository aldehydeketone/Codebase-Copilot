import { useRef, useState, type FormEvent } from 'react';
import { Search, FileCode, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { Repository, SearchResult, SourceExcerpt } from '../types';
import { EmptyWorkspace } from './ChatPanel';

interface SearchPanelProps {
  repository: Repository | null;
  onInspect: (source: SourceExcerpt) => void;
}

export function SearchPanel({ repository, onInspect }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  async function runSearch(value: string) {
    if (!repository || pending.current || !value.trim()) return;
    pending.current = true;
    setError('');
    setLoading(true);
    try {
      const items = await api.search({
        query: value.trim(),
        repositoryId: repository.id,
        limit: 10,
      });
      setResults(items);
      setSearched(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Search request failed.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  return (
    <section className="search-view" aria-labelledby="search-view-title">
      <div className="search-view-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 id="search-view-title" className="search-view-title">
              Semantic Code Search
            </h1>
            <p className="search-view-sub">
              {repository
                ? `Vector embedding similarity search across ${repository.name}`
                : 'Select a repository to search.'}
            </p>
          </div>
          {repository && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Top 10 embeddings
            </span>
          )}
        </div>

        {repository && (
          <form onSubmit={submit} className="search-input-wrap">
            <Search size={15} className="search-input-icon" />
            <label htmlFor="code-search-query" className="sr-only">
              Search by intent or behavior
            </label>
            <input
              id="code-search-query"
              className="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by intent or behavior (e.g. 'JWT token validation filter' or 'database URL configuration')..."
              disabled={loading}
              autoFocus
            />
            <div style={{ display: 'none' }}>
              <button type="submit">Search code</button>
            </div>
            <div
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                gap: 6,
              }}
            >
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={loading || !query.trim()}
              >
                {loading ? 'Searching…' : 'Search code'}
              </button>
            </div>
          </form>
        )}
      </div>

      {!repository ? (
        <EmptyWorkspace
          title="No repository selected"
          description="Choose an indexed repository from the sidebar to run semantic vector search."
        />
      ) : (
        <>
          {error && (
            <div style={{ padding: '12px 24px' }}>
              <div className="inline-error-msg" role="alert">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            </div>
          )}

          {!searched && !loading ? (
            <div className="empty-workspace-state">
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--r-xl)',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                }}
              >
                <Sparkles size={20} />
              </div>
              <h2 style={{ fontSize: 15, color: 'var(--text-primary)' }}>Vector Similarity Search</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
                Query by natural language behavior, algorithm, or intent. The nomic-embed-text model maps questions into the Java codebase embedding space.
              </p>
            </div>
          ) : loading ? (
            <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
              <div className="thinking-indicator" role="status">
                <div className="thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span>Embedding query & querying pgvector database…</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="empty-workspace-state">
              <p>No matching code snippets found for this query.</p>
            </div>
          ) : (
            <div className="search-results" aria-label="Search results">
              {results.map((result, idx) => (
                <button
                  type="button"
                  key={`${result.filePath}-${result.startLine}-${idx}`}
                  className="search-result-card"
                  onClick={() =>
                    onInspect({
                      filePath: result.filePath,
                      startLine: result.startLine,
                      endLine: result.endLine,
                      content: result.content,
                      score: result.score,
                    })
                  }
                  title={`Inspect ${result.filePath}`}
                >
                  <div className="search-result-header">
                    <span className="search-result-path">
                      <FileCode size={13} />
                      <strong>{result.filePath}</strong>
                    </span>
                    <div className="search-result-meta">
                      <span>
                        Lines {result.startLine}–{result.endLine}
                      </span>
                      <span className="search-result-score">
                        Score {result.score.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <pre className="search-result-snippet">
                    <code>{result.content}</code>
                  </pre>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
