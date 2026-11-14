import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Send,
  FileCode,
  AlertCircle,
  HelpCircle,
  BookOpen,
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
    <div className="empty-workspace-state">
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--r-xl)',
          background: 'var(--bg-active)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <BookOpen size={20} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

const QUICK_PROMPTS = [
  'Explain repository architecture and key packages',
  'How does indexing and chunking work?',
  'Show database connection and vector search flow',
  'Find exception handling patterns in controllers',
];

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
          description="Import a local Java repository or choose one from the left sidebar to start asking questions."
        />
      ) : (
        <>
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <div className="chat-empty-icon">
                <Sparkles size={24} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h2 className="chat-empty-title">Ask about {repository.name}</h2>
                <p className="chat-empty-sub">
                  Indexed {repository.indexedFileCount} Java files and {repository.indexedChunkCount} vector chunks. Answers cite ground-truth code snippets.
                </p>
              </div>

              <div className="chat-quick-prompts">
                {QUICK_PROMPTS.map((promptText) => (
                  <button
                    key={promptText}
                    type="button"
                    className="quick-prompt-pill"
                    onClick={() => {
                      setQuestion(promptText);
                    }}
                  >
                    <span>{promptText}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-feed" aria-live="polite">
              {messages.map((message) => (
                <article key={message.id} className="message-group">
                  {/* User query */}
                  <div className="user-message">
                    <div className="msg-avatar user">U</div>
                    <div className="user-bubble">
                      <p>{message.question}</p>
                    </div>
                  </div>

                  {/* AI Response or Progress */}
                  {message.response ? (
                    message.response.noConfidentContext ? (
                      <div className="no-context-msg" role="status">
                        <HelpCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <strong>No confident code matches</strong>
                          <p style={{ marginTop: 2 }}>{message.response.answer}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="ai-answer-wrap">
                        <div className="msg-avatar ai">CC</div>
                        <div className="ai-answer-body">
                          {/* Perplexity-style top citations bar */}
                          {message.response.citations.length > 0 && (
                            <div className="sources-bar" aria-label="Answer sources">
                              <span className="sources-label">
                                <FileCode size={12} />
                                Sources Cited ({message.response.citations.length}):
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
                                  <code className="chip-path truncate">{citation.filePath}</code>
                                  <span style={{ color: 'var(--text-muted)' }}>:{citation.startLine}–{citation.endLine}</span>
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
                      </div>
                    )
                  ) : message.error ? (
                    <div className="inline-error-msg" role="alert">
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <span>{message.error}</span>
                        <div style={{ marginTop: 6 }}>
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
                  ) : (
                    <div className="thinking-indicator" role="status" aria-live="polite">
                      <div className="thinking-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                      <span>
                        Thinking… retrieving vector chunks & synthesizing answer ({elapsedSeconds}s)
                      </span>
                      {elapsedSeconds >= 8 && (
                        <span style={{ fontSize: 11, color: 'var(--text-xmuted)' }}>
                          · Model warmup active
                        </span>
                      )}
                    </div>
                  )}
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Composer */}
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
                placeholder={`Ask about ${repository.name}... (e.g. "How does the search endpoint handle vector similarity?")`}
                disabled={submitting}
                required
              />
              <div className="composer-footer-row">
                <span className="composer-hint">
                  Press <kbd className="kbd">Enter</kbd> to send, <kbd className="kbd">Shift+Enter</kbd> for new line · context top-5
                </span>
                <button
                  className="send-btn"
                  type="submit"
                  disabled={submitting || !question.trim()}
                >
                  <Send size={13} />
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
