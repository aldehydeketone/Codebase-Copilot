export type RepositoryStatus = 'PENDING' | 'INDEXING' | 'COMPLETED' | 'COMPLETED_EMPTY' | 'FAILED' | string;

export interface Repository {
  id: string;
  name: string;
  sourceType: string;
  sourcePath: string;
  indexingStatus: RepositoryStatus | null;
  errorDetails: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  indexedFileCount: number;
  indexedChunkCount: number;
}

export interface RepositoryImportRequest {
  path: string;
  name?: string;
}

export interface SearchRequest {
  query: string;
  repositoryId: string;
  limit?: number;
}

export interface SearchResult {
  filePath: string;
  symbolName?: string | null;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

export interface ChatRequest {
  repositoryId: string;
  question: string;
  topK?: number;
}

export interface Citation {
  id: number;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  noConfidentContext?: boolean;
}

export interface SourceExcerpt {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score?: number;
  citationId?: number;
}

export type WorkspaceView = 'chat' | 'search' | 'repositories';

export type OverallHealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'SERVICE_UNAVAILABLE' | 'CHECKING' | 'UNKNOWN';

export interface ComponentHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'MISSING' | 'TIMEOUT' | 'UNAVAILABLE' | 'IDLE' | 'RUNNING' | 'FAILED' | 'UNKNOWN';
  latencyMs?: number;
  message?: string;
  model?: string;
  activeCount?: number;
  failedCount?: number;
  totalRepositories?: number;
}

export interface SystemHealthResponse {
  status: 'OPERATIONAL' | 'DEGRADED' | 'SERVICE_UNAVAILABLE';
  timestamp: number;
  checks: {
    frontend?: ComponentHealth;
    backend?: ComponentHealth;
    database?: ComponentHealth;
    ollama?: ComponentHealth;
    chatModel?: ComponentHealth;
    embeddingModel?: ComponentHealth;
    indexing?: ComponentHealth;
  };
  inferenceTest?: ComponentHealth;
}

