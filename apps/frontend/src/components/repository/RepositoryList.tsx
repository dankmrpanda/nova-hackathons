import React, { useState, useEffect } from 'react';
import type { Repository, RepositoryListResponse } from '@codebase-onboarding/shared';
import './repository.css';

interface RepositoryListProps {
  onSelectRepository: (repository: Repository) => void;
  onLoadRepositories: (page: number, search: string) => Promise<RepositoryListResponse>;
}

export const RepositoryList: React.FC<RepositoryListProps> = ({
  onSelectRepository,
  onLoadRepositories,
}) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perPage = 50;

  const loadRepositories = async (pageNum: number, search: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await onLoadRepositories(pageNum, search);
      setRepositories(response.repositories);
      setTotalCount(response.totalCount);
      setHasNextPage(response.hasNextPage);
      setPage(pageNum);
    } catch (err) {
      setError('Failed to load repositories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRepositories(1, searchQuery);
  }, [searchQuery]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      loadRepositories(page + 1, searchQuery);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      loadRepositories(page - 1, searchQuery);
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="repository-list">
      <div className="repository-list-header">
        <h2>Select Repository</h2>
        <div className="search-container">
          <input
            type="search"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={handleSearch}
            className="search-input"
            aria-label="Search repositories"
          />
          <span className="search-icon" aria-hidden="true">🔍</span>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="loading-state" role="status" aria-live="polite">
          <span>Loading repositories...</span>
        </div>
      ) : (
        <>
          <div className="repositories-grid">
            {repositories.length === 0 ? (
              <p className="no-repositories">No repositories found</p>
            ) : (
              repositories.map((repo) => (
                <button
                  key={repo.id}
                  className="repository-card"
                  onClick={() => onSelectRepository(repo)}
                  aria-label={`Select ${repo.fullName}`}
                >
                  <div className="repo-header">
                    <h3 className="repo-name">{repo.name}</h3>
                    {repo.isPrivate && (
                      <span className="private-badge" aria-label="Private repository">
                        🔒
                      </span>
                    )}
                  </div>
                  <p className="repo-owner">{repo.owner}</p>
                  {repo.description && (
                    <p className="repo-description">{repo.description}</p>
                  )}
                  <div className="repo-metadata">
                    {repo.primaryLanguage && (
                      <span className="repo-language">
                        <span className="language-dot" aria-hidden="true">●</span>
                        {repo.primaryLanguage}
                      </span>
                    )}
                    <span className="repo-size">{formatSize(repo.size)}</span>
                    {repo.hasSubmodules && (
                      <span className="repo-submodules" title="Has submodules">
                        📦
                      </span>
                    )}
                  </div>
                  <div className="repo-footer">
                    <span className="repo-date">Updated {formatDate(repo.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {repositories.length > 0 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {(page - 1) * perPage + 1} - {Math.min(page * perPage, totalCount)} of{' '}
                {totalCount}
              </div>
              <div className="pagination-controls">
                <button
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                  className="btn-secondary btn-small"
                  aria-label="Previous page"
                >
                  ← Previous
                </button>
                <span className="page-number">Page {page}</span>
                <button
                  onClick={handleNextPage}
                  disabled={!hasNextPage}
                  className="btn-secondary btn-small"
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
