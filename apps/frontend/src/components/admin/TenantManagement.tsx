import React, { useState } from 'react';
import './admin.css';

interface Tenant {
  id: string;
  name: string;
  organizationId: string;
  costLimit: number;
  maxConcurrentSessions: number;
  createdAt: Date;
  activeUsers: number;
  activeSessions: number;
}

export const TenantManagement: React.FC = () => {
  const [tenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="tenant-management">
      <div className="management-header">
        <h2>Tenant Management</h2>
        <button className="btn-primary">+ Add Tenant</button>
      </div>

      <div className="search-bar">
        <input
          type="search"
          placeholder="Search tenants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="tenants-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Organization</th>
              <th>Cost Limit</th>
              <th>Max Sessions</th>
              <th>Active Users</th>
              <th>Active Sessions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">
                  No tenants found
                </td>
              </tr>
            ) : (
              filteredTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td>{tenant.organizationId}</td>
                  <td>${tenant.costLimit}</td>
                  <td>{tenant.maxConcurrentSessions}</td>
                  <td>{tenant.activeUsers}</td>
                  <td>{tenant.activeSessions}</td>
                  <td>
                    <button className="btn-action">Edit</button>
                    <button className="btn-action">View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
