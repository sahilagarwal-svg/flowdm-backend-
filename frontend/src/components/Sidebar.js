import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/',              label: 'Dashboard',    icon: '◉', exact: true },
  { to: '/flows',         label: 'Flows',        icon: '→' },
  { to: '/keywords',      label: 'Keywords',     icon: '#' },
  { to: '/story-replies', label: 'Story Replies', icon: '◎' },
  { to: '/comment-dms',  label: 'Comment DMs',  icon: '✦' },
  { to: '/analytics',    label: 'Analytics',    icon: '↗', section: 'Analytics' },
  { to: '/settings',     label: 'API Setup',    icon: '⊙', section: 'Settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();

  const activeClientId   = localStorage.getItem('activeClientId')   || '';
  const activeClientName = localStorage.getItem('activeClientName') || 'Default Account';
  const activeClientUser = localStorage.getItem('activeClientUser') || '';

  const initials = activeClientId
    ? activeClientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'ig';

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const goToClients = () => navigate('/clients');

  const styles = {
    sidebar: {
      width: 220, flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    },
    nav: { padding: '8px 8px', flex: 1, overflowY: 'auto' },
    sectionLabel: {
      fontSize: 10, fontWeight: 500, letterSpacing: '0.8px',
      textTransform: 'uppercase', color: 'var(--text-faint)',
      padding: '12px 8px 4px',
    },
  };

  const linkStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 8px', borderRadius: 6,
    fontSize: 13, color: isActive ? 'var(--text)' : 'var(--text-muted)',
    background: isActive ? 'var(--bg)' : 'transparent',
    fontWeight: isActive ? 500 : 400,
    textDecoration: 'none',
    transition: 'all 0.1s',
    marginBottom: 2,
    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
  });

  let lastSection = null;

  return (
    <div style={styles.sidebar}>

      {/* ← Back to clients */}
      <button
        onClick={goToClients}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          border: 'none', background: 'none', cursor: 'pointer',
          borderBottom: '1px solid var(--border)',
          width: '100%', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13 }}>←</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>All Clients</span>
      </button>

      {/* Active client card */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: activeClientId
            ? 'linear-gradient(135deg,#fce7f3,#fdf4ff)'
            : 'linear-gradient(135deg,#f77737,#e1306c,#833ab4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
          color: activeClientId ? '#e1306c' : '#fff',
          border: '1px solid var(--border)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeClientName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeClientId ? (activeClientUser || 'Instagram account') : 'env credentials'}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={styles.nav}>
        {navItems.map(item => {
          const showSection = item.section && item.section !== lastSection;
          if (showSection) lastSection = item.section;
          return (
            <React.Fragment key={item.to}>
              {showSection && <div style={styles.sectionLabel}>{item.section}</div>}
              <NavLink to={item.to} end={item.exact} style={linkStyle}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>FlowDM Admin</span>
        <button onClick={logout} title="Logout" style={{
          border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16, padding: 4,
        }}>⏻</button>
      </div>
    </div>
  );
}
