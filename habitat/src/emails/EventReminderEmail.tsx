import { Button, Text } from '@react-email/components';
import { Layout, button, h1, p } from './Layout';

export function EventReminderEmail({ habitat, title, when, where, url }: { habitat: string; title: string; when: string; where?: string; url: string }) {
  return (
    <Layout preview={`Tomorrow: ${title}`}>
      <Text style={h1}>📅 {title}</Text>
      <Text style={p}>
        {when}
        {where ? ` · ${where}` : ''} <strong>({habitat})</strong>
      </Text>
      <Button href={url} style={button}>
        See the plan
      </Button>
    </Layout>
  );
}

export default EventReminderEmail;
