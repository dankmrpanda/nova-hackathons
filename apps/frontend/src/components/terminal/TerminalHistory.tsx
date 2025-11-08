import React from 'react';
import type { TerminalMessage } from './Terminal';
import './terminal.css';

interface TerminalHistoryProps {
  messages: TerminalMessage[];
}

export const TerminalHistory: React.FC<TerminalHistoryProps> = ({ messages }) => {
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getMessageIcon = (type: TerminalMessage['type']) => {
    switch (type) {
      case 'user':
        return '>';
      case 'agent':
        return '🤖';
      case 'system':
        return 'ℹ️';
      case 'error':
        return '❌';
      default:
        return '';
    }
  };

  const renderContent = (content: string) => {
    // Simple syntax highlighting for code blocks
    const lines = content.split('\n');
    return lines.map((line, index) => (
      <div key={index} className="message-line">
        {line}
      </div>
    ));
  };

  return (
    <div className="terminal-history">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`terminal-message terminal-message-${message.type}`}
          role="listitem"
        >
          <div className="message-header">
            <span className="message-icon" aria-hidden="true">
              {getMessageIcon(message.type)}
            </span>
            <span className="message-timestamp" aria-label={`Time: ${formatTimestamp(message.timestamp)}`}>
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
          <div className="message-content">{renderContent(message.content)}</div>
        </div>
      ))}
    </div>
  );
};
