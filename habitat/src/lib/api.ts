import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { getDb } from '@/db';
import { env } from '@/env';
import { userFromRequest, type CurrentUser } from './current-user';
import { DomainError, badRequest, forbidden, unauthenticated } from './errors';
import { BadQueryError } from './record-query';
import { requireMember, type MemberCtx } from './session';

export interface Ctx<P> {
  req: Request;
  url: URL;
  params: P;
  user: CurrentUser;
}
export interface HabitatCtx<P> extends Ctx<P> {
  member: MemberCtx;
}

type RouteArgs<P> = [req: Request, context: { params: Promise<P> }];

export function json(body: unknown, status = 200, init: ResponseInit = {}) {
  return NextResponse.json(body, { status, ...init });
}
export const created = (body: unknown) => json(body, 201);

function errorResponse(e: unknown) {
  if (e instanceof DomainError) {
    return json(
      { error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } },
      e.status,
    );
  }
  if (e instanceof BadQueryError)
    return json({ error: { code: 'bad_query', message: e.message } }, 400);
  if (e instanceof ZodError) {
    return json(
      { error: { code: 'invalid', message: 'Some fields are not valid.', fields: fieldErrors(e) } },
      422,
    );
  }
  console.error('Unhandled route error', e);
  return json({ error: { code: 'internal', message: 'Something went wrong on our side.' } }, 500);
}

function fieldErrors(e: ZodError) {
  const fields: Record<string, string[]> = {};
  for (const i of e.issues) (fields[String(i.path[0] ?? '_')] ??= []).push(i.message);
  return fields;
}

/** Writes must come from our own pages. Browsers always send Origin on cross-site POSTs. */
function checkOrigin(req: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(env().NEXT_PUBLIC_APP_URL).origin) {
    throw new DomainError('bad_origin', 403, 'Request came from an unexpected origin.');
  }
  const site = req.headers.get('sec-fetch-site');
  if (!origin && site && site !== 'same-origin' && site !== 'none') {
    throw new DomainError('bad_origin', 403, 'Request came from an unexpected origin.');
  }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest('bad_json', 'The request body must be JSON.');
  }
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new DomainError('invalid', 422, 'Some fields are not valid.', fieldErrors(r.error));
  return r.data;
}

export function parseQuery<T>(
  url: URL,
  schema: ZodType<T>,
  extra: Record<string, unknown> = {},
): T {
  const raw: Record<string, unknown> = { ...extra };
  for (const [k, v] of url.searchParams) raw[k] = v;
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new DomainError('invalid', 422, 'Some fields are not valid.', fieldErrors(r.error));
  return r.data;
}

function wrap<P, C>(
  build: (req: Request, params: P) => Promise<C>,
  handler: (c: C) => Promise<unknown>,
) {
  return async (...[req, context]: RouteArgs<P>): Promise<Response> => {
    try {
      checkOrigin(req);
      const c = await build(req, await context.params);
      const out = await handler(c);
      if (out instanceof Response) return out;
      if (out === undefined) return new Response(null, { status: 204 });
      return json(out);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Signed-in users only. */
export function userRoute<P = Record<string, never>>(handler: (c: Ctx<P>) => Promise<unknown>) {
  return wrap<P, Ctx<P>>(async (req, params) => {
    const user = await userFromRequest(req);
    if (!user) throw unauthenticated();
    return { req, url: new URL(req.url), params, user };
  }, handler);
}

/** Signed-in members of `params.habitatId` only: anyone else gets the same 404. */
export function habitatRoute<P extends { habitatId: string }>(
  handler: (c: HabitatCtx<P>) => Promise<unknown>,
) {
  return wrap<P, HabitatCtx<P>>(async (req, params) => {
    const user = await userFromRequest(req);
    if (!user) throw unauthenticated();
    const member = await requireMember(getDb(), params.habitatId, user.id);
    return { req, url: new URL(req.url), params, user, member };
  }, handler);
}

/** No sign-in needed (invite preview). */
export function publicRoute<P = Record<string, never>>(
  handler: (c: { req: Request; url: URL; params: P }) => Promise<unknown>,
) {
  return wrap(async (req: Request, params: P) => ({ req, url: new URL(req.url), params }), handler);
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export { forbidden };
