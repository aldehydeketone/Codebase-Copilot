import { useEffect, useRef, useState } from 'react';
import {
  Search,
  MessageSquare,
  FolderGit2,
  Activity,
  PlusCircle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import type { Repository, WorkspaceView } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: Repository[];
  selectedRepositoryId: string | null;
  onSelectRepository: (repo: Repository) => void;
  onNavigate: (view: WorkspaceView) => void;
  onOpenImport: () => void;
  onOpenHealth: () => void;
}

interface ActionItem {
  id: string;
  category: 'Navigation' | 'Repositories' | 'System' | 'Links';
  label: string;
  sublabel?: string;
  icon: typeof Search;
  shortcut?: string;
  onSelect: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  repositories,
  selectedRepositoryId,
  onSelectRepository,
  onNavigate,
  onOpenImport,
  onOpenHealth,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions: ActionItem[] = [
    {
      id: 'nav-chat',
      category: 'Navigation',
      label: 'Go to Chat',
      sublabel: 'Query codebase with natural language',
      icon: MessageSquare,
      shortcut: '1',
      onSelect: () => {
        onNavigate('chat');
        onClose();
      },
    },
    {
      id: 'nav-search',
      category: 'Navigation',
      label: 'Go to Code Search',
      sublabel: 'Semantic vector search over Java source',
      icon: Search,
      shortcut: '2',
      onSelect: () => {
        onNavigate('search');
        onClose();
      },
    },
    {
      id: 'nav-repos',
      category: 'Navigation',
      label: 'Go to Repositories',
      sublabel: 'View all indexed local workspaces',
      icon: FolderGit2,
      shortcut: '3',
      onSelect: () => {
        onNavigate('repositories');
        onClose();
      },
    },
    {
      id: 'sys-import',
      category: 'System',
      label: 'Import New Repository...',
      sublabel: 'Index a local Java project path',
      icon: PlusCircle,
      shortcut: '⌘I',
      onSelect: () => {
        onOpenImport();
        onClose();
      },
    },
    {
      id: 'sys-health',
      category: 'System',
      label: 'Open System Health Monitor',
      sublabel: 'Diagnostic telemetry for PostgreSQL, Ollama & models',
      icon: Activity,
      shortcut: '⌘H',
      onSelect: () => {
        onOpenHealth();
        onClose();
      },
    },
    ...repositories.map((repo) => ({
      id: `repo-${repo.id}`,
      category: 'Repositories' as const,
      label: repo.name,
      sublabel: `${repo.indexedFileCount} files, ${repo.indexedChunkCount} chunks`,
      icon: FolderGit2,
      shortcut: repo.id === selectedRepositoryId ? 'Active' : undefined,
      onSelect: () => {
        onSelectRepository(repo);
        onClose();
      },
    })),
    {
      id: 'link-gh',
      category: 'Links',
      label: 'GitHub: aldehydeketone/Codebase-Copilot',
      sublabel: 'Open source repository',
      icon: ExternalLink,
      onSelect: () => {
        window.open('https://github.com/aldehydeketone/Codebase-Copilot', '_blank');
        onClose();
      },
    },
  ];

  const filtered = actions.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].onSelect();
      }
    }
  };

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette-box" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div className="palette-input-row">
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search commands or switch repository..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        <div className="palette-results">
          {filtered.length === 0 ? (
            <div className="palette-empty">No matching commands or repositories found</div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`palette-item ${isSelected ? 'focused' : ''}`}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <Icon size={14} className="palette-item-icon" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                    {item.sublabel && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                  {item.shortcut && (
                    <kbd className="kbd">{item.shortcut}</kbd>
                  )}
                  <ArrowRight size={12} style={{ opacity: isSelected ? 0.8 : 0.2 }} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
