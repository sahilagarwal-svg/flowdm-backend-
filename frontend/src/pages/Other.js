import React from 'react';
import { Card, EmptyState, Btn } from '../components/UI';

export function Keywords() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Keywords</div>
      <Card>
        <EmptyState
          icon="#"
          title="Manage keyword triggers"
          subtitle="Keywords are managed inside each Flow. Go to Flows to create a keyword-triggered automation."
          action={<Btn primary onClick={() => window.location.href = '/flows'}>Go to Flows</Btn>}
        />
      </Card>
    </div>
  );
}

export function StoryReplies() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Story Replies</div>
      <Card>
        <EmptyState
          icon="◎"
          title="Automate story reply DMs"
          subtitle="Create a flow with the 'story_reply' trigger to automatically DM anyone who replies to your stories."
          action={<Btn primary onClick={() => window.location.href = '/flows'}>Create story flow</Btn>}
        />
      </Card>
    </div>
  );
}

export function CommentDMs() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Comment DMs</div>
      <Card>
        <EmptyState
          icon="✦"
          title="Auto-DM from comments"
          subtitle="Create a flow with the 'comment_keyword' trigger to automatically DM users who comment specific words."
          action={<Btn primary onClick={() => window.location.href = '/flows'}>Create comment flow</Btn>}
        />
      </Card>
    </div>
  );
}
