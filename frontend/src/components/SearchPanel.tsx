import { useRef, useState, type FormEvent } from 'react';
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
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      setResults(await api.search({ query: value.trim(), repositoryId: repository.id, limit: 10 }));
    } catch (caught) {
      setResults([]);
      setError(caught instanceof Error ? caught.message : 'Search failed.');
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
    <section className="workspace-view search-view" aria-labelledby="search-view-title">
      <div className="view-heading"><div><h1 id="search-view-title">Semantic search</h1><p>{repository ? `Search indexed chunks in ${repository.name}.` : 'Select a repository before searching its indexed code.'}</p></div><span className="heading-marker" aria-hidden="true">[?]</span></div>
      {!repository ? <EmptyWorkspace title="No repository selected" description="Import a local Java repository, then choose it in the left sidebar." /> : (
        <>
          <form className="search-form" onSubmit={submit}>
            <label htmlFor="semantic-query">Search by intent or behavior</label>
            <div className="search-row"><input id="semantic-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Where is the database connection configured?" required disabled={loading} /><button className="action-button" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search code'}</button></div>
          </form>
          {error && <div className="inline-error" role="alert"><span>{error}</span><button type="button" className="quiet-link" onClick={() => void runSearch(query)} disabled={loading}>Retry</button></div>}
          {loading ? <p className="loading-line" role="status">Searching with the configured embedding model…</p> : searched && results.length === 0 && !error ? <div className="empty-workspace compact-empty"><span className="empty-mark" aria-hidden="true">[ ]</span><h2>No confident code matches</h2><p>Try a more specific behavior, class, or method name. Search hides low-confidence matches that are likely unrelated.</p></div> : (
            <div className="search-results" aria-live="polite">
              {results.map((result, index) => (
                <button type="button" className="search-result" key={`${result.filePath}:${result.startLine}:${index}`} onClick={() => onInspect({ ...result })}>
                  <span className="result-title"><code>{result.filePath}</code><span>lines {result.startLine}–{result.endLine}</span></span>
                  <pre>{result.content}</pre>
                  <span className="result-score">Cosine similarity score: {result.score.toFixed(3)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
