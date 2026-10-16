import { Button, Hr, Text } from '@react-email/components';
import { Layout, button, h1, p } from './Layout';

export interface DigestSection {
  habitat: string;
  emoji: string;
  url: string;
  newPosts: number;
  events: Array<{ title: string; when: string }>;
  openVotes: number;
}

export function DigestEmail({
  name,
  sections,
  settingsUrl,
}: {
  name: string;
  sections: DigestSection[];
  settingsUrl: string;
}) {
  return (
    <Layout
      preview="What’s been happening in your Habitats"
      footer={
        <>
          You get this once a week. <a href={settingsUrl}>Turn it off</a> any time.
        </>
      }
    >
      <Text style={h1}>Your week, {name.split(' ')[0]}</Text>
      {sections.map((s, i) => (
        <div key={s.url}>
          {i > 0 && <Hr style={{ borderColor: '#eadfcf' }} />}
          <Text style={{ ...p, fontWeight: 600, margin: '8px 0 6px' }}>
            {s.emoji} {s.habitat}
          </Text>
          {s.newPosts > 0 && (
            <Text style={{ ...p, margin: '0 0 4px' }}>
              • {s.newPosts} new {s.newPosts === 1 ? 'post' : 'posts'}
            </Text>
          )}
          {s.events.map((e) => (
            <Text key={e.title + e.when} style={{ ...p, margin: '0 0 4px' }}>
              • {e.title} — {e.when}
            </Text>
          ))}
          {s.openVotes > 0 && (
            <Text style={{ ...p, margin: '0 0 4px' }}>
              • {s.openVotes} open {s.openVotes === 1 ? 'vote' : 'votes'} waiting for you
            </Text>
          )}
          <Button href={s.url} style={{ ...button, marginTop: 8 }}>
            Open
          </Button>
        </div>
      ))}
    </Layout>
  );
}

export default DigestEmail;
