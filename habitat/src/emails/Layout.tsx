import type { ReactNode } from 'react';
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';

const brand = '#e8590c';

export function Layout({ preview, children, footer }: { preview: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#faf7f2', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px' }}>
          <Text style={{ fontSize: 22, fontWeight: 700, color: brand, margin: '0 0 16px' }}>🌿 Habitat</Text>
          <Section style={{ background: '#ffffff', borderRadius: 14, padding: '24px 22px', border: '1px solid #eadfcf' }}>
            {children}
          </Section>
          <Hr style={{ borderColor: '#eadfcf', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: 12, color: '#7a6f62', margin: 0 }}>
            {footer ?? 'You’re getting this because you have a Habitat account. Habitat is private to your group: nothing here is public.'}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const button = {
  backgroundColor: brand,
  color: '#ffffff',
  borderRadius: 10,
  padding: '12px 20px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
} as const;

export const h1 = { fontSize: 20, margin: '0 0 12px', color: '#2b241c' } as const;
export const p = { fontSize: 15, lineHeight: '22px', color: '#3d342a', margin: '0 0 14px' } as const;
