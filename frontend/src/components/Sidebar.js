import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◉', exact: true },
  { to: '/flows', label: 'Flows', icon: '→' },
  { to: '/keywords', label: 'Keywords', icon: '#' },
  { to: '/story-replies', label: 'Story Replies', icon: '◎' },
  { to: '/comment-dms', label: 'Comment DMs', icon: '✦' },
  { to: '/analytics', label: 'Analytics', icon: '↗', section: 'Analytics' },
  { to: '/settings', label: 'API Setup', icon: '⊙', section: 'Settings' },
];

export default function Sidebar() {
  const styles = {
    sidebar: {
      width: 220, flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    },
    logo: {
      padding: '20px 16px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8,
    },
    logoIcon: {
      width: 28, height: 28, borderRadius: 8,
      background: 'linear-gradient(135deg, #f77737, #e1306c, #833ab4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 12, fontWeight: 700,
    },
    logoText: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' },
    nav: { padding: '10px 8px', flex: 1, overflowY: 'auto' },
    sectionLabel: {
      fontSize: 10, fontWeight: 500, letterSpacing: '0.8px',
      textTransform: 'uppercase', color: 'var(--text-faint)',
      padding: '12px 8px 4px',
    },
    account: {
      padding: '12px 16px',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 10,
    },
    avatar: {
      width: 30, height: 30, borderRadius: '50%',
      background: 'linear-gradient(135deg, #f77737, #e1306c)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 11, fontWeight: 600,
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
    position: 'relative',
    marginBottom: 2,
    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
  });

  let lastSection = null;

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>ig</div>
        <span style={styles.logoText}>FlowDM</span>
      </div>

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

      <div style={styles.account}>
        <div style={styles.avatar}>YB</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Your Brand</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>@yourbrand</div>
        </div>
      </div>
    </div>
  );
}
