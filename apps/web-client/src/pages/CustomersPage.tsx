import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomersTable } from '../components/CustomersTable';
import type { Customer } from '../types/api-types';

import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

interface NewCustomerForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export const CustomersPage: React.FC = () => {
  const { user, business, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewCustomerForm>({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  // אם אין יוזר – להעיף ללוגין
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  const loadCustomers = async (searchQuery?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Customer[]>('/customers', {
        params: searchQuery ? { search: searchQuery } : {},
      });
      setCustomers(res.data);
    } catch (err: any) {
      console.error(err);
      setError('נכשלה טעינת הלקוחות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadCustomers(search);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      setError('שם וטלפון הם שדות חובה');
      return;
    }
    try {
      setError(null);
      setCreating(true);
      const userr:any = JSON.parse(localStorage.getItem('sb_user') as string) ;
      
      const userStat = {user: { ...form, businessId: userr?.businessId || null}  }
      await api.post('/customers', userStat);
      // איפוס הטופס
    //   setForm({ name: '', phone: '', email: '', notes: '' });
      // רענון רשימה
      await loadCustomers(search);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || 'יצירת הלקוחה נכשלה');
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) {
    return <div className="p-6">טוען...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header עליון */}
      <header className="bg-white shadow px-6 py-3 flex items-center justify-between">
        <div>
          <div className="font-semibold">
            שלום {user.email}
          </div>
          {business && (
            <div className="text-sm text-slate-600">
              עסק: {business.name}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/public')}
            className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-slate-50"
          >
            צפייה באתר הלקוחות
          </button>
          <button
            onClick={logout}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            התנתקות
          </button>
        </div>
      </header>

      {/* תוכן הדשבורד */}
      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">לקוחות</h1>
        </div>

        {/* אזור חיפוש + הוספת לקוחה */}
        <div className="grid gap-4 md:grid-cols-[2fr,1.5fr]">
          {/* חיפוש */}
          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3 text-sm">חיפוש לקוחות</h2>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש לפי שם או טלפון..."
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                חיפוש
              </button>
            </form>
          </section>

          {/* טופס הוספת לקוחה */}
          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3 text-sm">הוספת לקוחה חדשה</h2>
            <form onSubmit={handleCreate} className="space-y-2 text-sm">
              <div>
                <label className="block mb-1">שם *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block mb-1">טלפון *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block mb-1">אימייל</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1">הערות</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {error && (
                <div className="text-red-600 text-xs">{error}</div>
              )}
              <button
                type="submit"
                disabled={creating}
                className="mt-1 w-full bg-emerald-600 text-white py-2 rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {creating ? 'שומר...' : 'שמור לקוחה'}
              </button>
            </form>
          </section>
        </div>

        {/* טבלת לקוחות */}
        <section className="mt-6">
          {loading ? (
            <div>טוען לקוחות...</div>
          ) : (
            <CustomersTable customers={customers} />
          )}
        </section>
      </main>
    </div>
  );
};
