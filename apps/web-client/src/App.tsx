import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { BookAppointmentPage } from './pages/BookAppointmentPage';
import { PublicWelcomePage } from './pages/PublicWelcomePage';
import { DashboardPage } from './pages/DashboardPage';

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
            <DashboardPage />
            
          </PrivateRoute>
        }
      />
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
