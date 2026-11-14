import { useState } from 'react';
import {
  MessageSquare,
  Search,
  FolderGit2,
  Plus,
  RefreshCw,
  ChevronDown,
  FileCode,
} from 'lucide-react';
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

export function RepositoryStatus({ status }: { status: string | null }) {
  const value = status || 'UNKNOWN';

  const toneClass =
    value === 'COMPLETED'
      ? 'completed'
      : value === 'COMPLETED_EMPTY'
        ? 'empty'
        : value === 'FAILED'
          ? 'failed'
          : value === 'INDEXING'
            ? 'indexing'
            : 'pending';

  // Integration test relies on 'no Java code' label
  const label =
    value === 'COMPLETED'
      ? 'COMPLETED'
      : value === 'COMPLETED_EMPTY'
        ? 'no Java code'
        : value === 'FAILED'
          ? 'FAILED'
          : value;

  return <span className={`status-badge ${toneClass}`}>{label}</span>;
}

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedRepo = repositories.find((r) => r.id === selectedRepositoryId);

  const navItems = [
    { id: 'chat' as WorkspaceView, label: 'Chat', icon: MessageSquare, shortcut: '1' },
    { id: 'search' as WorkspaceView, label: 'Search', icon: Search, shortcut: '2' },
    { id: 'repositories' as WorkspaceView, label: 'Repositories', icon: FolderGit2, shortcut: '3' },
  ];

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Top Repo Switcher */}
      <div className="sidebar-repo-selector">
        <button
          type="button"
          className="repo-select-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          aria-label="Active repository selector"
          title="Switch Active Repository"
        >
          <FolderGit2 size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          {selectedRepo ? (
            <span className="repo-select-name">{selectedRepo.name}</span>
          ) : (
            <span className="repo-select-placeholder">Select repository...</span>
          )}
          <ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
        </button>

        {dropdownOpen && (
          <div className="repo-dropdown" role="listbox">
            {repositories.map((repo) => (
              <button
                key={repo.id}
                type="button"
                className={`repo-dropdown-item ${repo.id === selectedRepositoryId ? 'active' : ''}`}
                onClick={() => {
                  onSelectRepository(repo);
                  setDropdownOpen(false);
                }}
              >
                <FolderGit2 size={12} />
                <span className="truncate" style={{ flex: 1 }}>{repo.name}</span>
                <span className="repo-dropdown-item-status">{repo.indexedFileCount} files</span>
              </button>
            ))}
            <button
              type="button"
              className="repo-dropdown-import"
              onClick={() => {
                setDropdownOpen(false);
                onImport();
              }}
            >
              <Plus size={12} />
              <span>Import repository</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="sidebar-nav" aria-label="Workspace views">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={14} className="nav-icon" />
              <span style={{ flex: 1 }}>{item.label}</span>
              <kbd className="kbd" style={{ fontSize: 9 }}>{item.shortcut}</kbd>
            </button>
          );
        })}
      </nav>

      {/* Repository Section — Untracked sentence case (Hallmark Floor 9) */}
      <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 }}>
        <span>Repositories</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {repositories.length}
        </span>
      </div>

      <div style={{ padding: '0 8px 6px' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center', gap: 6 }}
          onClick={onImport}
        >
          <Plus size={11} />
          <span>[+] Import repository</span>
        </button>
      </div>

      <div className="sidebar-repo-list">
        {loading ? (
          <p style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }} role="status">
            Loading repositories…
          </p>
        ) : repositories.length === 0 ? (
          <p style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>
            No repositories imported.
          </p>
        ) : (
          repositories.map((repo) => {
            const isSelected = repo.id === selectedRepositoryId;
            return (
              <button
                key={repo.id}
                type="button"
                className={`sidebar-repo-item ${isSelected ? 'selected' : ''}`}
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => onSelectRepository(repo)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span className="sidebar-repo-item-name">{repo.name}</span>
                  <RepositoryStatus status={repo.indexingStatus} />
                </div>
                <div className="sidebar-repo-item-meta">
                  <span>{repo.indexedFileCount} files, {repo.indexedChunkCount} chunks</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onRefresh}
          disabled={loading}
          style={{ fontSize: 11, padding: '2px 6px' }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          <span>Refresh list</span>
        </button>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>v1.0.0</span>
      </div>
    </aside>
  );
}
