import { habitatRoute } from '@/lib/api';
import { resolveReport } from '@/lib/reports';

export const PATCH = habitatRoute<{ habitatId: string; reportId: string }>(
  async ({ member, params }) => {
    await resolveReport(member, params.reportId);
  },
);
