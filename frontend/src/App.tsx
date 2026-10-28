import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { HealthMonitorModal } from './components/HealthMonitorModal';
import { RepositoryImportDialog } from './components/RepositoryImportDialog';
import { RepositoryPanel } from './components/RepositoryPanel';
import { SearchPanel } from './components/SearchPanel';
import { Sidebar } from './components/Sidebar';
import { SourceInspector } from './components/SourceInspector';
import { api } from './services/api';
import type { OverallHealthStatus, Repository, SourceExcerpt, SystemHealthResponse, WorkspaceView } from './types';

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
          backend: { status: 'DOWN', message: error instanceof Error ? error.message : 'Backend API is unreachable' },
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
      setSelectedRepositoryId((current) => current && items.some((item) => item.id === current)
        ? current
        : items[0]?.id ?? null);
    } catch (error) {
      setRepositoryError(error instanceof Error ? error.message : 'Could not load repositories.');
    } finally {
      setLoadingRepositories(false);
    }
  }, []);

  useEffect(() => { void refreshRepositories(); }, [refreshRepositories]);

  useEffect(() => {
    if (!selectedRepositoryId) {
      setRepository(null);
      return;
    }
    let active = true;
    void api.getRepository(selectedRepositoryId).then((detail) => {
      if (!active) return;
      setRepository(detail);
      setRepositories((items) => items.map((item) => item.id === detail.id ? detail : item));
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? `Repository detail could not be loaded: ${error.message}` : 'Repository detail could not be loaded.');
    });
    return () => { active = false; };
  }, [selectedRepositoryId]);

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
  const overallLabel = overallStatus === 'OPERATIONAL'
    ? 'All Systems Operational'
    : overallStatus === 'DEGRADED'
      ? 'Degraded'
      : overallStatus === 'SERVICE_UNAVAILABLE'
        ? 'Service Unavailable'
        : 'Checking…';
  const overallTone = overallStatus === 'OPERATIONAL'
    ? 'tone-up'
    : overallStatus === 'DEGRADED'
      ? 'tone-warn'
      : overallStatus === 'SERVICE_UNAVAILABLE'
        ? 'tone-danger'
        : 'tone-muted';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark">[ cc ]</span>
          <span className="brand-title">codebase copilot</span>
          <span className="topbar-divider" aria-hidden="true" />
          <a
            className="repo-badge"
            href="https://github.com/aldehydeketone/Codebase-Copilot"
            target="_blank"
            rel="noreferrer"
            title="GitHub: aldehydeketone/Codebase-Copilot"
          >
            <svg
              className="repo-badge-icon"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="repo-badge-text">Codebase-Copilot</span>
          </a>
        </div>
        <div className="topbar-meta">
          <button
            type="button"
            className="live-health-trigger"
            onClick={() => setHealthModalOpen(true)}
            title="Open Live System Health Monitor"
            aria-label={`Live System Health: ${overallLabel}. Click to open details.`}
          >
            <span className={`status-dot ${overallTone}`} aria-hidden="true" />
            <span className="health-label">{overallLabel}</span>
            {lastCheckedTime && <span className="health-time" aria-hidden="true">({lastCheckedTime})</span>}
          </button>
          <span className="topbar-divider" aria-hidden="true" />
          <a className="guide-link" href="https://getdesign.md/opencode.ai/design-md" target="_blank" rel="noreferrer">
            <span>guide</span>
            <svg className="external-link-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" />
              <path d="M10 2h4v4" />
              <path d="M6 10L14 2" />
            </svg>
          </a>
        </div>
      </header>
      <div className="app-grid">
        <Sidebar
          repositories={repositories}
          selectedRepositoryId={selectedRepositoryId}
          activeView={view}
          loading={loadingRepositories}
          onNavigate={(nextView) => { setNotice(''); setView(nextView); }}
          onSelectRepository={selectRepository}
          onImport={() => setImportOpen(true)}
          onRefresh={() => void refreshRepositories()}
        />
        <main className="main-workspace">
          <div className="workspace-topline"><span>workspace / {viewTitles[view].toLowerCase()}</span>{selectedRepository && <span className="selected-repository-label">{selectedRepository.name}</span>}</div>
          {repositoryError && <div className="error-banner" role="alert"><span>{repositoryError}</span><button type="button" className="quiet-link" onClick={() => void refreshRepositories()}>Retry</button></div>}
          {notice && <div className="notice-banner" role="status"><span>{notice}</span><button type="button" className="quiet-link" onClick={() => setNotice('')} aria-label="Dismiss notice">[x]</button></div>}
          {view === 'repositories' && <RepositoryPanel
            repositories={repositories}
            selectedRepository={selectedRepository}
            loading={loadingRepositories}
            onSelect={selectRepository}
            onImport={() => setImportOpen(true)}
          />}
          {view === 'chat' && <ChatPanel key={selectedRepositoryId ?? 'no-repository'} repository={selectedRepository} onInspect={setSource} />}
          {view === 'search' && <SearchPanel key={selectedRepositoryId ?? 'no-repository'} repository={selectedRepository} onInspect={setSource} />}
        </main>
        <SourceInspector repository={selectedRepository} source={source} />
      </div>
      {importOpen && <RepositoryImportDialog onClose={() => setImportOpen(false)} onImported={completeImport} onFailedRepository={failedImport} />}
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
    </div>
  );
}
