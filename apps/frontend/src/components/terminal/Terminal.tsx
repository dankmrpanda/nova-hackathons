import React, { useState, useEffect, useRef } from 'react';
import { TerminalHistory } from './TerminalHistory';
import { TerminalInput } from './TerminalInput';
import { CommandPalette } from './CommandPalette';
import './terminal.css';

export interface TerminalMessage {
  id: string;
  type: 'user' | 'agent' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

export interface Command {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
}

interface TerminalProps {
  onCommand: (command: string) => Promise<string>;
  commands: Command[];
  welcomeMessage?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  onCommand,
  commands,
  welcomeMessage = 'Welcome to Codebase Onboarding Agent. Type "help" for available commands.',
}) => {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add welcome message
    addMessage('system', welcomeMessage);
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (type: TerminalMessage['type'], content: string) => {
    const message: TerminalMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const handleCommand = async (command: string) => {
    if (!command.trim()) return;

    // Add user command to messages
    addMessage('user', command);

    // Add to command history
    setCommandHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);

    // Handle built-in commands
    if (command.toLowerCase() === 'clear') {
      setMessages([]);
      return;
    }

    if (command.toLowerCase() === 'help') {
      const helpText = commands
        .map((cmd) => `${cmd.name} - ${cmd.description}\n  Usage: ${cmd.usage}`)
        .join('\n\n');
      addMessage('system', helpText);
      return;
    }

    if (command.toLowerCase() === 'history') {
      const historyText = commandHistory
        .map((cmd, index) => `${index + 1}. ${cmd}`)
        .join('\n');
      addMessage('system', historyText || 'No command history');
      return;
    }

    // Execute custom command
    try {
      const response = await onCommand(command);
      addMessage('agent', response);
    } catch (error) {
      addMessage('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleKeyboardShortcut = (e: KeyboardEvent) => {
    // Ctrl+K or Cmd+K to open command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setIsPaletteOpen(true);
    }

    // Ctrl+L to clear terminal
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      setMessages([]);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, []);

  const handleHistoryNavigation = (direction: 'up' | 'down'): string | undefined => {
    if (direction === 'up') {
      const newIndex = historyIndex + 1;
      if (newIndex < commandHistory.length) {
        setHistoryIndex(newIndex);
        return commandHistory[commandHistory.length - 1 - newIndex];
      }
    } else {
      const newIndex = historyIndex - 1;
      if (newIndex >= 0) {
        setHistoryIndex(newIndex);
        return commandHistory[commandHistory.length - 1 - newIndex];
      } else if (newIndex === -1) {
        setHistoryIndex(-1);
        return '';
      }
    }
  };

  const handlePaletteCommand = (command: Command) => {
    setIsPaletteOpen(false);
    handleCommand(command.name);
  };

  return (
    <div className="terminal-container" role="region" aria-label="Interactive terminal">
      <div className="terminal-header">
        <div className="terminal-title">Terminal</div>
        <div className="terminal-shortcuts">
          <kbd>Ctrl+K</kbd> Command Palette
          <kbd>Ctrl+L</kbd> Clear
        </div>
      </div>

      <div
        ref={terminalRef}
        className="terminal-content"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <TerminalHistory messages={messages} />
      </div>

      <TerminalInput
        onSubmit={handleCommand}
        onHistoryNavigation={handleHistoryNavigation}
        commands={commands}
      />

      {isPaletteOpen && (
        <CommandPalette
          commands={commands}
          onSelect={handlePaletteCommand}
          onClose={() => setIsPaletteOpen(false)}
        />
      )}
    </div>
  );
};
