import React, { useEffect, useState } from 'react';
import { Card, CardHeader, StatCard } from '../components/UI';
import { analyticsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#e1306c', '#833ab4', '#f77737', '#1da1f2', '#22c55e'];

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [keywords, setKeywords] = useState([]);

  useEffect(() => {
    analyticsAPI.getStats().then(setStats).catch(() => {});
    analyticsAPI.getEvents(100).then(setEvents).catch(() => {});
    analyticsAPI.getKeywords().then(setKeywords).catch(() => {});
  }, []);

  const pieData = stats?.byType
    ? Object.entries(stats.byType).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : [];

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
        <StatCard label="Keywords tracked" value={keywords.length} change="Last 7 days" />
      </div>

      {/* Top Keywords */}
      <Card style={{ marginBottom: 24 }}>
        <CardHeader title="Top keywords — hit count (7 days)" />
        <div style={{ padding: '8px 16px 16px' }}>
          {keywords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No keyword triggers fired yet in the last 7 days
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {keywords.map((kw, i) => {
                const max = keywords[0]?.count || 1;
                const pct = Math.round((kw.count / max) * 100);
                return (
                  <div key={kw.keyword} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 18, fontSize: 11, color: 'var(--text-faint)', textAlign: 'right', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: '#e1306c',
                      background: '#fce7f3', padding: '2px 8px', borderRadius: 10,
                      minWidth: 70, textAlign: 'center', flexShrink: 0,
                    }}>
                      #{kw.keyword}
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', height: 18 }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: 'linear-gradient(90deg, #f77737, #e1306c)',
                        borderRadius: 4, transition: 'width 0.4s',
                      }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                      {kw.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

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
                  {['Time', 'Type', 'Keyword', 'Sender', 'Flow'].map(h => (
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
                    <td style={{ padding: '8px 16px' }}>
                      {ev.keyword
                        ? <span style={{ background: '#fce7f3', color: '#e1306c', padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>#{ev.keyword}</span>
                        : <span style={{ color: 'var(--text-faint)' }}>—</span>
                      }
                    </td>
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
