import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Activity,
  AlertCircle,
  X,
  Terminal,
} from 'lucide-react';
import { ChatPanel } from './components/ChatPanel';
import { CommandPalette } from './components/CommandPalette';
import { HealthMonitorModal } from './components/HealthMonitorModal';
import { RepositoryImportDialog } from './components/RepositoryImportDialog';
import { RepositoryPanel } from './components/RepositoryPanel';
import { SearchPanel } from './components/SearchPanel';
import { Sidebar } from './components/Sidebar';
import { SourceInspector } from './components/SourceInspector';
import { api } from './services/api';
import type {
  OverallHealthStatus,
  Repository,
  SourceExcerpt,
  SystemHealthResponse,
  WorkspaceView,
} from './types';

const viewTitles: Record<WorkspaceView, string> = {
  chat: 'Chat',
  search: 'Search',
  repositories: 'Repositories',
};

export default function App() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [view, setView] = useState<WorkspaceView>('repositories');
  const [source, setSource] = useState<SourceExcerpt | null>(null);
  const [loadingRepositories, setLoadingRepositories] = useState(true);
  const [repositoryError, setRepositoryError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notice, setNotice] = useState('');

  // Live System Health Monitor State
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const [testingInference, setTestingInference] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);
  const inFlightHealthRef = useRef(false);

  const pollHealth = useCallback(async (testInference = false) => {
    if (inFlightHealthRef.current) return;
    inFlightHealthRef.current = true;
    setHealthRefreshing(true);
    try {
      if (typeof api.getHealth === 'function') {
        const data = await api.getHealth(testInference);
        setHealth(data);
        setLastCheckedTime(new Date().toLocaleTimeString());
      }
    } catch (error) {
      setHealth({
        status: 'SERVICE_UNAVAILABLE',
        timestamp: Date.now(),
        checks: {
          frontend: { status: 'UP', message: 'UI is loaded and operational' },
          backend: {
            status: 'DOWN',
            message: error instanceof Error ? error.message : 'Backend API is unreachable',
          },
          database: { status: 'UNKNOWN', message: 'Cannot verify: backend is unreachable' },
          ollama: { status: 'UNKNOWN', message: 'Cannot verify: backend is unreachable' },
          chatModel: { status: 'UNKNOWN', message: 'Cannot verify: backend is unreachable' },
          embeddingModel: { status: 'UNKNOWN', message: 'Cannot verify: backend is unreachable' },
          indexing: { status: 'UNKNOWN', message: 'Cannot verify: backend is unreachable' },
        },
      });
      setLastCheckedTime(new Date().toLocaleTimeString());
    } finally {
      inFlightHealthRef.current = false;
      setHealthRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void pollHealth();
    const interval = window.setInterval(() => {
      void pollHealth();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [pollHealth]);

  const refreshRepositories = useCallback(async () => {
    setLoadingRepositories(true);
    setRepositoryError('');
    try {
      const items = await api.listRepositories();
      setRepositories(items);
      setSelectedRepositoryId((current) =>
        current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null,
      );
    } catch (error) {
      setRepositoryError(error instanceof Error ? error.message : 'Could not load repositories.');
    } finally {
      setLoadingRepositories(false);
    }
  }, []);

  useEffect(() => {
    void refreshRepositories();
  }, [refreshRepositories]);

  useEffect(() => {
    if (!selectedRepositoryId) {
      setRepository(null);
      return;
    }
    let active = true;
    void api
      .getRepository(selectedRepositoryId)
      .then((detail) => {
        if (!active) return;
        setRepository(detail);
        setRepositories((items) => (items.map((item) => (item.id === detail.id ? detail : item))));
      })
      .catch((error: unknown) => {
        if (active)
          setNotice(
            error instanceof Error
              ? `Repository detail could not be loaded: ${error.message}`
              : 'Repository detail could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [selectedRepositoryId]);

  // Global key listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedFromList = repositories.find((item) => item.id === selectedRepositoryId) ?? null;
  const selectedRepository = repository?.id === selectedRepositoryId ? repository : selectedFromList;

  function upsertRepository(item: Repository) {
    setRepositories((items) => [...items.filter((existing) => existing.id !== item.id), item]);
    setRepository(item);
    setSelectedRepositoryId(item.id);
    setSource(null);
  }

  function selectRepository(item: Repository) {
    setSelectedRepositoryId(item.id);
    setRepository(item);
    setSource(null);
    setNotice('');
    setView('chat');
  }

  function completeImport(item: Repository) {
    upsertRepository(item);
    setImportOpen(false);
    setView('repositories');
    setNotice(`Import response status: ${item.indexingStatus ?? 'not reported'}.`);
  }

  function failedImport(item: Repository) {
    upsertRepository(item);
    setView('repositories');
  }

  const overallStatus: OverallHealthStatus = health ? health.status : 'CHECKING';
  const overallLabel =
    overallStatus === 'OPERATIONAL'
      ? 'All Systems Operational'
      : overallStatus === 'DEGRADED'
        ? 'Degraded'
        : overallStatus === 'SERVICE_UNAVAILABLE'
          ? 'Service Unavailable'
          : 'Checking…';

  const dotTone =
    overallStatus === 'OPERATIONAL'
      ? 'operational'
      : overallStatus === 'DEGRADED'
        ? 'degraded'
        : overallStatus === 'SERVICE_UNAVAILABLE'
          ? 'down'
          : 'unknown';

  return (
    <div className={`app-shell ${source ? 'drawer-open' : ''}`}>
      {/* ── Topbar (Engineered Minimal Terminal Bar) ──────────── */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href="/"
            className="topbar-brand"
            onClick={(e) => {
              e.preventDefault();
              setView('repositories');
            }}
          >
            <div className="topbar-brand-icon">
              <Terminal size={12} />
            </div>
            <div>
              <span className="topbar-brand-name">Codebase Copilot</span>
              <span className="topbar-brand-sub" style={{ marginLeft: 6 }}>
                workbench
              </span>
            </div>
          </a>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="topbar-center">
          <button
            type="button"
            className="cmd-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Command palette"
            title="Open command palette (Ctrl+K)"
          >
            <Search size={13} />
            <span>Quick find or jump to...</span>
            <div className="cmd-trigger-kbd">
              <kbd className="kbd">⌘K</kbd>
            </div>
          </button>
        </div>

        {/* Right: Live Health Pill & Links */}
        <div className="topbar-right">
          <button
            type="button"
            className="health-pill live-health-trigger"
            onClick={() => setHealthModalOpen(true)}
            title="Open Live System Health Monitor"
            aria-label={`Live System Health: ${overallLabel}. Click to open details.`}
          >
            <span className={`health-pill-dot ${dotTone}`} aria-hidden="true" />
            <span>{overallLabel}</span>
            {lastCheckedTime && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }} aria-hidden="true">
                ({lastCheckedTime})
              </span>
            )}
          </button>

          <a
            className="topbar-gh-link"
            href="https://github.com/aldehydeketone/Codebase-Copilot"
            target="_blank"
            rel="noreferrer"
            title="GitHub: aldehydeketone/Codebase-Copilot"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>Codebase-Copilot</span>
          </a>
        </div>
      </header>

      {/* ── Left Sidebar ──────────────────────────────────────── */}
      <Sidebar
        repositories={repositories}
        selectedRepositoryId={selectedRepositoryId}
        activeView={view}
        loading={loadingRepositories}
        onNavigate={(nextView) => {
          setNotice('');
          setView(nextView);
        }}
        onSelectRepository={selectRepository}
        onImport={() => setImportOpen(true)}
        onRefresh={() => void refreshRepositories()}
      />

      {/* ── Main Workspace ────────────────────────────────────── */}
      <main className="main-workspace">
        {repositoryError && (
          <div className="notice-bar error" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} />
              <span>{repositoryError}</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void refreshRepositories()}
            >
              Retry
            </button>
          </div>
        )}

        {notice && (
          <div className="notice-bar info" role="status">
            <span>{notice}</span>
            <button
              type="button"
              className="drawer-close"
              onClick={() => setNotice('')}
              aria-label="Dismiss notice"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {view === 'repositories' && (
          <RepositoryPanel
            repositories={repositories}
            selectedRepository={selectedRepository}
            loading={loadingRepositories}
            onSelect={selectRepository}
            onImport={() => setImportOpen(true)}
          />
        )}

        {view === 'chat' && (
          <ChatPanel
            key={selectedRepositoryId ?? 'no-repository'}
            repository={selectedRepository}
            onInspect={setSource}
          />
        )}

        {view === 'search' && (
          <SearchPanel
            key={selectedRepositoryId ?? 'no-repository'}
            repository={selectedRepository}
            onInspect={setSource}
          />
        )}
      </main>

      {/* ── Right Drawer: Source Inspector ────────────────────── */}
      <SourceInspector
        repository={selectedRepository}
        source={source}
        onClose={() => setSource(null)}
      />

      {/* ── Modals & Dialogs ──────────────────────────────────── */}
      {importOpen && (
        <RepositoryImportDialog
          onClose={() => setImportOpen(false)}
          onImported={completeImport}
          onFailedRepository={failedImport}
        />
      )}

      {healthModalOpen && (
        <HealthMonitorModal
          health={health}
          overallStatus={overallStatus}
          lastCheckedTime={lastCheckedTime}
          refreshing={healthRefreshing}
          onRefresh={() => pollHealth(false)}
          onTestInference={() => pollHealth(true)}
          testingInference={testingInference}
          onClose={() => setHealthModalOpen(false)}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        repositories={repositories}
        selectedRepositoryId={selectedRepositoryId}
        onSelectRepository={selectRepository}
        onNavigate={(nextView) => {
          setView(nextView);
        }}
        onOpenImport={() => setImportOpen(true)}
        onOpenHealth={() => setHealthModalOpen(true)}
      />
    </div>
  );
}
