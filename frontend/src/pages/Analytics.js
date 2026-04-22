import React, { useEffect, useState } from 'react';
import { Card, CardHeader, StatCard } from '../components/UI';
import { analyticsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#e1306c', '#833ab4', '#f77737', '#1da1f2', '#22c55e'];

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    analyticsAPI.getStats().then(setStats).catch(() => {});
    analyticsAPI.getEvents(100).then(setEvents).catch(() => {});
  }, []);

  const pieData = stats?.byType
    ? Object.entries(stats.byType).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : [];

  // Group events by hour for chart
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    count: events.filter(e => new Date(e.timestamp).getHours() === h).length,
  }));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Analytics</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Last 7 days</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total automations fired" value={stats?.totalDMs ?? '—'} change="Last 7 days" />
        <StatCard label="Unique trigger types" value={Object.keys(stats?.byType || {}).length} />
        <StatCard label="Events logged" value={events.length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card>
          <CardHeader title="Automations by hour of day" />
          <div style={{ padding: 16, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} barSize={8}>
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-faint)' }} interval={3} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-faint)' }} />
                <Tooltip contentStyle={{ border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="By trigger type" />
          <div style={{ padding: 16, height: 200 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>
                No data yet
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Event log" />
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {events.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Events will appear here once automations fire
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {['Time', 'Type', 'Sender', 'Flow'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 16px', fontWeight: 500, color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--text-faint)' }}>
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 16px' }}>{ev.type?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '8px 16px', fontFamily: 'DM Mono, monospace' }}>{ev.senderId || '—'}</td>
                    <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>{ev.flowId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
