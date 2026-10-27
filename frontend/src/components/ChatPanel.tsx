import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../services/api';
import type { ChatResponse, Repository, SourceExcerpt } from '../types';

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

export function ChatPanel({ repository, onInspect }: ChatPanelProps) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    if (!submitting) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [submitting]);

  async function send(questionText: string, retryId?: string) {
    if (!repository || pending.current || !questionText.trim()) return;
    const id = retryId || `${Date.now()}-${Math.random()}`;
    if (!retryId) setMessages((items) => [...items, { id, question: questionText.trim() }]);
    else setMessages((items) => items.map((item) => item.id === retryId ? { ...item, error: undefined } : item));
    pending.current = true;
    setSubmitting(true);
    try {
      const response = await api.chat({ repositoryId: repository.id, question: questionText.trim(), topK: 5 });
      setMessages((items) => items.map((item) => item.id === id ? { ...item, response, error: undefined } : item));
    } catch (error) {
      setMessages((items) => items.map((item) => item.id === id ? { ...item, error: error instanceof Error ? error.message : 'The request failed.' } : item));
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

  return (
    <section className="workspace-view chat-view" aria-labelledby="chat-view-title">
      <div className="view-heading"><div><h1 id="chat-view-title">Ask the codebase</h1><p>{repository ? `Answers use indexed context from ${repository.name}.` : 'Select a completed repository to start a grounded conversation.'}</p></div><span className="heading-marker" aria-hidden="true">[&gt;]</span></div>
      {!repository ? <EmptyWorkspace title="No repository selected" description="Import a local Java repository, then choose it in the left sidebar." /> : (
        <>
          {messages.length === 0 ? (
            <div className="chat-empty"><span aria-hidden="true">[ cc ]</span><h2>Ask about your code</h2><p>Questions are sent with this repository ID. Answers can include citations to returned code chunks.</p></div>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <article key={message.id} className="message-pair">
                  <div className="question-message"><span className="message-label">You</span><p>{message.question}</p></div>
                  {message.response ? (
                    message.response.noConfidentContext ? (
                      <div className="no-context-response" role="status"><strong>No confident code matches</strong><p>{message.response.answer}</p></div>
                    ) : <div className="assistant-message">
                      <div className="message-label">Copilot</div>
                      <div className="markdown-answer"><ReactMarkdown>{message.response.answer}</ReactMarkdown></div>
                      {message.response.citations.length > 0 && (
                        <div className="citation-list" aria-label="Answer sources">
                          <h3>Sources</h3>
                          {message.response.citations.map((citation) => (
                            <button className="citation-link" type="button" key={`${message.id}-${citation.id}`} onClick={() => onInspect({
                              filePath: citation.filePath,
                              startLine: citation.startLine,
                              endLine: citation.endLine,
                              content: citation.snippet,
                              citationId: citation.id,
                            })}>
                              <span>[{citation.id}]</span><code>{citation.filePath}</code><span>lines {citation.startLine}–{citation.endLine}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : message.error ? (
                    <div className="inline-error" role="alert"><span>{message.error}</span><button type="button" className="quiet-link" disabled={submitting} onClick={() => void send(message.question, message.id)}>Retry</button></div>
                  ) : <div className="chat-progress" role="status" aria-live="polite">
                    <p className="loading-line">Searching code and generating a response… {elapsedSeconds}s</p>
                    {elapsedSeconds >= 8 && <p className="muted-copy">One request is already in progress. A cold local model load can take several minutes; keep waiting instead of resending.</p>}
                  </div>}
                </article>
              ))}
            </div>
          )}
          <form className="composer" onSubmit={submit}>
            <label htmlFor="chat-question">Question</label>
            <textarea id="chat-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={3} placeholder="How does repository indexing work?" disabled={submitting} required />
            <div className="composer-footer"><span className="muted-copy">Up to 2,000 characters · context size 5</span><button className="action-button" type="submit" disabled={submitting || !question.trim()}>{submitting ? 'Working…' : 'Send question'}</button></div>
          </form>
        </>
      )}
    </section>
  );
}

export function EmptyWorkspace({ title, description }: { title: string; description: string }) {
  return <div className="empty-workspace"><span className="empty-mark" aria-hidden="true">[ ]</span><h2>{title}</h2><p>{description}</p></div>;
}
