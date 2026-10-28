import type { Repository, WorkspaceView } from '../types';

interface SidebarProps {
  repositories: Repository[];
  selectedRepositoryId: string | null;
  activeView: WorkspaceView;
  loading: boolean;
  onNavigate: (view: WorkspaceView) => void;
  onSelectRepository: (repository: Repository) => void;
  onImport: () => void;
  onRefresh: () => void;
}

const navigation: { id: WorkspaceView; label: string; marker: string }[] = [
  { id: 'chat', label: 'Chat', marker: '[>]' },
  { id: 'search', label: 'Search', marker: '[?]' },
  { id: 'repositories', label: 'Repositories', marker: '[=]' },
];

export function Sidebar({
  repositories,
  selectedRepositoryId,
  activeView,
  loading,
  onNavigate,
  onSelectRepository,
  onImport,
  onRefresh,
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand"><span className="brand-mark">[ cc ]</span><span>codebase copilot</span></div>

      <nav className="primary-nav" aria-label="Workspace views">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeView === item.id ? 'is-active' : ''}`}
            aria-current={activeView === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span aria-hidden="true">{item.marker}</span>{item.label}
          </button>
        ))}
      </nav>

      <section className="repository-rail" aria-labelledby="repository-list-title">
        <div className="rail-title-row">
          <h2 id="repository-list-title">Repositories</h2>
          <span className="count-badge" aria-label={`${repositories.length} repositories`}>{repositories.length}</span>
        </div>
        <button type="button" className="import-trigger" onClick={onImport}>[+] Import repository</button>
        {loading ? (
          <p className="rail-hint" role="status">Loading repositories…</p>
        ) : repositories.length === 0 ? (
          <p className="rail-hint">No repositories imported.</p>
        ) : (
          <ul className="repository-list">
            {repositories.map((repository) => (
              <li key={repository.id}>
                <button
                  type="button"
                  className={`repository-item ${repository.id === selectedRepositoryId ? 'is-selected' : ''}`}
                  aria-current={repository.id === selectedRepositoryId ? 'true' : undefined}
                  onClick={() => onSelectRepository(repository)}
                >
                  <span className="repository-name">{repository.name}</span>
                  <RepositoryStatus status={repository.indexingStatus} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="quiet-link" onClick={onRefresh} disabled={loading}>Refresh list</button>
      </section>
      <div className="sidebar-footer"><span className="state-mark" aria-hidden="true">[·]</span> Local workspace</div>
    </aside>
  );
}

export function RepositoryStatus({ status }: { status: string | null }) {
  const value = status || 'UNKNOWN';
  if (value === 'INDEXING') {
    return (
      <span className="status-badge status-running">
        <span className="badge-pulse-dot" aria-hidden="true" />
        INDEXING
      </span>
    );
  }
  const tone = value === 'COMPLETED'
    ? 'status-done'
    : value === 'COMPLETED_EMPTY'
      ? 'status-empty'
      : value === 'FAILED'
        ? 'status-failed'
        : 'status-pending';
  // Note: 'no Java code' is required by integration tests
  const label = value === 'COMPLETED'
    ? 'COMPLETED'
    : value === 'COMPLETED_EMPTY'
      ? 'no Java code'
      : value === 'FAILED'
        ? 'FAILED'
        : value;
  return <span className={`status-badge ${tone}`}>{label}</span>;
}
