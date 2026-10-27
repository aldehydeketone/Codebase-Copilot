import { useCallback, useEffect, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { RepositoryImportDialog } from './components/RepositoryImportDialog';
import { RepositoryPanel } from './components/RepositoryPanel';
import { SearchPanel } from './components/SearchPanel';
import { Sidebar } from './components/Sidebar';
import { SourceInspector } from './components/SourceInspector';
import { api } from './services/api';
import type { Repository, SourceExcerpt, WorkspaceView } from './types';

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
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const refreshRepositories = useCallback(async () => {
    setLoadingRepositories(true);
    setRepositoryError('');
    try {
      const items = await api.listRepositories();
      setRepositories(items);
      setApiConnected(true);
      setSelectedRepositoryId((current) => current && items.some((item) => item.id === current)
        ? current
        : items[0]?.id ?? null);
    } catch (error) {
      setApiConnected(false);
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
    setApiConnected(true);
    setView('repositories');
    setNotice(`Import response status: ${item.indexingStatus ?? 'not reported'}.`);
  }

  function failedImport(item: Repository) {
    upsertRepository(item);
    setView('repositories');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand"><span className="brand-mark">[ cc ]</span><span>codebase copilot</span></div>
        <div className="topbar-meta">
          <span className="api-indicator" role="status"><span className={`api-mark ${apiConnected === true ? 'is-up' : apiConnected === false ? 'is-down' : ''}`} aria-hidden="true" />{apiConnected === true ? 'API connected' : apiConnected === false ? 'API unavailable' : 'Connecting…'}</span>
          <a className="guide-link" href="https://getdesign.md/opencode.ai/design-md" target="_blank" rel="noreferrer">guide [↗]</a>
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
    </div>
  );
}
