import React, { useState, useRef, useEffect } from 'react';
import type { Command } from './Terminal';
import './terminal.css';

interface TerminalInputProps {
  onSubmit: (command: string) => void;
  onHistoryNavigation: (direction: 'up' | 'down') => string | undefined;
  commands: Command[];
}

export const TerminalInput: React.FC<TerminalInputProps> = ({
  onSubmit,
  onHistoryNavigation,
  commands,
}) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Command[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Update suggestions based on input
    if (input.trim()) {
      const filtered = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().startsWith(input.toLowerCase()) ||
          cmd.aliases?.some((alias) => alias.toLowerCase().startsWith(input.toLowerCase()))
      );
      setSuggestions(filtered);
      setSelectedSuggestion(0);
    } else {
      setSuggestions([]);
    }
  }, [input, commands]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input);
      setInput('');
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow up/down for history
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const historyCommand = onHistoryNavigation('up');
      if (historyCommand !== undefined) {
        setInput(historyCommand);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const historyCommand = onHistoryNavigation('down');
      if (historyCommand !== undefined) {
        setInput(historyCommand);
      }
    }

    // Handle tab for autocomplete
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      const selected = suggestions[selectedSuggestion];
      setInput(selected.name + ' ');
      setSuggestions([]);
    }

    // Handle arrow up/down for suggestion selection
    if (suggestions.length > 0) {
      if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    }
  };

  const handleSuggestionClick = (command: Command) => {
    setInput(command.name + ' ');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  return (
    <div className="terminal-input-container">
      {suggestions.length > 0 && (
        <div className="terminal-suggestions" role="listbox">
          {suggestions.map((cmd, index) => (
            <button
              key={cmd.name}
              className={`suggestion-item ${index === selectedSuggestion ? 'selected' : ''}`}
              onClick={() => handleSuggestionClick(cmd)}
              role="option"
              aria-selected={index === selectedSuggestion}
            >
              <div className="suggestion-name">{cmd.name}</div>
              <div className="suggestion-description">{cmd.description}</div>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="terminal-input-form">
        <span className="terminal-prompt" aria-hidden="true">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="terminal-input"
          placeholder="Type a command..."
          aria-label="Terminal command input"
          aria-autocomplete="list"
          aria-controls="terminal-suggestions"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
};
