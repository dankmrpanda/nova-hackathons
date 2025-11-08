import React, { useState, useEffect } from 'react';
import type { FileTreeNode } from '@codebase-onboarding/shared';
import './repository.css';

interface FileTreeViewerProps {
  repositoryUrl: string;
  onLoadTree: (path?: string) => Promise<FileTreeNode[]>;
  selectedPaths: string[];
  onToggleSelection: (path: string, isDirectory: boolean) => void;
}

interface TreeNodeProps {
  node: FileTreeNode;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  children?: React.ReactNode;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  children,
}) => {
  const isDirectory = node.type === 'directory';
  const icon = node.type === 'directory' ? (isExpanded ? '📂' : '📁') : '📄';
  const indent = level * 1.5;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-node-content ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${indent}rem` }}
      >
        {isDirectory && (
          <button
            className="tree-toggle"
            onClick={onToggle}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        <label className="tree-node-label">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            aria-label={`Select ${node.path}`}
          />
          <span className="tree-icon" aria-hidden="true">{icon}</span>
          <span className="tree-name">{node.path.split('/').pop()}</span>
          {!isDirectory && (
            <span className="tree-size">{formatSize(node.size)}</span>
          )}
        </label>
      </div>
      {isExpanded && children && (
        <div className="tree-children">{children}</div>
      )}
    </div>
  );
};

export const FileTreeViewer: React.FC<FileTreeViewerProps> = ({
  repositoryUrl,
  onLoadTree,
  selectedPaths,
  onToggleSelection,
}) => {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTree();
  }, [repositoryUrl]);

  const loadTree = async (path?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const nodes = await onLoadTree(path);
      if (path) {
        // Update specific subtree
        setTree((prevTree) => updateTreeWithNodes(prevTree, path, nodes));
      } else {
        setTree(nodes);
      }
    } catch (err) {
      setError('Failed to load file tree. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTreeWithNodes = (
    currentTree: FileTreeNode[],
    _targetPath: string,
    _newNodes: FileTreeNode[]
  ): FileTreeNode[] => {
    // Simple implementation - in production, this would be more sophisticated
    return currentTree;
  };

  const handleToggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
      // Load children if not already loaded
      loadTree(path);
    }
    setExpandedPaths(newExpanded);
  };

  const handleToggleSelection = (node: FileTreeNode) => {
    onToggleSelection(node.path, node.type === 'directory');
  };

  const renderTree = (nodes: FileTreeNode[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isExpanded = expandedPaths.has(node.path);
      const isSelected = selectedPaths.includes(node.path);

      return (
        <TreeNode
          key={node.path}
          node={node}
          level={level}
          isExpanded={isExpanded}
          isSelected={isSelected}
          onToggle={() => handleToggleExpand(node.path)}
          onSelect={() => handleToggleSelection(node)}
        >
          {/* Children would be rendered here in a full implementation */}
        </TreeNode>
      );
    });
  };

  return (
    <div className="file-tree-viewer">
      <div className="file-tree-header">
        <h3>Select Files and Folders</h3>
        <div className="selection-summary">
          {selectedPaths.length} item{selectedPaths.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {isLoading && tree.length === 0 ? (
        <div className="loading-state" role="status" aria-live="polite">
          <span>Loading file tree...</span>
        </div>
      ) : (
        <div className="file-tree" role="tree">
          {tree.length === 0 ? (
            <p className="no-files">No files found</p>
          ) : (
            renderTree(tree)
          )}
        </div>
      )}
    </div>
  );
};
