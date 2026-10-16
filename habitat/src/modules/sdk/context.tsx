'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Role } from '@/lib/permissions';
import type { MemberDTO } from './types';

export interface HabitatContextValue {
  habitatId: string;
  slug: string;
  name: string;
  accent: string;
  me: { id: string; name: string; image: string | null; nickname: string | null; role: Role };
  members: Array<MemberDTO & { role: Role }>;
  /** Per-module settings, keyed by module id. */
  settings: Record<string, Record<string, unknown>>;
  photosEnabled: boolean;
}

const Ctx = createContext<HabitatContextValue | null>(null);

export function HabitatProvider({ value, children }: { value: HabitatContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHabitat(): HabitatContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHabitat must be used inside a Habitat');
  return v;
}

export function useMemberLookup() {
  const { members } = useHabitat();
  return (id: string | null | undefined) => members.find((m) => m.id === id) ?? null;
}

export const isAdmin = (role: Role) => role === 'owner' || role === 'admin';
