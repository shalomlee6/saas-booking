import React from "react";
import { NavLink, Outlet } from "react-router-dom";

export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex flex-col">
      <header className="dashTopbar">
        {/* Left Group */}
        <div className="dashTopbar__left">
          <select className="pill">
            <option>כל השירותים</option>
          </select>
          <select className="pill">
            <option>כל העובדים</option>
            <option>עובד 1</option>
          </select>
        </div>

        {/* Center Group */}

        {/* Right Group */}
        <div className="dashTopbar__right">
          <select className="pill">
            <option value="day">יום</option>
            <option value="week">שבוע</option>
          </select>
          <button className="pill pill--primary">+ תור חדש</button>
        </div>
      </header>

      <div className="dashShell">
        <aside className="dashSidebar">
          <div className="dashSidebar__logo">SAAS</div>
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `dashSidebar__icon ${isActive ? "dashSidebar__icon--active" : ""}`
            }
            title="בית"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </NavLink>
          <NavLink
            to="/dashboard/appointments"
            className={({ isActive }) =>
              `dashSidebar__icon ${isActive ? "dashSidebar__icon--active" : ""}`
            }
            title="תורים"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
          </NavLink>
          <NavLink
            to="/dashboard/customers"
            className={({ isActive }) =>
              `dashSidebar__icon ${isActive ? "dashSidebar__icon--active" : ""}`
            }
            title="לקוחות"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </NavLink>
          <NavLink
            to="/dashboard/services"
            className={({ isActive }) =>
              `dashSidebar__icon ${isActive ? "dashSidebar__icon--active" : ""}`
            }
            title="שירותים"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7.01v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z" />
            </svg>
          </NavLink>
          <NavLink
            to="/dashboard/announcements"
            className={({ isActive }) =>
              `dashSidebar__icon ${isActive ? "dashSidebar__icon--active" : ""}`
            }
            title="הכרזות"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </NavLink>
          <NavLink
            to="/dashboard/reports"
            className={({ isActive }) =>
              `dashSidebar__icon ${isActive ? "dashSidebar__icon--active" : ""}`
            }
            title="דוחות"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
            </svg>
          </NavLink>
          <NavLink
            to="/dashboard/settings"
            className={({ isActive }) =>
              `dashSidebar__icon ${isActive ? "dashSidebar__icon--active" : ""}`
            }
            title="הגדרות"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </NavLink>
        </aside>

        <main className="dashMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
