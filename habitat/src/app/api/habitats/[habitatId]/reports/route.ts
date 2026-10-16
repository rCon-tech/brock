import { created, habitatRoute, parseBody } from '@/lib/api';
import { createReport, listReports } from '@/lib/reports';
import { ReportBody } from '@/lib/validation';

type P = { habitatId: string };

export const GET = habitatRoute<P>(async ({ member }) => ({ reports: await listReports(member) }));

export const POST = habitatRoute<P>(async ({ req, member }) =>
  created(await createReport(member, await parseBody(req, ReportBody))),
);
