import React from 'react';
import { KpiCard } from './KpiCard';

interface DashboardKpiRowProps {
  todayCount: number;
  monthlyRevenue: string;
  topService: string;
}

export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  todayCount,
  monthlyRevenue,
  topService,
}) => {
  return (
    <div className="kpiRow">
      <KpiCard title="תורים היום" value={todayCount} tone="pink" />
      <KpiCard title="הכנסה חודשית" value={monthlyRevenue} tone="mint" />
      <KpiCard title="שירות מוביל" value={topService} tone="sky" />
    </div>
  );
};

