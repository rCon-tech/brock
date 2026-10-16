'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TabsBlock({ tabs }: { tabs: Array<{ label: string; content: ReactNode }> }) {
  return (
    <Tabs defaultValue="0">
      <TabsList>
        {tabs.map((t, i) => (
          <TabsTrigger key={t.label} value={String(i)}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t, i) => (
        <TabsContent key={t.label} value={String(i)}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
