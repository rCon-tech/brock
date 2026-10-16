import {
  BarChart3,
  Cake,
  CalendarDays,
  CheckSquare,
  Gift,
  Images,
  MessageCircle,
  Newspaper,
  Puzzle,
  ThumbsUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/** Module manifests name a lucide icon; only these are bundled. Unknown names get a puzzle piece. */
const ICONS: Record<string, LucideIcon> = {
  newspaper: Newspaper,
  images: Images,
  'calendar-days': CalendarDays,
  'message-circle': MessageCircle,
  'bar-chart-3': BarChart3,
  cake: Cake,
  'thumbs-up': ThumbsUp,
  gift: Gift,
  wallet: Wallet,
  'check-square': CheckSquare,
};

export function ModuleIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Puzzle;
  return <Icon size={size} className={className} aria-hidden />;
}
