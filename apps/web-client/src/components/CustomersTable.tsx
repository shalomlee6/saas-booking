import React from 'react';
import type { Customer } from '../types/api-types';

interface Props {
  customers: Customer[];
}

export const CustomersTable: React.FC<Props> = ({ customers }) => {
  if (!customers.length) {
    return <div>אין עדיין לקוחות במערכת.</div>;
  }

  return (
    <table className="w-full border-collapse text-sm mt-4">
      <thead>
        <tr className="bg-slate-100">
          <th className="border px-2 py-1 text-right">שם</th>
          <th className="border px-2 py-1 text-right">טלפון</th>
          <th className="border px-2 py-1 text-right">אימייל</th>
          <th className="border px-2 py-1 text-right">הערות</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => (
          <tr key={c._id}>
            <td className="border px-2 py-1 text-right">{c.name}</td>
            <td className="border px-2 py-1 text-right">{c.phone}</td>
            <td className="border px-2 py-1 text-right">{c.email || '-'}</td>
            <td className="border px-2 py-1 text-right">{c.notes || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
