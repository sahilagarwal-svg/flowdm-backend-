import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { username, password });
      localStorage.setItem('token', data.token);
      localStorage.removeItem('activeClientId');
      localStorage.removeItem('activeClientName');
      localStorage.removeItem('activeClientUser');
      navigate('/clients');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        padding: '40px 36px', width: 360,
        boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
        border: '1px solid var(--border)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #f77737, #e1306c, #833ab4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700,
          }}>ig</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>FlowDM</span>
        </div>

        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Sign in</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          Enter your credentials to continue
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Username
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border)', fontSize: 13,
                background: 'var(--bg)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border)', fontSize: 13,
                background: 'var(--bg)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: '#ef4444',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 6, padding: '8px 12px',
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #f77737, #e1306c)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginTop: 4,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
