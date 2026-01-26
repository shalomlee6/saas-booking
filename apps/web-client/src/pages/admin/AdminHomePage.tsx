import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminBusinesses, type AdminBusiness } from '../../api/admin';
import { api } from '../../api/client';

interface AdminStats {
  totalBusinesses: number;
  activeBusinesses: number;
  payingBusinesses: number;
  issues: number;
}

interface PlanDistribution {
  free: number;
  normal: number;
  premium: number;
}

export const AdminHomePage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats>({
    totalBusinesses: 0,
    activeBusinesses: 0,
    payingBusinesses: 0,
    issues: 0,
  });
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution>({
    free: 0,
    normal: 0,
    premium: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentBusinesses, setRecentBusinesses] = useState<AdminBusiness[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const businesses = await getAdminBusinesses();
      
      // Calculate stats
      const total = businesses.length;
      const active = businesses.filter(b => b.settings.features.bookingEnabled).length;
      const paying = businesses.filter(b => b.settings.plan !== 'free').length;
      
      // Calculate plan distribution
      const distribution = businesses.reduce((acc, b) => {
        const plan = b.settings.plan as 'free' | 'normal' | 'premium';
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      }, { free: 0, normal: 0, premium: 0 } as PlanDistribution);

      setStats({
        totalBusinesses: total,
        activeBusinesses: active,
        payingBusinesses: paying,
        issues: 0, // Placeholder
      });
      
      setPlanDistribution(distribution);
      setRecentBusinesses(businesses.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="adminMain">
        <div className="adminKpiGrid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="adminKpiCard">
              <div className="adminSkeleton adminSkeleton--text" style={{ width: '60%' }} />
              <div className="adminSkeleton adminSkeleton--title" style={{ marginTop: '12px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px 0' }}>
          Super Admin Dashboard
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
          System overview and control center
        </p>
      </div>

      {/* KPI Cards */}
      <div className="adminKpiGrid">
        <div className="adminKpiCard">
          <div className="adminKpiCard__label">Total Businesses</div>
          <div className="adminKpiCard__value">{stats.totalBusinesses}</div>
          <div className="adminKpiCard__change">All registered businesses</div>
        </div>
        <div className="adminKpiCard">
          <div className="adminKpiCard__label">Active Businesses</div>
          <div className="adminKpiCard__value">{stats.activeBusinesses}</div>
          <div className="adminKpiCard__change">Booking enabled</div>
        </div>
        <div className="adminKpiCard">
          <div className="adminKpiCard__label">Paying Businesses</div>
          <div className="adminKpiCard__value">{stats.payingBusinesses}</div>
          <div className="adminKpiCard__change">Non-free plans</div>
        </div>
        <div className="adminKpiCard">
          <div className="adminKpiCard__label">Issues / Errors</div>
          <div className="adminKpiCard__value">{stats.issues}</div>
          <div className="adminKpiCard__change">System health</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="adminGrid adminGrid--2" style={{ marginTop: '24px' }}>
        {/* Plan Distribution */}
        <div className="adminCard">
          <div className="adminCard__header">
            <div>
              <h2 className="adminCard__title">Plan Distribution</h2>
              <p className="adminCard__subtitle">Business subscription breakdown</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: '14px' }}>Free</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '120px', height: '8px', background: '#0F172A', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(planDistribution.free / stats.totalBusinesses) * 100}%`,
                      height: '100%',
                      background: '#94A3B8',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '14px', minWidth: '30px', textAlign: 'left' }}>
                  {planDistribution.free}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: '14px' }}>Normal</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '120px', height: '8px', background: '#0F172A', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(planDistribution.normal / stats.totalBusinesses) * 100}%`,
                      height: '100%',
                      background: '#818CF8',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '14px', minWidth: '30px', textAlign: 'left' }}>
                  {planDistribution.normal}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: '14px' }}>Premium</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '120px', height: '8px', background: '#0F172A', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(planDistribution.premium / stats.totalBusinesses) * 100}%`,
                      height: '100%',
                      background: '#FBBF24',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '14px', minWidth: '30px', textAlign: 'left' }}>
                  {planDistribution.premium}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="adminCard">
          <div className="adminCard__header">
            <div>
              <h2 className="adminCard__title">System Status</h2>
              <p className="adminCard__subtitle">API and service health</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: '14px' }}>API Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                <span style={{ color: '#10B981', fontSize: '13px', fontWeight: 600 }}>Operational</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: '14px' }}>Database</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                <span style={{ color: '#10B981', fontSize: '13px', fontWeight: 600 }}>Connected</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: '14px' }}>Uptime</span>
              <span style={{ color: '#CBD5E1', fontSize: '13px', fontWeight: 500 }}>99.9%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="adminCard" style={{ marginTop: '24px' }}>
        <div className="adminCard__header">
          <div>
            <h2 className="adminCard__title">Recent Businesses</h2>
            <p className="adminCard__subtitle">Latest registered businesses</p>
          </div>
          <Link to="/admin/businesses" className="adminBtn adminBtn--ghost">
            View All
          </Link>
        </div>
        {recentBusinesses.length === 0 ? (
          <div className="adminEmptyState">
            <div className="adminEmptyState__text">No businesses yet</div>
          </div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentBusinesses.map((business) => (
                <tr key={business._id}>
                  <td>{business.name}</td>
                  <td>
                    <code style={{ background: 'rgba(148, 163, 184, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                      {business.slug}
                    </code>
                  </td>
                  <td>
                    <span className={`adminBadge--plan adminBadge--plan-${business.settings.plan}`}>
                      {business.settings.plan}
                    </span>
                  </td>
                  <td>
                    {business.settings.features.bookingEnabled ? (
                      <span style={{ color: '#10B981', fontSize: '13px' }}>Active</span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '13px' }}>Inactive</span>
                    )}
                  </td>
                  <td>
                    <Link
                      to={`/admin/businesses/${business._id}`}
                      className="adminBtn adminBtn--ghost"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
