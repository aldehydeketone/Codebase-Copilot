import { useRef, useState, type FormEvent } from 'react';
import { FolderGit2, X, AlertCircle, ArrowRight } from 'lucide-react';
import { api, repositoryFromError } from '../services/api';
import type { Repository } from '../types';

interface RepositoryImportDialogProps {
  onClose: () => void;
  onImported: (repository: Repository) => void;
  onFailedRepository: (repository: Repository) => void;
}

export function RepositoryImportDialog({
  onClose,
  onImported,
  onFailedRepository,
}: RepositoryImportDialogProps) {
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const repositoryPath = path.trim();
    if (!repositoryPath || pending.current) return;
    pending.current = true;
    setError('');
    setSubmitting(true);
    try {
      const name = repositoryPath.split(/[\\/]/).filter(Boolean).at(-1);
      const repository = await api.importRepository({
        path: repositoryPath,
        ...(name ? { name } : {}),
      });
      onImported(repository);
    } catch (caught) {
      const failedRepository = repositoryFromError(caught);
      if (failedRepository) onFailedRepository(failedRepository);
      setError(caught instanceof Error ? caught.message : 'Repository import failed.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !submitting) onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        aria-describedby="import-dialog-help"
        style={{ width: 460 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderGit2 size={16} className="text-accent" />
            <h2 id="import-dialog-title" className="modal-title">
              Import a local repository
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close import dialog"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            <p id="import-dialog-help" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Enter an absolute file path visible to the Spring Boot backend process.
            </p>

            <div className="form-field">
              <label htmlFor="repository-path" className="form-label">
                Repository folder path
              </label>
              <input
                ref={inputRef}
                id="repository-path"
                name="path"
                className="form-input"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="D:\src\my-java-project"
                autoComplete="off"
                autoFocus
                required
                disabled={submitting}
              />
              <span className="form-hint">
                Example: <code>/app/sample-service</code> or <code>D:\projects\ecommerce</code>
              </span>
            </div>

            {error && (
              <div className="inline-error-msg" role="alert">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !path.trim()}
            >
              {submitting ? 'Indexing repository…' : 'Import repository'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
