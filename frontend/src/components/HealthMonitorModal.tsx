import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Cpu,
  Database,
  Layers,
  Terminal,
  X,
  Play,
} from 'lucide-react';
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

  const getStatusIcon = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'UP':
      case 'OPERATIONAL':
      case 'IDLE':
      case 'COMPLETED':
        return <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />;
      case 'DEGRADED':
      case 'MISSING':
      case 'RUNNING':
        return <AlertTriangle size={15} style={{ color: 'var(--warn)' }} />;
      case 'DOWN':
      case 'SERVICE_UNAVAILABLE':
      case 'TIMEOUT':
      case 'FAILED':
        return <XCircle size={15} style={{ color: 'var(--bad)' }} />;
      default:
        return <HelpCircle size={15} style={{ color: 'var(--text-dim)' }} />;
    }
  };

  const getOverallHeadline = () => {
    switch (overallStatus) {
      case 'OPERATIONAL':
        return {
          label: 'All Systems Operational',
          desc: 'Backend REST API, PostgreSQL (pgvector), Ollama, and configured AI models are responding normally.',
        };
      case 'DEGRADED':
        return {
          label: 'Degraded',
          desc: 'The workbench is running, but one or more AI models or background services need attention.',
        };
      case 'SERVICE_UNAVAILABLE':
        return {
          label: 'Service Unavailable',
          desc: 'Critical dependency failure (PostgreSQL or Backend API). Requests will fail until restored.',
        };
      case 'CHECKING':
        return {
          label: 'Checking Health…',
          desc: 'Querying dependency endpoints…',
        };
      default:
        return {
          label: 'Status Unknown',
          desc: 'Could not obtain valid telemetry from the backend health probe.',
        };
    }
  };

  const headline = getOverallHeadline();

  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="health-modal-title"
        style={{ width: 560 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={15} style={{ color: 'var(--cool)' }} />
            <h2 id="health-modal-title" className="modal-title">
              Live System Health Monitor
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close health dialog"
          >
            <X size={15} />
          </button>
        </div>

        {/* Overall Status Banner */}
        <div
          style={{
            padding: '10px 16px',
            backgroundColor:
              overallStatus === 'OPERATIONAL'
                ? 'var(--ok-soft)'
                : overallStatus === 'DEGRADED'
                  ? 'var(--warn-soft)'
                  : 'var(--bad-soft)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color:
                  overallStatus === 'OPERATIONAL'
                    ? 'var(--ok)'
                    : overallStatus === 'DEGRADED'
                      ? 'var(--warn)'
                      : 'var(--bad)',
              }}
            >
              {headline.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {headline.desc}
            </div>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {lastCheckedTime || 'Pending'}
          </span>
        </div>

        {/* Tab buttons */}
        <div style={{ display: 'flex', padding: '0 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'overview' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12,
              padding: '8px 12px',
            }}
            onClick={() => setActiveTab('overview')}
          >
            Dependency Checks
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'raw' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'raw' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12,
              padding: '8px 12px',
            }}
            onClick={() => setActiveTab('raw')}
          >
            Raw Telemetry
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '55vh' }}>
          {activeTab === 'overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <HealthItem
                icon={<Activity size={14} />}
                name="Frontend UI"
                status="UP"
                badge={checks.frontend?.status ?? 'UP'}
                message="UI active, routing and proxy responding"
              />

              <HealthItem
                icon={<Terminal size={14} />}
                name="Backend API"
                status={checks.backend?.status ?? 'DOWN'}
                badge={checks.backend?.status ?? 'DOWN'}
                latency={checks.backend?.latencyMs}
                message={checks.backend?.message ?? 'Spring Boot REST service'}
              />

              <HealthItem
                icon={<Database size={14} />}
                name="Database (PostgreSQL)"
                status={checks.database?.status ?? 'DOWN'}
                badge={checks.database?.status ?? 'DOWN'}
                latency={checks.database?.latencyMs}
                message={checks.database?.message ?? 'pgvector persistence layer'}
              />

              <HealthItem
                icon={<Cpu size={14} />}
                name="Ollama Service"
                status={checks.ollama?.status ?? 'DOWN'}
                badge={checks.ollama?.status ?? 'DOWN'}
                latency={checks.ollama?.latencyMs}
                message={checks.ollama?.message ?? 'Local model engine on port 11434'}
              />

              <HealthItem
                icon={<Terminal size={14} />}
                name="Chat Model"
                status={checks.chatModel?.status ?? 'MISSING'}
                badge={checks.chatModel?.status ?? 'MISSING'}
                detail={checks.chatModel?.model ?? 'qwen3.5:4b'}
                message={checks.chatModel?.message ?? 'Model availability check via Ollama tags'}
              />

              <HealthItem
                icon={<Layers size={14} />}
                name="Embedding Model"
                status={checks.embeddingModel?.status ?? 'MISSING'}
                badge={checks.embeddingModel?.status ?? 'MISSING'}
                detail={checks.embeddingModel?.model ?? 'nomic-embed-text'}
                message={checks.embeddingModel?.message ?? 'Embedding availability check via Ollama tags'}
              />

              <HealthItem
                icon={<Layers size={14} />}
                name="Repository Indexing"
                status={checks.indexing?.status ?? 'IDLE'}
                badge={checks.indexing?.status ?? 'IDLE'}
                detail={
                  checks.indexing?.totalRepositories !== undefined
                    ? `${checks.indexing.totalRepositories} repos`
                    : undefined
                }
                message={checks.indexing?.message ?? 'Vector indexing queue and status'}
              />

              {health?.inferenceTest && (
                <HealthItem
                  icon={<Play size={14} />}
                  name="On-Demand Inference Test"
                  status={health.inferenceTest.status}
                  badge={health.inferenceTest.status}
                  latency={health.inferenceTest.latencyMs}
                  message={health.inferenceTest.message}
                />
              )}
            </div>
          ) : (
            <pre
              style={{
                backgroundColor: 'var(--bg-code)',
                padding: 12,
                borderRadius: 'var(--r-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                overflowX: 'auto',
              }}
            >
              <code>{JSON.stringify(health, null, 2)}</code>
            </pre>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void onTestInference()}
            disabled={testingInference || overallStatus === 'SERVICE_UNAVAILABLE'}
          >
            {testingInference ? 'Testing inference…' : 'Run AI Inference Test'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Probing…' : 'Check now'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

interface HealthItemProps {
  icon: React.ReactNode;
  name: string;
  status: string;
  badge: string;
  detail?: string;
  latency?: number;
  message?: string;
}

function HealthItem({ icon, name, status, badge, detail, latency, message }: HealthItemProps) {
  const getBadgeClass = () => {
    switch (status.toUpperCase()) {
      case 'UP':
      case 'OPERATIONAL':
      case 'IDLE':
        return 'completed';
      case 'DEGRADED':
      case 'MISSING':
      case 'RUNNING':
        return 'empty';
      default:
        return 'failed';
    }
  };

  return (
    <div className="health-row">
      <div style={{ color: 'var(--text-muted)' }}>{icon}</div>
      <div className="health-row-name">{name}</div>
      {detail && (
        <code
          style={{
            fontSize: 11,
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            padding: '1px 4px',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: 'var(--r-sm)',
          }}
        >
          {detail}
        </code>
      )}
      <div className="health-row-msg">{message}</div>
      {latency !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {latency}ms
        </span>
      )}
      <span className={`status-badge ${getBadgeClass()}`}>{badge}</span>
    </div>
  );
}
