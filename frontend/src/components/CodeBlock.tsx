import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = children.split('\n');
  const displayLang = language || 'code';

  const copy = () => {
    void navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrap">
      <div className="code-block-header">
        <span className="code-lang-badge">{displayLang}</span>
        <div className="code-block-actions">
          <span className="code-line-count">{lines.length} lines</span>
          <button
            type="button"
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={copy}
            aria-label="Copy code block"
          >
            {copied ? (
              <>
                <Check size={12} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="code-block-pre">
        <code>
          {lines.map((line, idx) => (
            <span className="code-line" key={idx}>
              <span className="line-number" aria-hidden="true">
                {idx + 1}
              </span>
              <span className="line-content">{line || ' '}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
