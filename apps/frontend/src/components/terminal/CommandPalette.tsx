import React, { useState, useEffect, useRef } from 'react';
import type { Command } from './Terminal';
import './terminal.css';

interface CommandPaletteProps {
  commands: Command[];
  onSelect: (command: Command) => void;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [filteredCommands, setFilteredCommands] = useState<Command[]>(commands);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    // Filter commands based on search
    if (search.trim()) {
      const filtered = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(search.toLowerCase()) ||
          cmd.description.toLowerCase().includes(search.toLowerCase()) ||
          cmd.aliases?.some((alias) => alias.toLowerCase().includes(search.toLowerCase()))
      );
      setFilteredCommands(filtered);
      setSelectedIndex(0);
    } else {
      setFilteredCommands(commands);
    }
  }, [search, commands]);

  useEffect(() => {
    // Handle click outside to close
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        onSelect(filteredCommands[selectedIndex]);
      }
    }
  };

  return (
    <div className="command-palette-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
      <div ref={paletteRef} className="command-palette" onKeyDown={handleKeyDown}>
        <div className="palette-search">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            className="palette-search-input"
            aria-label="Search commands"
          />
          <button
            onClick={onClose}
            className="palette-close"
            aria-label="Close command palette"
          >
            ×
          </button>
        </div>

        <div className="palette-commands" role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="no-commands">No commands found</div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.name}
                className={`palette-command ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => onSelect(cmd)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <div className="command-info">
                  <div className="command-name">{cmd.name}</div>
                  <div className="command-description">{cmd.description}</div>
                  <div className="command-usage">{cmd.usage}</div>
                </div>
                {cmd.aliases && cmd.aliases.length > 0 && (
                  <div className="command-aliases">
                    {cmd.aliases.map((alias) => (
                      <span key={alias} className="alias-badge">
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="palette-footer">
          <div className="palette-hint">
            <kbd>↑↓</kbd> Navigate
            <kbd>Enter</kbd> Select
            <kbd>Esc</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
};
