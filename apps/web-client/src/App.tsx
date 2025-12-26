import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { BookAppointmentPage } from './pages/BookAppointmentPage';
import { PublicWelcomePage } from './pages/PublicWelcomePage';
import { DashboardLayout } from './layout/DashboardLayout';
import { DashboardHomePage } from './pages/DashboardHomePage';
import { AppointmentsWeekPage } from './pages/AppointmentsWeekPage';
import { CustomersPageWrapper } from './pages/CustomersPageWrapper';
import { ServicesPage } from './pages/ServicesPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>טוען...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppInner: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardHomePage />} />
        <Route path="appointments" element={<AppointmentsWeekPage showSideBar={false} appointments={[]} />} />
        <Route path="customers" element={<CustomersPageWrapper />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="/book-appointment"
        element={
          <PrivateRoute>
            <BookAppointmentPage />
          </PrivateRoute>
        }
      />
      {/* אתר לקוחות – פתוח, כרגע משתמש ב-business של ה-owner לצורך דמו */}
      <Route path="/public" element={<PublicWelcomePage />} />

      {/* ברירת מחדל */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
};

export default App;
