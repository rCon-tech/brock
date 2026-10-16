import { Button, Text } from '@react-email/components';
import { Layout, button, h1, p } from './Layout';

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Layout preview="Your sign-in link for Habitat">
      <Text style={h1}>Sign in to Habitat</Text>
      <Text style={p}>Tap the button to sign in. The link works once and expires in 10 minutes.</Text>
      <Button href={url} style={button}>
        Sign in
      </Button>
      <Text style={{ ...p, marginTop: 18, fontSize: 13, color: '#7a6f62' }}>
        If you didn’t ask for this, you can ignore this email.
      </Text>
    </Layout>
  );
}

export default MagicLinkEmail;
