import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { api } from './services/api';
import type { Repository } from './types';

vi.mock('./services/api', () => ({
  api: {
    listRepositories: vi.fn(),
    getRepository: vi.fn(),
    importRepository: vi.fn(),
    search: vi.fn(),
    chat: vi.fn(),
  },
  repositoryFromError: vi.fn(() => null),
}));

const repository: Repository = {
  id: 'repo-1',
  name: 'sample-service',
  sourceType: 'LOCAL',
  sourcePath: 'D:\\src\\sample-service',
  indexingStatus: 'COMPLETED',
  errorDetails: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  indexedFileCount: 3,
  indexedChunkCount: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listRepositories).mockResolvedValue([repository]);
  vi.mocked(api.getRepository).mockResolvedValue(repository);
  vi.mocked(api.importRepository).mockResolvedValue(repository);
  vi.mocked(api.search).mockResolvedValue([]);
  vi.mocked(api.chat).mockResolvedValue({ answer: 'No relevant context was found.', citations: [] });
});

afterEach(() => cleanup());

describe('Codebase Copilot workbench', () => {
  it('shows empty indexing counts and next-step guidance for a repository with no Java code', async () => {
    const emptyRepository = { ...repository, indexingStatus: 'COMPLETED_EMPTY', indexedFileCount: 0, indexedChunkCount: 0 };
    vi.mocked(api.listRepositories).mockResolvedValueOnce([emptyRepository]);
    vi.mocked(api.getRepository).mockResolvedValueOnce(emptyRepository);
    render(<App />);

    expect(await screen.findByText('Scan completed; no Java code was indexed.')).toBeInTheDocument();
    expect(screen.getByText('Add supported `.java` files to this folder or import a Java project, then refresh or import it again.')).toBeInTheDocument();
    expect(screen.getAllByText('no Java code').length).toBeGreaterThan(0);
  });

  it('imports a local path using the backend request contract and displays the returned status', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listRepositories).mockResolvedValueOnce([]);
    const imported = { ...repository, id: 'repo-2', name: 'new-service', sourcePath: 'D:\\src\\new-service' };
    vi.mocked(api.importRepository).mockResolvedValueOnce(imported);
    render(<App />);

    await screen.findByText('No repositories yet');
    await user.click(screen.getByRole('button', { name: '[+] Import repository' }));
    const dialog = screen.getByRole('dialog', { name: 'Import a local repository' });
    await user.type(within(dialog).getByLabelText('Repository folder path'), imported.sourcePath);
    await user.click(within(dialog).getByRole('button', { name: 'Import repository' }));

    await waitFor(() => expect(api.importRepository).toHaveBeenCalledWith({ path: imported.sourcePath, name: 'new-service' }));
    expect(await screen.findByText('Import response status: COMPLETED.')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Main navigation' })).getByRole('button', { name: /new-service/ })).toBeInTheDocument();
  });

  it('sends the selected repository ID and question, then opens returned citations in the inspector', async () => {
    const user = userEvent.setup();
    vi.mocked(api.chat).mockResolvedValueOnce({
      answer: '**Greeting** returns `hello`.',
      citations: [{ id: 1, filePath: 'src/main/java/Greeting.java', startLine: 8, endLine: 10, snippet: 'return "hello";' }],
    });
    render(<App />);
    await within(screen.getByRole('complementary', { name: 'Main navigation' })).findByRole('button', { name: /sample-service/ });
    await user.click(screen.getByRole('button', { name: /Chat/ }));
    await user.type(screen.getByLabelText('Question'), 'What does greeting return?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));

    await waitFor(() => expect(api.chat).toHaveBeenCalledWith({
      repositoryId: repository.id,
      question: 'What does greeting return?',
      topK: 5,
    }));
    expect(await screen.findByText('Greeting', { selector: 'strong' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /src\/main\/java\/Greeting\.java/ }));
    expect(screen.getByText('Returned snippet only; full source is not available through the current API.')).toBeInTheDocument();
    expect(screen.getByText('return "hello";')).toBeInTheDocument();
    expect(screen.getByText('Lines 8–10')).toBeInTheDocument();
  });

  it('searches with the selected repository and opens real result content in the inspector', async () => {
    const user = userEvent.setup();
    vi.mocked(api.search).mockResolvedValueOnce([{
      filePath: 'src/main/java/DatabaseConfig.java',
      startLine: 20,
      endLine: 23,
      content: 'dataSource.setUrl(url);',
      score: 0.8123,
    }]);
    render(<App />);
    await within(screen.getByRole('complementary', { name: 'Main navigation' })).findByRole('button', { name: /sample-service/ });
    await user.click(screen.getByRole('button', { name: /Search/ }));
    await user.type(screen.getByLabelText('Search by intent or behavior'), 'database URL configuration');
    await user.click(screen.getByRole('button', { name: 'Search code' }));

    await waitFor(() => expect(api.search).toHaveBeenCalledWith({
      query: 'database URL configuration',
      repositoryId: repository.id,
      limit: 10,
    }));
    await user.click(await screen.findByRole('button', { name: /DatabaseConfig\.java/ }));
    expect(within(screen.getByRole('complementary', { name: 'Source inspector' })).getByText('dataSource.setUrl(url);')).toBeInTheDocument();
    expect(screen.getByText('Score 0.812')).toBeInTheDocument();
  });

  it('surfaces API import failures instead of presenting them as successful indexing', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listRepositories).mockResolvedValueOnce([]);
    vi.mocked(api.importRepository).mockRejectedValueOnce(new Error('404 Repository directory does not exist'));
    render(<App />);
    await screen.findByText('No repositories yet');
    await user.click(screen.getByRole('button', { name: '[+] Import repository' }));
    const dialog = screen.getByRole('dialog', { name: 'Import a local repository' });
    await user.type(within(dialog).getByLabelText('Repository folder path'), 'D:\\missing\\repo');
    await user.click(within(dialog).getByRole('button', { name: 'Import repository' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('404 Repository directory does not exist');
    expect(screen.queryByText(/Import response status: COMPLETED/)).not.toBeInTheDocument();
  });
});
