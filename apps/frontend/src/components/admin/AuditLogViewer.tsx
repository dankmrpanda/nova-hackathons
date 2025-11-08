import React, { useState } from 'react';
import './admin.css';

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  ipAddress: string;
}

export const AuditLogViewer: React.FC = () => {
  const [logs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');

  const filteredLogs = logs.filter((log) => {
    if (filterAction && !log.action.toLowerCase().includes(filterAction.toLowerCase())) {
      return false;
    }
    if (filterOutcome && log.outcome !== filterOutcome) {
      return false;
    }
    return true;
  });

  return (
    <div className="audit-log-viewer">
      <h2>Audit Logs</h2>

      <div className="log-filters">
        <input
          type="search"
          placeholder="Filter by action..."
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="filter-input"
        />
        <select
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value)}
          className="filter-select"
        >
          <option value="">All Outcomes</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <button className="btn-secondary">Export Logs</button>
      </div>

      <div className="logs-table">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User ID</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Outcome</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-data">
                  No audit logs found
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.userId}</td>
                  <td>{log.action}</td>
                  <td>{log.resource}</td>
                  <td>
                    <span className={`outcome-badge outcome-${log.outcome}`}>
                      {log.outcome}
                    </span>
                  </td>
                  <td>{log.ipAddress}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
