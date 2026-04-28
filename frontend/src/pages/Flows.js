import React, { useEffect, useState } from 'react';
import { Card, Toggle, Btn, EmptyState, Badge } from '../components/UI';
import { flowsAPI } from '../services/api';

const TRIGGER_TYPES = [
  { value: 'new_follower',     label: 'New follower' },
  { value: 'keyword',          label: 'DM keyword' },
  { value: 'comment_keyword',  label: 'Comment keyword' },
  { value: 'story_reply',      label: 'Story reply' },
  { value: 'any_dm',           label: 'Any DM (catch-all)' },
];

const STEP_TYPES = [
  { value: 'send_message', label: 'Text Message',          icon: '💬' },
  { value: 'send_image',   label: 'Image',                 icon: '🖼️' },
  { value: 'send_video',   label: 'Video',                 icon: '🎥' },
  { value: 'delay',        label: 'Time Delay',            icon: '⏱️' },
  { value: 'send_buttons', label: 'Quick Reply Buttons',   icon: '🔘' },
];

const TRIGGER_COLOR = {
  new_follower: 'green', keyword: 'pink', comment_keyword: 'purple',
  story_reply: 'orange', any_dm: 'blue',
};

function msToDelay(ms) {
  if (!ms) return { value: 30, unit: 'seconds' };
  if (ms >= 60000 && ms % 60000 === 0) return { value: ms / 60000, unit: 'minutes' };
  return { value: Math.round(ms / 1000), unit: 'seconds' };
}

function delayToMs(value, unit) {
  return unit === 'minutes' ? Number(value) * 60000 : Number(value) * 1000;
}

function newStep(type) {
  switch (type) {
    case 'send_message': return { type, message: '' };
    case 'send_image':   return { type, imageUrl: '' };
    case 'send_video':   return { type, videoUrl: '' };
    case 'delay':        return { type, ms: 30000 };
    case 'send_buttons': return { type, text: '', buttons: [{ title: '', payload: '' }] };
    default:             return { type };
  }
}

