import { FileCode, X, Copy, Check } from 'lucide-react';
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
            <FileCode size={13} className="drawer-title-icon" />
            <span>Source Inspector</span>
          </div>
        </div>
        <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 12 }}>
          <p>Select a search result or citation to inspect its returned snippet.</p>
          {repository && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Target Repository
              </div>
              <div style={{ fontWeight: 600, fontSize: 12, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {repository.name}
              </div>
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
          <FileCode size={13} className="drawer-title-icon" />
          <span className="truncate">{source.filePath.split('/').pop() || source.filePath}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copyCode}
            title="Copy snippet"
          >
            {copied ? <Check size={12} style={{ color: 'var(--ok)' }} /> : <Copy size={12} />}
          </button>
          {onClose && (
            <button
              type="button"
              className="drawer-close"
              onClick={onClose}
              aria-label="Close inspector drawer"
            >
              <X size={13} />
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
        <p className="excerpt-warning" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
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
            padding: '6px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)',
            display: 'flex',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <span>Repository: {repository.name}</span>
          <span>Indexed chunk</span>
        </div>
      )}
    </aside>
  );
}
