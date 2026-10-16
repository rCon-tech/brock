import { Button, Text } from '@react-email/components';
import { Layout, button, h1, p } from './Layout';

export function InviteEmail({ inviter, habitat, emoji, url }: { inviter: string; habitat: string; emoji: string; url: string }) {
  return (
    <Layout preview={`${inviter} invited you to ${habitat}`}>
      <Text style={h1}>
        {emoji} {inviter} invited you to {habitat}
      </Text>
      <Text style={p}>Habitat is a private space for a group of friends, built from the pieces you choose together.</Text>
      <Button href={url} style={button}>
        Join {habitat}
      </Button>
      <Text style={{ ...p, marginTop: 18, fontSize: 13, color: '#7a6f62' }}>
        This link is just for you and your friends. It expires in a few days.
      </Text>
    </Layout>
  );
}

export default InviteEmail;
