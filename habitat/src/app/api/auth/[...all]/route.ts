import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';

// Built per request so the database client is not opened at build time.
export const GET = (req: Request) => toNextJsHandler(getAuth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(getAuth()).POST(req);
