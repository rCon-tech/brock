import { describe, expect, it } from 'vitest';
import { clampLimit, HandleInput, readJson, ThrowBody } from '@/lib/validation';

const post = (body: string, type?: string) =>
  new Request('http://localhost/x', {
    method: 'POST',
    body,
    headers: type ? { 'content-type': type } : {},
  });

describe('readJson', () => {
  it('parses a JSON body', async () => {
    expect(await readJson(post('{"a":1}', 'application/json'))).toEqual({ a: 1 });
    expect(await readJson(post('{"a":1}', 'application/json; charset=utf-8'))).toEqual({ a: 1 });
  });

  it('refuses form encodings and missing content types, which cross-site forms can send', async () => {
    for (const type of [
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
      undefined,
    ]) {
      await expect(readJson(post('{"a":1}', type))).rejects.toMatchObject({
        code: 'invalid_request',
      });
    }
  });

  it('refuses malformed JSON', async () => {
    await expect(readJson(post('not json', 'application/json'))).rejects.toMatchObject({
      code: 'invalid_request',
    });
  });
});

describe('HandleInput', () => {
  it('accepts 3–20 letters, digits and underscores, and trims', () => {
    expect(HandleInput.parse('  Rich_B2 ')).toBe('Rich_B2');
    expect(HandleInput.safeParse('abc').success).toBe(true);
    expect(HandleInput.safeParse('a'.repeat(20)).success).toBe(true);
  });

  it('rejects everything else', () => {
    for (const bad of ['ab', 'a'.repeat(21), 'has space', 'dash-ed', 'emoji🪨', '<b>', '']) {
      expect(HandleInput.safeParse(bad).success).toBe(false);
    }
  });
});

describe('ThrowBody', () => {
  it('requires a positive integer round and a real throw', () => {
    expect(ThrowBody.safeParse({ roundNo: 1, throw: 'rock' }).success).toBe(true);
    for (const bad of [
      { roundNo: 0, throw: 'rock' },
      { roundNo: 1.5, throw: 'rock' },
      { roundNo: '1', throw: 'rock' },
      { roundNo: 1, throw: 'lizard' },
      { roundNo: 1 },
      null,
    ]) {
      expect(ThrowBody.safeParse(bad).success).toBe(false);
    }
  });
});

describe('clampLimit', () => {
  it('clamps to 1–100', () => {
    expect([
      clampLimit(0),
      clampLimit(-5),
      clampLimit(50),
      clampLimit(100),
      clampLimit(5000),
    ]).toEqual([1, 1, 50, 100, 100]);
  });
});
