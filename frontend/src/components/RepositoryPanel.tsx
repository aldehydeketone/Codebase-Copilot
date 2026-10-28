import type { Repository } from '../types';
import { RepositoryStatus } from './Sidebar';
import { EmptyWorkspace } from './ChatPanel';

interface RepositoryPanelProps {
  repositories: Repository[];
  selectedRepository: Repository | null;
  loading: boolean;
  onSelect: (repository: Repository) => void;
  onImport: () => void;
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not reported';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export function RepositoryPanel({ repositories, selectedRepository, loading, onSelect, onImport }: RepositoryPanelProps) {
  return (
    <section className="workspace-view repositories-view" aria-labelledby="repositories-view-title">
      <div className="view-heading"><div><h1 id="repositories-view-title">Repositories</h1><p>Local projects available to this Codebase Copilot backend.</p></div><button type="button" className="action-button" onClick={onImport}>Import repository</button></div>
      {loading ? <p className="loading-line" role="status">Loading repositories…</p> : repositories.length === 0 ? (
        <EmptyWorkspace title="No repositories yet" description="Import an absolute local path to index a Java project." />
      ) : (
        <div className="repository-workspace">
          <div className="repository-table" role="group" aria-label="Imported repositories">
            {repositories.map((repository) => (
              <button type="button" key={repository.id} className={`repository-row ${selectedRepository?.id === repository.id ? 'is-selected' : ''}`} onClick={() => onSelect(repository)}>
                <span className="repository-row-main"><strong>{repository.name}</strong><code>{repository.sourcePath}</code></span>
                <span>{repository.sourceType}</span><RepositoryStatus status={repository.indexingStatus} />
              </button>
            ))}
          </div>
          {selectedRepository && (
            <article className="repository-detail">
              <div className="detail-title"><div><p className="muted-copy">Selected repository</p><h2>{selectedRepository.name}</h2></div><RepositoryStatus status={selectedRepository.indexingStatus} /></div>
              <dl className="metadata-list">
                <div><dt>Source type</dt><dd>{selectedRepository.sourceType}</dd></div>
                <div><dt>Source path</dt><dd><code>{selectedRepository.sourcePath}</code></dd></div>
                <div><dt>Indexed Java files</dt><dd>{selectedRepository.indexedFileCount}</dd></div>
                <div><dt>Indexed code chunks</dt><dd>{selectedRepository.indexedChunkCount}</dd></div>
                <div><dt>Created</dt><dd>{dateLabel(selectedRepository.createdAt)}</dd></div>
                <div><dt>Updated</dt><dd>{dateLabel(selectedRepository.updatedAt)}</dd></div>
              </dl>
              {selectedRepository.errorDetails && <p className="inline-error" role="alert">{selectedRepository.errorDetails}</p>}
              {selectedRepository.indexingStatus === 'COMPLETED_EMPTY' && (
                <div className="empty-index-guidance" role="status">
                  <div className="empty-index-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="16" r="0.75" fill="currentColor" />
                      <path d="M12 10a1.5 1.5 0 0 1 1.5 1.5c0 1-1.5 1.5-1.5 2.5" />
                    </svg>
                  </div>
                  <h3 className="empty-index-title">No Java files found</h3>
                  <p className="empty-index-subtitle">This folder has 0 .java files. Point to a Maven or Gradle project.</p>
                  <code className="empty-index-path">{selectedRepository.sourcePath}</code>
                  <div className="empty-index-actions">
                    <button type="button" className="action-button" onClick={onImport}>
                      Import a different repository
                    </button>
                  </div>
                  <div className="empty-index-subtext">
                    <strong>Scan completed; no Java code was indexed.</strong>
                    <p>Add supported `.java` files to this folder or import a Java project, then refresh or import it again.</p>
                  </div>
                </div>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
