import {
  FolderGit2,
  Plus,
  Calendar,
  AlertTriangle,
  FileCode,
} from 'lucide-react';
import type { Repository } from '../types';
import { RepositoryStatus } from './Sidebar';
import { EmptyWorkspace } from './ChatPanel';
import { SpotlightCard } from './reactbits/SpotlightCard';

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
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
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
          <Plus size={13} />
          <span>Import repository</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'center' }}>
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
              <SpotlightCard
                key={repo.id}
                role="button"
                tabIndex={0}
                className={`repo-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(repo)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(repo);
                }}
              >
                <div className="repo-card-row">
                  <div className="repo-card-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <FolderGit2 size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <h3 className="repo-card-name">{repo.name}</h3>
                      <RepositoryStatus status={repo.indexingStatus} />
                      {isSelected && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, marginLeft: 4 }}>
                          [active]
                        </span>
                      )}
                    </div>
                    <p className="repo-card-path" title={repo.sourcePath}>
                      {repo.sourcePath}
                    </p>
                  </div>

                  <div className="repo-card-stats">
                    <span>{repo.indexedFileCount} files</span>
                    <span>{repo.indexedChunkCount} chunks</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{dateLabel(repo.createdAt)}</span>
                  </div>
                </div>

                {repo.indexingStatus === 'COMPLETED_EMPTY' && (
                  <div className="repo-card-alert" role="status">
                    <div className="repo-card-alert-header">
                      <AlertTriangle size={13} />
                      <span>Scan completed; no Java code was indexed.</span>
                    </div>
                    <p className="repo-card-alert-text">
                      Add supported `.java` files to this folder or import a Java project, then refresh or import it again.
                    </p>
                  </div>
                )}
              </SpotlightCard>
            );
          })}
        </div>
      )}
    </section>
  );
}
