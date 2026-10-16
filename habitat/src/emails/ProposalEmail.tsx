import { Button, Text } from '@react-email/components';
import { Layout, button, h1, p } from './Layout';

export function ProposalEmail({
  habitat,
  headline,
  detail,
  url,
  cta,
}: {
  habitat: string;
  headline: string;
  detail: string;
  url: string;
  cta: string;
}) {
  return (
    <Layout preview={headline}>
      <Text style={h1}>{headline}</Text>
      <Text style={p}>
        {detail} <strong>({habitat})</strong>
      </Text>
      <Button href={url} style={button}>
        {cta}
      </Button>
    </Layout>
  );
}

export default ProposalEmail;
