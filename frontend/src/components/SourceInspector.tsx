import type { Repository, SourceExcerpt } from '../types';
import { RepositoryStatus } from './Sidebar';

interface SourceInspectorProps {
  repository: Repository | null;
  source: SourceExcerpt | null;
}

export function SourceInspector({ repository, source }: SourceInspectorProps) {
  if (!source) {
    return (
      <aside className="inspector" aria-label="Source inspector">
        <div className="inspector-heading"><h2>Source inspector</h2><span className="bracket-mark">[ ]</span></div>
        {repository ? (
          <div className="inspector-repository">
            <p className="muted-copy">Selected repository</p>
            <strong>{repository.name}</strong>
            <code>{repository.sourcePath}</code>
            <RepositoryStatus status={repository.indexingStatus} />
          </div>
        ) : (
          <div className="inspector-empty"><span aria-hidden="true">[ ]</span><p>Select a search result or citation to inspect its returned snippet.</p></div>
        )}
        <p className="inspector-note">The API provides indexed-file and chunk counts, but not full file contents.</p>
      </aside>
    );
  }

  const lines = source.content.split('\n');
  return (
    <aside className="inspector" aria-label="Source inspector">
      <div className="inspector-heading"><h2>Source inspector</h2><span className="bracket-mark">[x]</span></div>
      <div className="source-meta">
        <code className="source-path">{source.filePath}</code>
        <span>Lines {source.startLine}–{source.endLine}</span>
        {source.score !== undefined && <span>Score {source.score.toFixed(3)}</span>}
        {source.citationId !== undefined && <span>Citation [{source.citationId}]</span>}
      </div>
      <p className="excerpt-warning">Returned snippet only; full source is not available through the current API.</p>
      {lines.length > 0 && source.content ? (
        <pre className="source-code" aria-label={`${source.filePath}, lines ${source.startLine} through ${source.endLine}`}>
          <code>{lines.map((line, index) => (
            <span className="code-line" key={`${source.startLine}-${index}`}>
              <span className="line-number" aria-hidden="true">{source.startLine + index}</span>
              <span className="line-content">{line || ' '}</span>
            </span>
          ))}</code>
        </pre>
      ) : <p className="muted-copy">The API returned no snippet content for this source.</p>}
      {repository && <p className="inspector-repository-label">Repository: {repository.name}</p>}
    </aside>
  );
}
