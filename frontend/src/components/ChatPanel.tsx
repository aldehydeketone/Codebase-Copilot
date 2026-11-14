import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  FileCode,
  AlertCircle,
  HelpCircle,
  Terminal,
  Send,
} from 'lucide-react';
import { api } from '../services/api';
import type { ChatResponse, Repository, SourceExcerpt } from '../types';
import { CodeBlock } from './CodeBlock';

interface ChatPanelProps {
  repository: Repository | null;
  onInspect: (source: SourceExcerpt) => void;
}

interface Message {
  id: string;
  question: string;
  response?: ChatResponse;
  error?: string;
}

export function EmptyWorkspace({ title, description }: { title: string; description: string }) {
  return (
    <div className="chat-empty-console">
      <div className="console-prompt-badge">workspace :: unselected</div>
      <h2 className="console-empty-title">{title}</h2>
      <p className="console-empty-desc">{description}</p>
    </div>
  );
}

export function ChatPanel({ repository, onInspect }: ChatPanelProps) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pending = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!submitting) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [submitting]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, submitting]);

  async function send(questionText: string, retryId?: string) {
    if (!repository || pending.current || !questionText.trim()) return;
    const id = retryId || `${Date.now()}-${Math.random()}`;
    if (!retryId) {
      setMessages((items) => [...items, { id, question: questionText.trim() }]);
    } else {
      setMessages((items) =>
        items.map((item) => (item.id === retryId ? { ...item, error: undefined } : item)),
      );
    }
    pending.current = true;
    setSubmitting(true);
    try {
      const response = await api.chat({
        repositoryId: repository.id,
        question: questionText.trim(),
        topK: 5,
      });
      setMessages((items) =>
        items.map((item) => (item.id === id ? { ...item, response, error: undefined } : item)),
      );
    } catch (error) {
      setMessages((items) =>
        items.map((item) =>
          item.id === id
            ? { ...item, error: error instanceof Error ? error.message : 'The request failed.' }
            : item,
        ),
      );
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();
    if (!value || !repository || submitting) return;
    setQuestion('');
    void send(value);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const value = question.trim();
      if (value && repository && !submitting) {
        setQuestion('');
        void send(value);
      }
    }
  };

  return (
    <section className="chat-view" aria-labelledby="chat-view-title">
      <div className="sr-only">
        <h1 id="chat-view-title">Ask the codebase</h1>
        <p>
          {repository
            ? `Grounded code intelligence via ${repository.name}`
            : 'Select a repository to query with natural language.'}
        </p>
      </div>

      {!repository ? (
        <EmptyWorkspace
          title="No repository selected"
          description="Import a local Java repository or choose one from the left sidebar to start querying."
        />
      ) : (
        <>
          {messages.length === 0 ? (
            <div className="chat-empty-console">
              <div className="console-prompt-badge">codebase-copilot v1.0.0 · query console</div>
              <h2 className="console-empty-title">Ready for grounded code queries</h2>
              <p className="console-empty-desc">
                Natural language questions retrieve vector embeddings from pgvector and cite ground-truth Java source files.
              </p>

              <div className="console-spec-list">
                <div className="console-spec-item">
                  <span className="console-spec-key">Target Repository:</span>
                  <span className="console-spec-val font-mono">{repository.name}</span>
                </div>
                <div className="console-spec-item">
                  <span className="console-spec-key">Source Path:</span>
                  <span className="console-spec-val font-mono">{repository.sourcePath}</span>
                </div>
                <div className="console-spec-item">
                  <span className="console-spec-key">Indexed Scope:</span>
                  <span className="console-spec-val font-mono">
                    {repository.indexedFileCount} Java files, {repository.indexedChunkCount} vector chunks
                  </span>
                </div>
                <div className="console-spec-item">
                  <span className="console-spec-key">Telemetry Status:</span>
                  <span className="console-spec-val font-mono">{repository.indexingStatus || 'READY'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="message-feed" aria-live="polite">
              {messages.map((message) => (
                <article key={message.id} className="message-entry">
                  {/* User query row */}
                  <div className="user-query-row">
                    <span className="query-prompt-marker" aria-hidden="true">❯</span>
                    <span className="query-prompt-text">{message.question}</span>
                  </div>

                  {/* Assistant response row */}
                  {message.response ? (
                    message.response.noConfidentContext ? (
                      <div className="no-context-msg" role="status">
                        <HelpCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <strong>No confident code matches</strong>
                          <p style={{ marginTop: 2 }}>{message.response.answer}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="copilot-answer-row">
                        {/* Precision Citations Bar */}
                        {message.response.citations.length > 0 && (
                          <div className="sources-bar" aria-label="Answer sources">
                            <span className="sources-label">
                              <FileCode size={13} />
                              <span>Sources Cited ({message.response.citations.length}):</span>
                            </span>
                            {message.response.citations.map((citation) => (
                              <button
                                className="source-chip citation-chip"
                                type="button"
                                key={`${message.id}-${citation.id}`}
                                onClick={() =>
                                  onInspect({
                                    filePath: citation.filePath,
                                    startLine: citation.startLine,
                                    endLine: citation.endLine,
                                    content: citation.snippet,
                                    citationId: citation.id,
                                  })
                                }
                                title={`Inspect ${citation.filePath} (lines ${citation.startLine}-${citation.endLine})`}
                              >
                                <span className="source-chip-num">[{citation.id}]</span>
                                <code className="chip-path">{citation.filePath}</code>
                                <span>:{citation.startLine}–{citation.endLine}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="markdown-body">
                          <ReactMarkdown
                            components={{
                              code(props) {
                                const { children, className, ...rest } = props;
                                const match = /language-(\w+)/.exec(className || '');
                                const content = String(children);
                                const isBlock = content.includes('\n') || Boolean(match);
                                if (isBlock) {
                                  return (
                                    <CodeBlock language={match ? match[1] : 'java'}>
                                      {content.replace(/\n$/, '')}
                                    </CodeBlock>
                                  );
                                }
                                return (
                                  <code className="inline-code" {...rest}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {message.response.answer}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )
                  ) : message.error ? (
                    <div style={{ padding: 16 }}>
                      <div className="inline-error-msg" role="alert">
                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1 }}>
                          <span>{message.error}</span>
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={submitting}
                              onClick={() => void send(message.question, message.id)}
                            >
                              Retry query
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="thinking-indicator" role="status" aria-live="polite">
                      <span className="thinking-pulse-line" aria-hidden="true" />
                      <span>
                        Querying vector store & synthesizing answer ({elapsedSeconds}s)
                      </span>
                      {elapsedSeconds >= 8 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          · Model warmup in progress
                        </span>
                      )}
                    </div>
                  )}
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Docked Console Composer */}
          <form className="composer-wrap" onSubmit={submit}>
            <label htmlFor="chat-question" className="sr-only">
              Question
            </label>
            <div className="composer-box">
              <textarea
                id="chat-question"
                className="composer-textarea"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                rows={2}
                placeholder={`Query ${repository.name}... (e.g. "How does the search endpoint handle vector similarity?")`}
                disabled={submitting}
                required
              />
              <div className="composer-footer-row">
                <span className="composer-hint">
                  Press Enter to send, Shift+Enter for newline · context top-5
                </span>
                <button
                  className="send-btn"
                  type="submit"
                  disabled={submitting || !question.trim()}
                >
                  <Send size={12} />
                  <span>{submitting ? 'Synthesizing…' : 'Send question'}</span>
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