// ─── StepCard ──────────────────────────────────────────────────────────────────
function StepCard({ step, index, total, onChange, onMoveUp, onMoveDown, onDelete }) {
  const info = STEP_TYPES.find(t => t.value === step.type) || {};

  const inp = {
    padding: '7px 10px', borderRadius: 6,
    border: '1px solid var(--border)', fontSize: 13,
    background: 'var(--bg)', color: 'var(--text)',
    width: '100%', outline: 'none', boxSizing: 'border-box',
  };

  const iconBtn = (label, onClick, disabled, color) => (
    <button onClick={onClick} disabled={disabled} style={{
      border: 'none', background: 'none', cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.25 : 0.6, fontSize: 13, padding: '2px 6px',
      color: color || 'var(--text)',
    }}>{label}</button>
  );

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10,
      background: 'var(--surface)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 10px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 15, marginRight: 2 }}>{info.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--text-muted)' }}>
          {info.label}
        </span>
        {iconBtn('↑', onMoveUp,  index === 0)}
        {iconBtn('↓', onMoveDown, index === total - 1)}
        {iconBtn('✕', onDelete, false, '#ef4444')}
      </div>

      <div style={{ padding: 12 }}>
        {step.type === 'send_message' && (
          <textarea
            value={step.message}
            onChange={e => onChange({ ...step, message: e.target.value })}
            placeholder="Type your message..."
            rows={3}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
          />
        )}

        {step.type === 'send_image' && (
          <input
            type="url"
            value={step.imageUrl}
            onChange={e => onChange({ ...step, imageUrl: e.target.value })}
            placeholder="https://example.com/image.jpg"
            style={inp}
          />
        )}

        {step.type === 'send_video' && (
          <input
            type="url"
            value={step.videoUrl}
            onChange={e => onChange({ ...step, videoUrl: e.target.value })}
            placeholder="https://example.com/video.mp4"
            style={inp}
          />
        )}

        {step.type === 'delay' && (() => {
          const d = msToDelay(step.ms);
          return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number" min={1} value={d.value}
                onChange={e => onChange({ ...step, ms: delayToMs(e.target.value, d.unit) })}
                style={{ ...inp, width: 90 }}
              />
              <select
                value={d.unit}
                onChange={e => onChange({ ...step, ms: delayToMs(d.value, e.target.value) })}
                style={{ ...inp, width: 'auto', flex: 1 }}
              >
                <option value="seconds">seconds</option>
                <option value="minutes">minutes</option>
              </select>
            </div>
          );
        })()}

        {step.type === 'send_buttons' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Message textarea */}
            <textarea
              value={step.text}
              onChange={e => onChange({ ...step, text: e.target.value })}
              placeholder="Message shown above the buttons..."
              rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
            />

            {/* Instagram-style button preview */}
            <div style={{
              background: '#111',
              borderRadius: 14,
              padding: '10px 10px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{ fontSize: 10, color: '#555', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2, paddingLeft: 2 }}>
                PREVIEW — max 3 buttons, 20 chars each
              </div>

              {step.buttons.map((btn, bi) => (
                <div key={bi}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      flex: 1,
                      background: '#1e1e1e',
                      borderRadius: 10,
                      border: '1px solid #2a2a2a',
                      overflow: 'hidden',
                    }}>
                      <input
                        value={btn.title}
                        maxLength={20}
                        onChange={e => {
                          const title = e.target.value;
                          const payload = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                          onChange({ ...step, buttons: step.buttons.map((b, j) => j === bi ? { title, payload } : b) });
                        }}
                        placeholder={`Button ${bi + 1} label`}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          textAlign: 'center', fontWeight: 600, fontSize: 14,
                          padding: '12px 14px', border: 'none',
                          background: 'transparent', color: '#fff', outline: 'none',
                        }}
                      />
                    </div>
                    {step.buttons.length > 1 && (
                      <button
                        onClick={() => onChange({ ...step, buttons: step.buttons.filter((_, j) => j !== bi) })}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '4px 6px', flexShrink: 0 }}
                      >✕</button>
                    )}
                  </div>
                  {/* Payload field — small, secondary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px 1px' }}>
                    <span style={{ fontSize: 10, color: '#444' }}>payload:</span>
                    <input
                      value={btn.payload}
                      onChange={e => onChange({ ...step, buttons: step.buttons.map((b, j) => j === bi ? { ...b, payload: e.target.value } : b) })}
                      placeholder="keyword"
                      style={{
                        flex: 1, fontSize: 10, fontFamily: 'monospace',
                        color: '#666', background: 'transparent',
                        border: 'none', borderBottom: '1px solid #2a2a2a',
                        outline: 'none', padding: '1px 2px',
                      }}
                    />
                  </div>
                </div>
              ))}

              {step.buttons.length < 3 && (
                <button
                  onClick={() => onChange({ ...step, buttons: [...step.buttons, { title: '', payload: '' }] })}
                  style={{
                    background: 'transparent', border: '1px dashed #333',
                    borderRadius: 10, padding: '10px', cursor: 'pointer',
                    fontSize: 12, color: '#555', width: '100%', marginTop: 2,
                  }}
                >+ Add button</button>
              )}
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              Tip: payload = keyword for the next flow. e.g. button "Cake Options" → create a flow triggered by keyword "cake_options".
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FlowModal ─────────────────────────────────────────────────────────────────
function FlowModal({ flow, onSave, onClose }) {
  const [name, setName]             = useState(flow?.name || '');
  const [triggerType, setTriggerType] = useState(flow?.trigger?.type || 'keyword');
  const [keywords, setKeywords]     = useState((flow?.trigger?.keywords || []).join(', '));
  const [steps, setSteps]           = useState(
    flow?.steps?.length ? flow.steps : [{ type: 'send_message', message: '' }]
  );
  const [saving, setSaving]         = useState(false);

  const updateStep = (i, updated) => setSteps(prev => prev.map((s, j) => j === i ? updated : s));
  const moveUp     = (i) => setSteps(prev => { const a = [...prev]; [a[i-1],a[i]]=[a[i],a[i-1]]; return a; });
  const moveDown   = (i) => setSteps(prev => { const a = [...prev]; [a[i],a[i+1]]=[a[i+1],a[i]]; return a; });
  const deleteStep = (i) => setSteps(prev => prev.filter((_, j) => j !== i));
  const addStep    = (type) => setSteps(prev => [...prev, newStep(type)]);

  const handleSave = async () => {
    if (!name.trim()) return alert('Flow name is required');
    if (steps.length === 0) return alert('Add at least one step');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        active: flow?.active ?? false,
        trigger: {
          type: triggerType,
          ...(['keyword', 'comment_keyword'].includes(triggerType) && keywords.trim()
            ? { keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) }
            : {}),
        },
        steps,
      };
      await onSave(payload);
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'unknown error'));
      setSaving(false);
    }
  };

  const inp = {
    padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--border)', fontSize: 13,
    background: 'var(--surface)', color: 'var(--text)',
    width: '100%', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14,
        width: 580, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>
            {flow ? 'Edit flow' : 'Create new flow'}
          </span>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text-muted)', lineHeight: 1,
          }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Flow name
            </label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome DM" style={inp} />
          </div>

          {/* Trigger */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Trigger
            </label>
            <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={inp}>
              {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {['keyword', 'comment_keyword'].includes(triggerType) && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Keywords <span style={{ fontWeight: 400 }}>(comma-separated)</span>
              </label>
              <input
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="link, info, price"
                style={inp}
              />
            </div>
          )}

          {/* Steps section */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 10 }}>
              FLOW STEPS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  index={i}
                  total={steps.length}
                  onChange={updated => updateStep(i, updated)}
                  onMoveUp={() => moveUp(i)}
                  onMoveDown={() => moveDown(i)}
                  onDelete={() => deleteStep(i)}
                />
              ))}
            </div>

            {/* Add step bar */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 7 }}>Add step:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STEP_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => addStep(t.value)}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 7,
                      background: 'var(--bg)', cursor: 'pointer',
                      padding: '5px 11px', fontSize: 12, color: 'var(--text)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save flow'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Step summary chip ─────────────────────────────────────────────────────────
