'use client';

import type { FeedCardProps } from '../sdk/types';
import { PollView, type PollData } from './PollView';

export function FeedCard({ record }: FeedCardProps) {
  return <PollView poll={record as FeedCardProps['record'] & { data: PollData }} />;
}
