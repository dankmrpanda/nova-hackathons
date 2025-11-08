import React from 'react';
import type { Role } from '@codebase-onboarding/shared';
import './auth.css';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: '🏠',
    roles: ['Developer', 'Collaborator', 'TeamLead', 'Administrator'],
  },
  {
    id: 'sessions',
    label: 'My Sessions',
    path: '/sessions',
    icon: '📊',
    roles: ['Developer', 'TeamLead', 'Administrator'],
  },
  {
    id: 'templates',
    label: 'Templates',
    path: '/templates',
    icon: '📋',
    roles: ['Developer', 'TeamLead', 'Administrator'],
  },
  {
    id: 'team',
    label: 'Team Analytics',
    path: '/team',
    icon: '👥',
    roles: ['TeamLead', 'Administrator'],
  },
  {
    id: 'admin',
    label: 'Administration',
    path: '/admin',
    icon: '⚙️',
    roles: ['Administrator'],
  },
];

interface RoleBasedNavProps {
  userRole: Role;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const RoleBasedNav: React.FC<RoleBasedNavProps> = ({
  userRole,
  currentPath,
  onNavigate,
}) => {
  const allowedItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <nav className="role-based-nav" aria-label="Main navigation">
      <ul className="nav-list">
        {allowedItems.map((item) => (
          <li key={item.id} className="nav-item">
            <button
              onClick={() => onNavigate(item.path)}
              className={`nav-link ${currentPath === item.path ? 'active' : ''}`}
              aria-current={currentPath === item.path ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
