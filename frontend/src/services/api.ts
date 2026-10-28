import type {
  ChatRequest,
  ChatResponse,
  Repository,
  RepositoryImportRequest,
  SearchRequest,
  SearchResult,
  SystemHealthResponse,
} from '../types';

const apiPrefix = import.meta.env.DEV ? '/api' : `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api`;
export const CHAT_REQUEST_TIMEOUT_MS = 420_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiPrefix}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'Network request failed', 0, null);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const record = asRecord(payload);
    const message = typeof record?.error === 'string'
      ? record.error
      : typeof record?.message === 'string'
        ? record.message
        : typeof payload === 'string' && payload
          ? payload
          : `Request failed with HTTP ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isRepository(value: unknown): value is Repository {
  const record = asRecord(value);
  return Boolean(record)
    && typeof record?.id === 'string'
    && typeof record?.name === 'string'
    && typeof record?.sourceType === 'string'
    && typeof record?.sourcePath === 'string'
    && isStringOrNull(record?.indexingStatus)
    && isStringOrNull(record?.errorDetails)
    && isStringOrNull(record?.createdAt)
    && isStringOrNull(record?.updatedAt)
    && typeof record?.indexedFileCount === 'number'
    && typeof record?.indexedChunkCount === 'number';
}

function parseRepository(value: unknown): Repository {
  if (!isRepository(value)) throw new ApiError('The server returned an invalid repository response.', 502, value);
  return value;
}

function parseSearchResult(value: unknown): SearchResult {
  const row = asRecord(value);
  if (!row || typeof row.filePath !== 'string' || typeof row.content !== 'string'
    || typeof row.startLine !== 'number' || typeof row.endLine !== 'number' || typeof row.score !== 'number'
    || (row.symbolName !== undefined && row.symbolName !== null && typeof row.symbolName !== 'string')) {
    throw new ApiError('The server returned an invalid search result.', 502, value);
  }
  return row as unknown as SearchResult;
}

function parseChatResponse(value: unknown): ChatResponse {
  const response = asRecord(value);
  if (!response || typeof response.answer !== 'string' || !Array.isArray(response.citations)) {
    throw new ApiError('The server returned an invalid chat response.', 502, value);
  }
  if (response.noConfidentContext !== undefined && typeof response.noConfidentContext !== 'boolean') {
    throw new ApiError('The server returned an invalid chat response.', 502, value);
  }
  const citations = response.citations.map((item) => {
    const citation = asRecord(item);
    if (!citation || typeof citation.id !== 'number' || typeof citation.filePath !== 'string'
      || typeof citation.startLine !== 'number' || typeof citation.endLine !== 'number'
      || typeof citation.snippet !== 'string') {
      throw new ApiError('The server returned an invalid citation.', 502, item);
    }
    return citation as unknown as ChatResponse['citations'][number];
  });
  return { answer: response.answer, citations, noConfidentContext: response.noConfidentContext === true };
}

export const api = {
  async listRepositories(): Promise<Repository[]> {
    const result: unknown = await request('/repositories');
    if (!Array.isArray(result)) throw new ApiError('The server returned an invalid repository list.', 502, result);
    return result.map(parseRepository);
  },

  async getRepository(id: string): Promise<Repository> {
    return parseRepository(await request(`/repositories/${encodeURIComponent(id)}`));
  },

  async importRepository(body: RepositoryImportRequest): Promise<Repository> {
    return parseRepository(await request('/repositories/import', { method: 'POST', body: JSON.stringify(body) }));
  },

  async search(body: SearchRequest): Promise<SearchResult[]> {
    const result: unknown = await request('/search', { method: 'POST', body: JSON.stringify(body) });
    if (!Array.isArray(result)) throw new ApiError('The server returned an invalid search response.', 502, result);
    return result.map(parseSearchResult);
  },

  async chat(body: ChatRequest): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
    try {
      return parseChatResponse(await request('/chat', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: controller.signal,
      }));
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ApiError(
          'The chat request exceeded the 420-second wait limit. The local model may still be loading or finishing; wait before retrying.',
          408,
          null,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },

  async getHealth(testInference = false): Promise<SystemHealthResponse> {
    return await request<SystemHealthResponse>(`/health${testInference ? '?testInference=true' : ''}`);
  },
};

export function repositoryFromError(error: unknown): Repository | null {
  if (!(error instanceof ApiError)) return null;
  const repository = asRecord(error.payload)?.repository;
  return isRepository(repository) ? repository : null;
}
