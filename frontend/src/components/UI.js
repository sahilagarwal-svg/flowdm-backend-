import React from 'react';

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', ...style,
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action }) {
  return (
    <div style={{
      padding: '14px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
      {action && <span style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>{action}</span>}
    </div>
  );
}

export function StatCard({ label, value, change, changeDown }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 16, boxShadow: 'var(--shadow)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>{value}</div>
      {change && (
        <div style={{ fontSize: 11, marginTop: 4, color: changeDown ? '#ef4444' : '#22c55e' }}>
          {change}
        </div>
      )}
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: 30, height: 16, borderRadius: 8,
        background: on ? 'var(--accent)' : '#d1d5db',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', width: 12, height: 12,
        borderRadius: '50%', background: '#fff',
        top: 2, left: on ? 16 : 2, transition: 'left 0.2s',
      }} />
    </div>
  );
}

export function Badge({ children, color = 'pink' }) {
  const colors = {
    pink: { bg: '#fce7f3', text: '#9d174d' },
    purple: { bg: '#ede9fe', text: '#5b21b6' },
    orange: { bg: '#ffedd5', text: '#9a3412' },
    blue: { bg: '#dbeafe', text: '#1e40af' },
    green: { bg: '#dcfce7', text: '#166534' },
  };
  const c = colors[color] || colors.pink;
  return (
    <span style={{
      fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500,
      background: c.bg, color: c.text,
    }}>
      {children}
    </span>
  );
}

export function Btn({ children, onClick, primary, small, danger, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '5px 10px' : '7px 14px',
        borderRadius: 'var(--radius-sm)',
        fontSize: small ? 12 : 13, fontWeight: 500,
        border: danger ? '1px solid #fca5a5' : primary ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: danger ? '#fee2e2' : primary ? 'var(--accent)' : 'var(--surface)',
        color: danger ? '#b91c1c' : primary ? '#fff' : 'var(--text)',
        cursor: 'pointer', transition: 'all 0.1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Input({ label, value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '8px 10px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)', fontSize: 13,
          background: 'var(--surface)', color: 'var(--text)',
          outline: 'none', width: '100%', ...style,
        }}
      />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>{subtitle}</div>
      {action}
    </div>
  );
}
