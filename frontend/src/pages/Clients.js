import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const EMPTY_FORM = {
  name: '', igUsername: '', igAccountId: '',
  accessToken: '', appSecret: '', webhookToken: '', leadSheetUrl: '',
};

// ─── Add / Edit Modal ──────────────────────────────────────────────────────────
function ClientModal({ client, onSave, onClose }) {
  const [form,   setForm]   = useState(client || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const isEdit = !!client?.id;

  const inp = {
    padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--border)', fontSize: 13,
    background: 'var(--bg)', color: 'var(--text)',
    width: '100%', outline: 'none', boxSizing: 'border-box',
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Client name is required');
    setSaving(true); setError('');
    try {
      if (isEdit) await api.patch(`/clients/${client.id}`, form);
      else        await api.post('/clients', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
      setSaving(false);
    }
  };

  const Field = ({ label, field, placeholder, type = 'text', hint }) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={form[field] || ''}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        style={inp}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14,
        width: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{isEdit ? 'Edit Client' : 'Add New Client'}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Client Name *" field="name" placeholder="e.g. Rahul Sharma / Brand Name" />

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 12 }}>
              INSTAGRAM DETAILS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Instagram Username" field="igUsername" placeholder="@theirbrand" />
              <Field label="Instagram Account ID" field="igAccountId" placeholder="17841404524961751"
                hint="Found in Meta Business Suite → Instagram Account → About" />
              <Field label="Access Token" field="accessToken" type="password" placeholder="IGAANxxx..."
                hint="Long-lived Instagram Graph API access token" />
              <Field label="App Secret" field="appSecret" type="password" placeholder="8fffb985ec..."
                hint="From Meta App Dashboard → App Settings → Basic" />
              <Field label="Webhook Verify Token" field="webhookToken" placeholder="any-random-string"
                hint="Must match what's set in Meta Webhooks dashboard" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>
              LEAD CAPTURE
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>
              When a user sends a phone number in DM, it will be automatically saved to this Google Sheet.
            </div>
            <Field
              label="Google Sheet URL"
              field="leadSheetUrl"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              hint={
                <>
                  Share the sheet with <strong style={{ userSelect: 'all' }}>instagram-leads@sustained-axis-495105-i1.iam.gserviceaccount.com</strong> as Editor
                </>
              }
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#f77737,#e1306c)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add client'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Client Card ───────────────────────────────────────────────────────────────
function ClientCard({ client, onEnter, onEdit, onDelete, isDefault }) {
  const [hovered, setHovered] = useState(false);
  const initials = isDefault ? 'ig' : (client.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        border: `2px solid ${hovered ? '#e1306c' : 'var(--border)'}`,
        borderRadius: 14,
        padding: '24px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        cursor: 'pointer',
        transition: 'all 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(225,48,108,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
        position: 'relative',
      }}
      onClick={onEnter}
    >
      {/* Avatar */}
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: isDefault
          ? 'linear-gradient(135deg,#f77737,#e1306c,#833ab4)'
          : 'linear-gradient(135deg,#fce7f3,#fdf4ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isDefault ? 16 : 18, fontWeight: 700,
        color: isDefault ? '#fff' : '#e1306c',
        border: '2px solid var(--border)',
      }}>
        {initials}
      </div>

      {/* Name */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
          {isDefault ? 'Default Account' : client.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {isDefault ? 'Uses env credentials' : (client.igUsername || 'No username set')}
        </div>
      </div>

      {/* Enter button */}
      <div style={{
        width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center',
        background: hovered ? 'linear-gradient(135deg,#f77737,#e1306c)' : 'var(--bg)',
        color: hovered ? '#fff' : 'var(--text-muted)',
        fontSize: 13, fontWeight: 600,
        border: `1px solid ${hovered ? 'transparent' : 'var(--border)'}`,
        transition: 'all 0.15s',
      }}>
        {hovered ? 'Enter workspace →' : 'Click to enter'}
      </div>

      {/* Edit — for default account */}
      {isDefault && (
        <div
          style={{ display: 'flex', gap: 6, width: '100%' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
          >
            Settings
          </button>
        </div>
      )}

      {/* Edit / Delete — only for non-default */}
      {!isDefault && (
        <div
          style={{ display: 'flex', gap: 6, width: '100%' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: 11, color: '#ef4444' }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Default Account Settings Modal ───────────────────────────────────────────
function DefaultSettingsModal({ onClose }) {
  const [sheetUrl, setSheetUrl] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    api.get('/settings/default_lead_sheet_url')
      .then(({ data }) => setSheetUrl(data.value || ''))
      .catch(() => {});
  }, []);

  const inp = {
    padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--border)', fontSize: 13,
    background: 'var(--bg)', color: 'var(--text)',
    width: '100%', outline: 'none', boxSizing: 'border-box',
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/settings', { key: 'default_lead_sheet_url', value: sheetUrl });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: 480, boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Default Account — Settings</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>LEAD CAPTURE</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
              When a user sends a phone number via the Default Account, it will be saved to this Google Sheet.
            </div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Google Sheet URL</label>
            <input
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={inp}
            />
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              Share the sheet with <strong style={{ userSelect: 'all' }}>instagram-leads@sustained-axis-495105-i1.iam.gserviceaccount.com</strong> as Editor
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>{error}</div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#f77737,#e1306c)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Clients Portal ───────────────────────────────────────────────────────
export default function Clients() {
  const [clients,        setClients]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [modal,          setModal]          = useState(null);
  const [defaultSettings, setDefaultSettings] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get('/clients');
      setClients(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const enterClient = (client) => {
    if (client) {
      localStorage.setItem('activeClientId',   client.id);
      localStorage.setItem('activeClientName', client.name);
      localStorage.setItem('activeClientUser', client.igUsername || client.name);
    } else {
      localStorage.removeItem('activeClientId');
      localStorage.removeItem('activeClientName');
      localStorage.removeItem('activeClientUser');
    }
    navigate('/');
  };

  const deleteClient = async (id) => {
    if (!window.confirm('Delete this client? Their flows will become unassigned.')) return;
    await api.delete(`/clients/${id}`);
    load();
  };

  const openEdit = async (client) => {
    try {
      const { data } = await api.get(`/clients/${client.id}`);
      setModal(data);
    } catch { setModal(client); }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Top bar */}
      <div style={{
        padding: '16px 32px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg,#f77737,#e1306c,#833ab4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}>ig</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>FlowDM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setModal('new')}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg,#f77737,#e1306c)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Add Client
          </button>
          <button onClick={logout} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '6px 10px' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Select Account</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Choose a client to manage their Instagram automation flows
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {/* Default account always first */}
            <ClientCard
              isDefault
              onEnter={() => enterClient(null)}
              onEdit={() => setDefaultSettings(true)}
            />

            {/* Client cards */}
            {clients.map(client => (
              <ClientCard
                key={client.id}
                client={client}
                onEnter={() => enterClient(client)}
                onEdit={() => openEdit(client)}
                onDelete={() => deleteClient(client.id)}
              />
            ))}

            {/* Add new card */}
            <div
              onClick={() => setModal('new')}
              style={{
                background: 'var(--surface)',
                border: '2px dashed var(--border)',
                borderRadius: 14, padding: '24px 20px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10, cursor: 'pointer',
                transition: 'all 0.15s',
                minHeight: 200,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#e1306c'; e.currentTarget.style.background = '#fff5f7'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text-muted)' }}>+</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'center' }}>Add new client</div>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <ClientModal
          client={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}

      {defaultSettings && (
        <DefaultSettingsModal onClose={() => setDefaultSettings(false)} />
      )}
    </div>
  );
}
