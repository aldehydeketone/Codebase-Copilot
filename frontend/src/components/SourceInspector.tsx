import { FileCode, X, Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { Repository, SourceExcerpt } from '../types';
import { RepositoryStatus } from './Sidebar';

interface SourceInspectorProps {
  repository: Repository | null;
  source: SourceExcerpt | null;
  onClose?: () => void;
}

export function SourceInspector({ repository, source, onClose }: SourceInspectorProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!source) return;
    void navigator.clipboard.writeText(source.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!source) {
    return (
      <aside className="code-drawer" aria-label="Source inspector">
        <div className="drawer-header">
          <div className="drawer-title">
            <FileCode size={14} className="drawer-title-icon" />
            <span>Source Inspector</span>
          </div>
        </div>
        <div className="empty-workspace-state" style={{ padding: '32px 20px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            <FileCode size={16} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Select a search result or citation to inspect its returned snippet.
          </p>
          {repository && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Active Repository
              </div>
              <div style={{ fontWeight: 600, fontSize: 12, marginTop: 2 }}>{repository.name}</div>
              <div style={{ marginTop: 6 }}>
                <RepositoryStatus status={repository.indexingStatus} />
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  const lines = source.content.split('\n');

  return (
    <aside className="code-drawer" aria-label="Source inspector">
      <div className="drawer-header">
        <div className="drawer-title truncate">
          <FileCode size={14} className="drawer-title-icon" />
          <span className="truncate">{source.filePath.split('/').pop() || source.filePath}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copyCode}
            title="Copy snippet"
          >
            {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
          </button>
          {onClose && (
            <button
              type="button"
              className="drawer-close"
              onClick={onClose}
              aria-label="Close inspector drawer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="drawer-file-info">
        <div className="drawer-file-path">{source.filePath}</div>
        <div className="drawer-file-lines" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Lines {source.startLine}–{source.endLine}</span>
          {source.score !== undefined && (
            <span>· Score {source.score.toFixed(3)}</span>
          )}
          {source.citationId !== undefined && (
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              · Citation [{source.citationId}]
            </span>
          )}
        </div>
        <p className="excerpt-warning" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          Returned snippet only; full source is not available through the current API.
        </p>
      </div>

      <div className="drawer-code-scroll">
        <pre
          className="drawer-code-pre"
          aria-label={`${source.filePath}, lines ${source.startLine} through ${source.endLine}`}
        >
          <code>
            {lines.map((line, index) => (
              <span className="code-line" key={`${source.startLine}-${index}`}>
                <span className="line-number" aria-hidden="true">
                  {source.startLine + index}
                </span>
                <span className="line-content">{line || ' '}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>

      {repository && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 10,
            color: 'var(--text-xmuted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Repository: {repository.name}</span>
          <span>Indexed chunk snippet</span>
        </div>
      )}
    </aside>
  );
}
