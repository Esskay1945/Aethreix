import React from 'react';
import EvidenceCard from './EvidenceCard.jsx';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  // Simple markdown-like rendering (bold, code)
  const renderText = (text) => {
    if (!text) return null;

    return text.split('\n').map((line, i) => {
      // Bold
      let processed = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
      );
      // Inline code
      processed = processed.replace(
        /`(.*?)`/g,
        '<code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-family:var(--font-mono);font-size:12px">$1</code>'
      );

      // Bullet points
      if (processed.startsWith('- ')) {
        processed = '• ' + processed.slice(2);
      }

      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: processed }} />
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className={`message ${isUser ? 'user' : 'ai'}`}>
      <div className="message-avatar">
        {isUser ? 'U' : 'A'}
      </div>
      <div>
        <div className="message-bubble">
          {renderText(message.text)}
          {message.isStreaming && <span className="streaming-cursor">▌</span>}
        </div>
        {message.evidence && <EvidenceCard evidence={message.evidence} />}
      </div>
    </div>
  );
}
