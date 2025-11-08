import React, { useState } from 'react';
import type { Annotation } from '@codebase-onboarding/shared';
import './script.css';

interface ScriptAnnotationsProps {
  annotations: Annotation[];
  onAddAnnotation: (content: string) => void;
}

export const ScriptAnnotations: React.FC<ScriptAnnotationsProps> = ({
  annotations,
  onAddAnnotation,
}) => {
  const [newNote, setNewNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      onAddAnnotation(newNote);
      setNewNote('');
    }
  };

  return (
    <div className="script-annotations">
      <h4>Notes & Annotations</h4>

      <form onSubmit={handleSubmit} className="annotation-form">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="annotation-input"
          rows={3}
        />
        <button type="submit" className="btn-add-note" disabled={!newNote.trim()}>
          Add Note
        </button>
      </form>

      <div className="annotations-list">
        {annotations.length === 0 ? (
          <p className="no-annotations">No notes for this section</p>
        ) : (
          annotations.map((annotation) => (
            <div key={annotation.id} className="annotation-item">
              <div className="annotation-content">{annotation.content}</div>
              <div className="annotation-meta">
                {new Date(annotation.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
