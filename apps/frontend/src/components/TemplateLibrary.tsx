/**
 * Template Library Component
 * UI for browsing, searching, and managing templates
 * Requirement 31.8: Build template library UI
 */

import React, { useState, useEffect } from 'react';
import type { Template } from '@codebase-onboarding/shared';

interface TemplateLibraryProps {
  tenantId: string;
  userId: string;
  userRole: string;
}

interface TemplateListItem {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  usageCount: number;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  tenantId: _tenantId,
  userId: _userId,
  userRole: _userRole,
}) => {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTags, setSearchTags] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, [page, searchTags]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });

      if (searchTags) {
        params.append('tags', searchTags);
      }

      const response = await fetch(`/api/templates?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      setTemplates(data.templates);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateDetails = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load template details');
      }

      const data = await response.json();
      setSelectedTemplate(data.template);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const useTemplate = async (templateId: string) => {
    try {
      await fetch(`/api/templates/${templateId}/use`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      // Reload templates to update usage count
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // const submitFeedback = async (templateId: string, rating: number, comment?: string) => {
  //   try {
  //     await fetch(`/api/templates/${templateId}/feedback`, {
  //       method: 'POST',
  //       headers: {
  //         'Authorization': `Bearer ${localStorage.getItem('token')}`,
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ rating, comment }),
  //     });

  //     // Reload templates to update rating
  //     loadTemplates();
  //   } catch (err: any) {
  //     setError(err.message);
  //   }
  // };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-gray-400">No ratings yet</span>;
    
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      );
    }
    return <span>{stars}</span>;
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="template-library min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Library</h1>
          <p className="text-gray-600">
            Browse and use standardized onboarding templates for your team
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search by tags (comma-separated)"
              value={searchTags}
              onChange={(e) => setSearchTags(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={loadTemplates}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Search
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Template Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
              onClick={() => loadTemplateDetails(template.id)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {template.name}
                  </h3>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    v{template.version}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {template.description}
                </p>

                {/* Tags */}
                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>Used {template.usageCount}x</span>
                    <div className="flex items-center gap-1">
                      {renderStars(template.rating)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useTemplate(template.id);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {templates.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No templates found</p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your search criteria
            </p>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Template Details Modal */}
        {selectedTemplate && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedTemplate(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {selectedTemplate.name}
                    </h2>
                    <p className="text-gray-600">{selectedTemplate.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* Template Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <span className="text-sm text-gray-500">Version:</span>
                    <span className="ml-2 text-sm font-medium">{selectedTemplate.version}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Usage Count:</span>
                    <span className="ml-2 text-sm font-medium">{selectedTemplate.usageCount}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Rating:</span>
                    <span className="ml-2">{renderStars(selectedTemplate.rating)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Sections:</span>
                    <span className="ml-2 text-sm font-medium">
                      {selectedTemplate.script.sections.length}
                    </span>
                  </div>
                </div>

                {/* Sections Preview */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Sections</h3>
                  <div className="space-y-2">
                    {selectedTemplate.script.sections.map((section) => (
                      <div key={section.id} className="p-3 bg-gray-50 rounded">
                        <h4 className="font-medium text-gray-900">{section.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {section.explanation.substring(0, 150)}...
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      useTemplate(selectedTemplate.id);
                      setSelectedTemplate(null);
                    }}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Use This Template
                  </button>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
