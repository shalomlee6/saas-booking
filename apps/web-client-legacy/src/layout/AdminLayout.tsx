import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ImpersonationBanner } from '../components/ImpersonationBanner';

export const AdminLayout: React.FC = () => {
  const { user, isSuperAdmin, logout } = useAuth();

  return (
    <div className="adminShell">
      <ImpersonationBanner />
      
      <header className="adminHeader">
        <div className="adminHeader__left">
          <Link to="/admin" className="adminHeader__logo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
            </svg>
            <span>SUPER ADMIN</span>
          </Link>
        </div>

        <nav className="adminHeader__nav">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `adminHeader__navLink ${isActive ? 'adminHeader__navLink--active' : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/businesses"
            className={({ isActive }) =>
              `adminHeader__navLink ${isActive ? 'adminHeader__navLink--active' : ''}`
            }
          >
            Businesses
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `adminHeader__navLink ${isActive ? 'adminHeader__navLink--active' : ''}`
            }
          >
            Settings
          </NavLink>
        </nav>

        <div className="adminHeader__right">
          {isSuperAdmin && (
            <div className="adminBadge">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
              </svg>
              <span>SUPER ADMIN</span>
            </div>
          )}
          {user && (
            <div className="adminHeader__user">
              <span className="adminHeader__userEmail">{user.email}</span>
            </div>
          )}
          <Link to="/dashboard" className="adminHeader__link">
            Business Dashboard
          </Link>
          <button onClick={logout} className="adminHeader__logout">
            Logout
          </button>
        </div>
      </header>

      <main className="adminMain">
        <Outlet />
      </main>
    </div>
  );
};

