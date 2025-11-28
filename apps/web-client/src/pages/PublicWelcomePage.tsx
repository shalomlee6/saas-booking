import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Business } from '../types/api-types';

/**
 * זה המסך שהלקוחות של הקוסמטיקאית רואים.
 * בעתיד נשתמש ב-slug (לדוגמה /b/:slug),
 * כרגע נשתמש בעסק "המחובר" רק לצורך דמו.
 */
export const PublicWelcomePage: React.FC = () => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: בעתיד להחליף ל- /api/public/:slug/business
    api
      .get<Business>('/business/me')
      .then((res: { data: any; }) => setBusiness(res.data))
      .catch((err: any) => {
        console.error('Failed to load business for public page', err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>טוען...</div>;

  const name = business?.name || 'הקליניקה שלי';

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50">
      <div className="bg-white shadow-lg rounded-2xl p-8 max-w-xl w-full text-center">
        <h1 className="text-2xl font-bold mb-4">
          ברוכים הבאים ל{name}
        </h1>
        <p className="mb-3 text-slate-700">
          היי 💖, תודה שבחרת להגיע אלינו!
        </p>
        <p className="mb-3 text-slate-700">
          כאן תוכלי לקבוע תור בקלות, לראות טיפולים זמינים ולקבל תזכורות אוטומטיות.
        </p>
        <p className="mb-6 text-slate-700">
          המטרה שלנו היא לפנק אותך, לדאוג שתצאי מרוצה, ולהפוך כל טיפול לחוויה.
        </p>

        {business?.address && (
          <p className="text-sm text-slate-600 mb-2">
            כתובת: {business.address}
          </p>
        )}
        {business?.phone && (
          <p className="text-sm text-slate-600 mb-4">
            טלפון לקביעת תור: {business.phone}
          </p>
        )}

        <button className="px-4 py-2 bg-pink-500 text-white rounded-full font-medium hover:bg-pink-600">
          בקרוב: קביעת תור אונליין ✨
        </button>
      </div>
    </div>
  );
};
