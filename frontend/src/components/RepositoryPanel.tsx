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
                  <strong>Scan completed; no Java code was indexed.</strong>
                  <p>Add supported `.java` files to this folder or import a Java project, then refresh or import it again.</p>
                </div>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
