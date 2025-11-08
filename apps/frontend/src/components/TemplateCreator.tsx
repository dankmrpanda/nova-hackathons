/**
 * Template Creator Component
 * UI for creating templates from interactive scripts
 * Requirement 31.1: Create templates from interactive scripts
 */

import React, { useState } from 'react';

interface TemplateCreatorProps {
  scriptId: string;
  onSuccess?: (templateId: string) => void;
  onCancel?: () => void;
}

export const TemplateCreator: React.FC<TemplateCreatorProps> = ({
  scriptId,
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  const validateTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/templates/validate-script/${scriptId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      const data = await response.json();
      setValidationResult(data.validation);

      if (!data.validation.isValid) {
        setError('Script validation failed. Please check the errors below.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scriptId,
          name,
          description,
          tags: tagsArray,
          metadata: {
            category,
            difficulty,
            estimatedDuration: parseInt(estimatedDuration) || 0,
            prerequisites: [],
            learningObjectives: [],
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create template');
      }

      const data = await response.json();
      
      if (onSuccess) {
        onSuccess(data.template.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="template-creator bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Template</h2>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Validation Result */}
      {validationResult && !validationResult.isValid && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Validation Issues</h3>
          <ul className="list-disc list-inside text-sm text-yellow-700">
            {validationResult.errors.map((err: string, idx: number) => (
              <li key={idx}>{err}</li>
            ))}
            {validationResult.sanitizationCheck.violations.map((violation: string, idx: number) => (
              <li key={`v-${idx}`}>{violation}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Template Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., React Architecture Onboarding"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template covers..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., react, architecture, frontend"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Frontend, Backend, DevOps"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Difficulty Level
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as any)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Estimated Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Duration (minutes)
          </label>
          <input
            type="number"
            value={estimatedDuration}
            onChange={(e) => setEstimatedDuration(e.target.value)}
            placeholder="e.g., 30"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={validateTemplate}
          disabled={loading}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
        >
          Validate Script
        </button>
        <button
          onClick={createTemplate}
          disabled={loading || !name || !description || (validationResult && !validationResult.isValid)}
          className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Template'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Templates are automatically validated to ensure they contain only
          sanitized content without raw code, secrets, or PII. This ensures safe cross-tenant sharing.
        </p>
      </div>
    </div>
  );
};