function StepChip({ type }) {
  const info = STEP_TYPES.find(t => t.value === type);
  if (!info) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 20,
      background: 'var(--bg)', border: '1px solid var(--border)',
      fontSize: 11, color: 'var(--text-muted)',
    }}>
      {info.icon} {info.label}
    </span>
  );
}

// ─── Flows page ────────────────────────────────────────────────────────────────
export default function Flows() {
  const [flows,   setFlows]   = useState([]);
  const [modal,   setModal]   = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => flowsAPI.getAll().then(f => { setFlows(f); setLoading(false); });
  useEffect(() => { load(); }, []);

  const toggle = async (id, current) => {
    await flowsAPI.toggle(id, !current);
    setFlows(prev => prev.map(f => f.id === id ? { ...f, active: !current } : f));
  };

  const deleteFlow = async (id) => {
    if (!window.confirm('Delete this flow?')) return;
    await flowsAPI.delete(id);
    setFlows(prev => prev.filter(f => f.id !== id));
  };

  const handleSave = async (payload) => {
    if (modal?.id) {
      await flowsAPI.update(modal.id, payload);
    } else {
      await flowsAPI.create(payload);
    }
    setModal(null);
    load();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Flows</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {flows.length} total · {flows.filter(f => f.active).length} active
          </div>
        </div>
        <Btn primary onClick={() => setModal('new')}>+ New flow</Btn>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
      ) : flows.length === 0 ? (
        <EmptyState
          icon="→"
          title="No flows yet"
          subtitle="Create your first automation flow to start sending DMs automatically"
          action={<Btn primary onClick={() => setModal('new')}>Create first flow</Btn>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flows.map(flow => (
            <Card key={flow.id}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: '#fce7f3', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>💬</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{flow.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5, alignItems: 'center' }}>
                    <Badge color={TRIGGER_COLOR[flow.trigger?.type] || 'pink'}>
                      {flow.trigger?.type?.replace(/_/g, ' ')}
                    </Badge>
                    {flow.trigger?.keywords?.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'monospace' }}>
                        {flow.trigger.keywords.map(k => `"${k}"`).join(', ')}
                      </span>
                    )}
                  </div>
                  {flow.steps?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {flow.steps.map((s, i) => <StepChip key={i} type={s.type} />)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Btn small onClick={() => setModal(flow)}>Edit</Btn>
                  <Btn small danger onClick={() => deleteFlow(flow.id)}>Delete</Btn>
                  <Toggle on={flow.active} onChange={() => toggle(flow.id, flow.active)} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <FlowModal
          flow={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
