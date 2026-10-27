import { useRef, useState, type FormEvent } from 'react';
import { api, repositoryFromError } from '../services/api';
import type { Repository } from '../types';

interface RepositoryImportDialogProps {
  onClose: () => void;
  onImported: (repository: Repository) => void;
  onFailedRepository: (repository: Repository) => void;
}

export function RepositoryImportDialog({ onClose, onImported, onFailedRepository }: RepositoryImportDialogProps) {
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
      const repository = await api.importRepository({ path: repositoryPath, ...(name ? { name } : {}) });
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
    <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === 'Escape' && !submitting) onClose(); }} onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" aria-describedby="import-dialog-help">
        <div className="section-heading">
          <div><h2 id="import-dialog-title">Import a local repository</h2><p id="import-dialog-help" className="muted-copy">Enter an absolute path visible to the Spring Boot process.</p></div>
          <button type="button" className="dialog-close" onClick={onClose} disabled={submitting} aria-label="Close import dialog">[x]</button>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label htmlFor="repository-path">Repository folder path</label>
          <input
            ref={inputRef}
            id="repository-path"
            name="path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="D:\\src\\my-java-project"
            autoComplete="off"
            autoFocus
            required
            disabled={submitting}
          />
          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="quiet-button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="action-button" disabled={submitting || !path.trim()}>
              {submitting ? 'Indexing repository…' : 'Import repository'}
            </button>
          </div>
        </form>
        <p className="helper-note">Import runs synchronously. The status shown afterward comes from the API response.</p>
      </section>
    </div>
  );
}
