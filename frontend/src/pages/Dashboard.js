import React, { useEffect, useState } from 'react';
import { StatCard, Card, CardHeader, Toggle, Badge } from '../components/UI';
import { flowsAPI, analyticsAPI } from '../services/api';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Dashboard() {
  const [flows, setFlows] = useState([]);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);

  useEffect(() => {
    flowsAPI.getAll().then(setFlows).catch(() => {});
    analyticsAPI.getStats().then(setStats).catch(() => {});
    analyticsAPI.getEvents(6).then(setEvents).catch(() => {});
    analyticsAPI.getDaily().then(setDailyStats).catch(() => {});
  }, []);

  const toggleFlow = async (id, current) => {
    await flowsAPI.toggle(id, !current);
    setFlows(prev => prev.map(f => f.id === id ? { ...f, active: !current } : f));
  };

  const chartData = dailyStats.length > 0
    ? dailyStats
    : DAYS.map(d => ({ day: d, dms: 0 }));

  const typeColor = { dm_keyword: 'pink', new_follower_dm: 'blue', story_reply_dm: 'orange', comment_dm: 'purple' };
  const typeLabel = { dm_keyword: 'Keyword DM', new_follower_dm: 'Follower DM', story_reply_dm: 'Story DM', comment_dm: 'Comment DM' };

  const triggerKeywords = (flow) => {
    const kws = flow.trigger?.keywords || (flow.trigger?.keyword ? [flow.trigger.keyword] : []);
    return kws.filter(Boolean);
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Setup banner */}
      <div style={{
        background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
        border: '1px solid #f9a8d4', borderRadius: 'var(--radius)',
        padding: '16px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#831843' }}>Finish setting up your account</div>
          <div style={{ fontSize: 12, color: '#9d174d', marginTop: 2 }}>Connect your Instagram API credentials to activate automations</div>
        </div>
        <a href="/settings" style={{
          padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
          background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
        }}>Continue setup →</a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="DMs sent (7d)" value={stats?.totalDMs ?? '—'} change="+18% vs last week" />
        <StatCard label="Open rate" value="74%" change="+3.2% vs last week" />
        <StatCard label="Reply rate" value="31%" change="-1.4% vs last week" changeDown />
        <StatCard label="Active flows" value={flows.filter(f => f.active).length} change={`${flows.length} total`} />
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Flows */}
        <Card>
          <CardHeader title="Active flows" action={<a href="/flows">View all</a>} />
          <div style={{ padding: 8 }}>
            {flows.slice(0, 5).map(flow => {
              const kws = triggerKeywords(flow);
              return (
                <div key={flow.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 8px', borderRadius: 6,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: '#fce7f3', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>💬</div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flow.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      <span>Trigger: {flow.trigger?.type}</span>
                      {kws.map(kw => (
                        <span key={kw} style={{
                          background: '#fce7f3', color: '#e1306c',
                          padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        }}>#{kw}</span>
                      ))}
                    </div>
                  </div>
                  <Toggle on={flow.active} onChange={() => toggleFlow(flow.id, flow.active)} />
                </div>
              );
            })}
            {flows.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No flows yet — <a href="/flows" style={{ color: 'var(--accent)' }}>create one</a>
              </div>
            )}
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader title="Recent activity" action="Live" />
          <div style={{ padding: 8 }}>
            {events.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Activity will appear here once automations are live
              </div>
            )}
            {events.map((ev, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 8px', borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, flexShrink: 0,
                }}>
                  {ev.senderId?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span>{ev.type?.replace(/_/g, ' ')}</span>
                    {ev.keyword && (
                      <span style={{
                        background: '#fce7f3', color: '#e1306c',
                        padding: '1px 5px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                      }}>#{ev.keyword}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <Badge color={typeColor[ev.type] || 'pink'}>{typeLabel[ev.type] || ev.type}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader title="DMs sent — last 7 days" />
        <div style={{ padding: 16, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={20}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-faint)' }} />
              <Tooltip
                contentStyle={{ border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                cursor={{ fill: 'var(--bg)' }}
              />
              <Bar dataKey="dms" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
