import React, { useState } from 'react';
import { Card, CardHeader, Input, Btn } from '../components/UI';

function Step({ num, done, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: done ? 'var(--accent)' : 'var(--bg)',
        border: `1px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600,
        color: done ? '#fff' : 'var(--text-muted)',
      }}>
        {done ? '✓' : num}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>{title}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{children}</div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('my-secret-token-123');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In production, POST these to /api/settings
    // For now, just show success
    alert('In production: these values go into your backend .env file\n\nINSTAGRAM_ACCESS_TOKEN=' + token + '\nINSTAGRAM_ACCOUNT_ID=' + accountId + '\nAPP_SECRET=' + appSecret + '\nWEBHOOK_VERIFY_TOKEN=' + verifyToken);
    setSaved(true);
  };

  return (
    <div style={{ padding: 24, maxWidth: 680 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>API Setup</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
        Connect your Instagram Business account to activate automations
      </div>

      {/* Steps guide */}
      <Card style={{ marginBottom: 24 }}>
        <CardHeader title="Setup guide" />
        <div style={{ padding: '20px 24px' }}>
          <Step num={1} title="Create a Meta Developer App">
            Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>developers.facebook.com</a> → My Apps → Create App → choose <strong>Business</strong> type.
          </Step>
          <Step num={2} title="Add Instagram Graph API product">
            In your app dashboard, click <em>Add Product</em> → find <strong>Instagram Graph API</strong> → Set Up. Also add the <strong>Webhooks</strong> product.
          </Step>
          <Step num={3} title="Get your credentials">
            App ID &amp; Secret are in <em>Settings → Basic</em>. Generate a Page Access Token via the Graph API Explorer. Get your IG Account ID by calling <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>GET /me/accounts</code>.
          </Step>
          <Step num={4} title="Configure the webhook">
            Set the callback URL to <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>https://your-server.com/webhook</code> and paste the verify token below. Subscribe to: <em>messages, comments, follows</em>.
          </Step>
        </div>
      </Card>

      {/* Credential fields */}
      <Card>
        <CardHeader title="Your credentials" />
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Instagram Access Token"
            value={token}
            onChange={setToken}
            placeholder="EAAxxxxxx..."
            type="password"
          />
          <Input
            label="Instagram Business Account ID"
            value={accountId}
            onChange={setAccountId}
            placeholder="17841400000000000"
          />
          <Input
            label="App Secret"
            value={appSecret}
            onChange={setAppSecret}
            placeholder="abcdef1234..."
            type="password"
          />
          <div>
            <Input
              label="Webhook Verify Token (choose any string)"
              value={verifyToken}
              onChange={setVerifyToken}
              placeholder="my-secret-token"
            />
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              Paste this same string in the Meta Webhooks dashboard when registering your webhook URL.
            </div>
          </div>

          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: 'var(--text-muted)' }}>
              Your webhook URL (paste into Meta)
            </div>
            <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              https://your-server.com/webhook
            </code>
          </div>

          <Btn primary onClick={handleSave}>Save credentials</Btn>
          {saved && <div style={{ fontSize: 12, color: '#22c55e' }}>✓ Saved — restart your backend server to apply</div>}
        </div>
      </Card>
    </div>
  );
}
