'use client';

import { EmptyState } from '@/components/EmptyState';
import { getModule } from '@/modules/ui-registry';

/** Renders an installed module's page. The server has already checked that it is installed. */
export function ModuleHost({ moduleId, path }: { moduleId: string; path: string[] }) {
  const Page = getModule(moduleId)?.Page;
  if (!Page) return <EmptyState emoji="🧩" title="This module has no page" />;
  return <Page path={path} />;
}
