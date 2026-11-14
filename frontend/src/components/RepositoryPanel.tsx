import {
  FolderGit2,
  Plus,
  FileCode,
  Layers,
  Calendar,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';
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
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RepositoryPanel({
  repositories,
  selectedRepository,
  loading,
  onSelect,
  onImport,
}: RepositoryPanelProps) {
  return (
    <section className="repos-view" aria-labelledby="repositories-view-title">
      <div className="repos-view-header">
        <div>
          <h1 id="repositories-view-title" className="repos-view-title">
            Repositories
          </h1>
          <p className="repos-view-sub">
            Local Java workspaces indexed with pgvector & Ollama embeddings.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onImport}>
          <Plus size={14} />
          <span>Import repository</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }} role="status">
            Loading repositories…
          </p>
        </div>
      ) : repositories.length === 0 ? (
        <EmptyWorkspace
          title="No repositories yet"
          description="Import an absolute local path to index a Java project."
        />
      ) : (
        <div className="repos-grid">
          {repositories.map((repo) => {
            const isSelected = selectedRepository?.id === repo.id;
            return (
              <div
                key={repo.id}
                role="button"
                tabIndex={0}
                className={`repo-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(repo)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(repo);
                }}
              >
                <div className="repo-card-top">
                  <div className="repo-card-icon">
                    <FolderGit2 size={16} />
                  </div>
                  <RepositoryStatus status={repo.indexingStatus} />
                </div>

                <div>
                  <h3 className="repo-card-name">{repo.name}</h3>
                  <p className="repo-card-path" title={repo.sourcePath}>
                    {repo.sourcePath}
                  </p>
                </div>

                <div className="repo-card-stats">
                  <div className="repo-stat">
                    <span className="repo-stat-value">{repo.indexedFileCount}</span>
                    <span className="repo-stat-label">Files</span>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div className="repo-stat">
                    <span className="repo-stat-value">{repo.indexedChunkCount}</span>
                    <span className="repo-stat-label">Chunks</span>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div className="repo-stat">
                    <span className="repo-stat-value" style={{ fontSize: 11, fontWeight: 500 }}>
                      {repo.sourceType}
                    </span>
                    <span className="repo-stat-label">Source</span>
                  </div>
                </div>

                <div className="repo-card-footer">
                  <span style={{ fontSize: 10, color: 'var(--text-xmuted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={10} />
                    {dateLabel(repo.createdAt)}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
                      Active
                    </span>
                  )}
                </div>

                {repo.indexingStatus === 'COMPLETED_EMPTY' && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      background: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.2)',
                      borderRadius: 'var(--r-md)',
                      fontSize: 11,
                    }}
                    role="status"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fde68a', fontWeight: 600 }}>
                      <AlertTriangle size={13} />
                      <span>Scan completed; no Java code was indexed.</span>
                    </div>
                    <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.4 }}>
                      Add supported `.java` files to this folder or import a Java project, then refresh or import it again.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
