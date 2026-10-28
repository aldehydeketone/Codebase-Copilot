import { useState } from 'react';
import type { ComponentHealth, OverallHealthStatus, SystemHealthResponse } from '../types';

interface HealthMonitorModalProps {
  health: SystemHealthResponse | null;
  overallStatus: OverallHealthStatus;
  lastCheckedTime: string | null;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onTestInference: () => Promise<void>;
  testingInference: boolean;
  onClose: () => void;
}

export function HealthMonitorModal({
  health,
  overallStatus,
  lastCheckedTime,
  refreshing,
  onRefresh,
  onTestInference,
  testingInference,
  onClose,
}: HealthMonitorModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'raw'>('overview');

  const checks = health?.checks ?? {};

  const getStatusTone = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'UP':
      case 'OPERATIONAL':
      case 'IDLE':
      case 'COMPLETED':
        return 'tone-up';
      case 'DEGRADED':
      case 'MISSING':
      case 'RUNNING':
        return 'tone-warn';
      case 'DOWN':
      case 'SERVICE_UNAVAILABLE':
      case 'TIMEOUT':
      case 'FAILED':
        return 'tone-danger';
      default:
        return 'tone-muted';
    }
  };

  const getOverallHeadline = () => {
    switch (overallStatus) {
      case 'OPERATIONAL':
        return { label: 'All Systems Operational', desc: 'Backend, PostgreSQL, Ollama, and configured AI models are responding normally.' };
      case 'DEGRADED':
        return { label: 'Degraded Performance / AI Unavailable', desc: 'The workbench is running, but one or more AI models or background services need attention.' };
      case 'SERVICE_UNAVAILABLE':
        return { label: 'Service Unavailable', desc: 'Critical dependency failure (PostgreSQL or Backend API). Requests may fail.' };
      case 'CHECKING':
        return { label: 'Checking Health…', desc: 'Querying dependency endpoints…' };
      default:
        return { label: 'Status Unknown', desc: 'Could not obtain valid telemetry from the backend health probe.' };
    }
  };

  const headline = getOverallHeadline();

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="health-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="health-modal-title"
      >
        <div className="health-modal-header">
          <div className="header-title-col">
            <div className="title-row">
              <span className={`status-dot ${getStatusTone(overallStatus)}`} aria-hidden="true" />
              <h2 id="health-modal-title">Live System Health Monitor</h2>
            </div>
            <p className="health-meta-subtitle">
              Last probe: {lastCheckedTime || 'Pending'} · Polls automatically every 20s
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="Close health dialog"
          >
            [x]
          </button>
        </div>

        {/* Overall Status Banner */}
        <div className={`health-banner ${getStatusTone(overallStatus)}`}>
          <div className="banner-status-title">{headline.label}</div>
          <div className="banner-status-desc">{headline.desc}</div>
        </div>

        <div className="health-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Dependency Checks
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'raw' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            Raw Telemetry
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="health-grid">
            <HealthCard
              name="Frontend UI"
              badge="UP"
              tone="tone-up"
              details="React 19 / Vite"
              message="UI client active, routing and proxy responding"
            />

            <HealthCard
              name="Backend API"
              badge={checks.backend?.status ?? 'DOWN'}
              tone={getStatusTone(checks.backend?.status)}
              details={checks.backend?.latencyMs !== undefined ? `${checks.backend.latencyMs}ms` : undefined}
              message={checks.backend?.message ?? 'Spring Boot REST service'}
            />

            <HealthCard
              name="Database (PostgreSQL)"
              badge={checks.database?.status ?? 'DOWN'}
              tone={getStatusTone(checks.database?.status)}
              details={checks.database?.latencyMs !== undefined ? `${checks.database.latencyMs}ms` : undefined}
              message={checks.database?.message ?? 'pgvector persistence layer'}
            />

            <HealthCard
              name="Ollama Service"
              badge={checks.ollama?.status ?? 'DOWN'}
              tone={getStatusTone(checks.ollama?.status)}
              details={checks.ollama?.latencyMs !== undefined ? `${checks.ollama.latencyMs}ms` : undefined}
              message={checks.ollama?.message ?? 'Local model engine on port 11434'}
            />

            <HealthCard
              name="Chat Model"
              badge={checks.chatModel?.status ?? 'MISSING'}
              tone={getStatusTone(checks.chatModel?.status)}
              details={checks.chatModel?.model ?? 'qwen3.5:4b'}
              message={checks.chatModel?.message ?? 'Model availability check via Ollama tags'}
            />

            <HealthCard
              name="Embedding Model"
              badge={checks.embeddingModel?.status ?? 'MISSING'}
              tone={getStatusTone(checks.embeddingModel?.status)}
              details={checks.embeddingModel?.model ?? 'nomic-embed-text'}
              message={checks.embeddingModel?.message ?? 'Embedding availability check via Ollama tags'}
            />

            <HealthCard
              name="Repository Indexing"
              badge={checks.indexing?.status ?? 'IDLE'}
              tone={getStatusTone(checks.indexing?.status)}
              details={checks.indexing?.totalRepositories !== undefined ? `${checks.indexing.totalRepositories} repos` : undefined}
              message={checks.indexing?.message ?? 'Vector indexing queue and status'}
            />

            {health?.inferenceTest && (
              <HealthCard
                name="On-Demand Inference Test"
                badge={health.inferenceTest.status}
                tone={getStatusTone(health.inferenceTest.status)}
                details={health.inferenceTest.latencyMs !== undefined ? `${health.inferenceTest.latencyMs}ms` : undefined}
                message={health.inferenceTest.message}
              />
            )}
          </div>
        ) : (
          <pre className="raw-json-view">
            <code>{JSON.stringify(health, null, 2)}</code>
          </pre>
        )}

        <div className="health-modal-actions">
          <button
            type="button"
            className="quiet-button"
            onClick={() => void onTestInference()}
            disabled={testingInference || overallStatus === 'SERVICE_UNAVAILABLE'}
          >
            {testingInference ? 'Testing inference…' : 'Run AI Inference Test'}
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            {refreshing ? 'Probing…' : 'Check now'}
          </button>
        </div>
      </section>
    </div>
  );
}

interface HealthCardProps {
  name: string;
  badge: string;
  tone: string;
  details?: string;
  message?: string;
}

function HealthCard({ name, badge, tone, details, message }: HealthCardProps) {
  return (
    <div className="health-card">
      <div className="card-topline">
        <span className="card-name">{name}</span>
        <span className={`status-pill ${tone}`}>{badge}</span>
      </div>
      {details && <div className="card-details"><code>{details}</code></div>}
      {message && <div className="card-message">{message}</div>}
    </div>
  );
}
