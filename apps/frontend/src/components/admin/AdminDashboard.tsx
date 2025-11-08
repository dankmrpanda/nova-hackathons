import React, { useState } from 'react';
import { TenantManagement } from './TenantManagement';
import { PolicyConfiguration } from './PolicyConfiguration';
import { UsageAnalytics } from './UsageAnalytics';
import { AuditLogViewer } from './AuditLogViewer';
import './admin.css';

type AdminView = 'tenants' | 'policies' | 'analytics' | 'audit';

export const AdminDashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<AdminView>('tenants');

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Administration</h1>
        <div className="admin-nav">
          <button
            className={`admin-nav-btn ${currentView === 'tenants' ? 'active' : ''}`}
            onClick={() => setCurrentView('tenants')}
          >
            Tenants
          </button>
          <button
            className={`admin-nav-btn ${currentView === 'policies' ? 'active' : ''}`}
            onClick={() => setCurrentView('policies')}
          >
            Policies
          </button>
          <button
            className={`admin-nav-btn ${currentView === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentView('analytics')}
          >
            Analytics
          </button>
          <button
            className={`admin-nav-btn ${currentView === 'audit' ? 'active' : ''}`}
            onClick={() => setCurrentView('audit')}
          >
            Audit Logs
          </button>
        </div>
      </div>

      <div className="admin-content">
        {currentView === 'tenants' && <TenantManagement />}
        {currentView === 'policies' && <PolicyConfiguration />}
        {currentView === 'analytics' && <UsageAnalytics />}
        {currentView === 'audit' && <AuditLogViewer />}
      </div>
    </div>
  );
};
