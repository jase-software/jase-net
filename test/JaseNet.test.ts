/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JaseNet } from '../src/core/JaseNet';
import { JsonSerializer } from '../src/serializers/JsonSerializer';

afterEach(() => {

  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  JaseNet.setConfiguration({
    baseUrl: 'https://api.example.com/',
    serializer: new JsonSerializer(),
  });

});

describe('JaseNet.fetch', () => {

  it('GETs JSON and returns status, data, and headers', async () => {

    JaseNet.setConfiguration({
      baseUrl: 'https://api.example.com/',
      serializer: new JsonSerializer(),
    });

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-trace': 'abc' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await JaseNet.fetch<{ id: number }>('items/1', 'GET');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/items/1');
    expect(init.method).toBe('GET');
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: 1 });
    expect(result.headers?.['x-trace']).toBe('abc');
    expect(result.error).toBeUndefined();

  });

  it('attaches bearer token unless skipAuth is set', async () => {

    JaseNet.setConfiguration({
      baseUrl: 'https://api.example.com/',
      getToken: () => 'secret-token',
      serializer: new JsonSerializer(),
    });

    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await JaseNet.fetch('secure', 'GET');
    await JaseNet.fetch('anon', 'GET', { skipAuth: true });

    const withAuth = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    const withoutAuth = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers;

    expect(withAuth.get('authorization')).toBe('Bearer secret-token');
    expect(withoutAuth.get('authorization')).toBeNull();

  });

  it('retries once when on401 returns true', async () => {

    const on401 = vi.fn(async () => true);
    JaseNet.setConfiguration({
      baseUrl: 'https://api.example.com/',
      on401,
      serializer: new JsonSerializer(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await JaseNet.fetch<{ ok: boolean }>('retry-me', 'GET');

    expect(on401).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });

  });

  it('returns status -1 when fetch throws', async () => {

    JaseNet.setConfiguration({
      baseUrl: 'https://api.example.com/',
      serializer: new JsonSerializer(),
    });

    vi.stubGlobal('fetch', vi.fn(async () => {

      throw new Error('network down');

    }));

    const result = await JaseNet.fetch('broken', 'GET');

    expect(result.status).toBe(-1);
    expect(result.error).toBeInstanceOf(Error);

  });

});

describe('JaseNet.openEventStream', () => {

  it('parses SSE events until the body ends', async () => {

    JaseNet.setConfiguration({
      baseUrl: 'https://api.example.com/',
    });

    const body = new ReadableStream<Uint8Array>({
      start(controller) {

        controller.enqueue(new TextEncoder().encode('event: ping\ndata: 1\n\n'));
        controller.enqueue(new TextEncoder().encode('data: 2\n\n'));
        controller.close();

      },
    });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })));

    const events: Array<{ event: string; data: string }> = [];
    const result = await JaseNet.openEventStream('sse', {
      onEvent: (event) => {

        events.push({ event: event.event, data: event.data });

      },
    });

    expect(result.status).toBe(200);
    expect(events).toEqual([
      { event: 'ping', data: '1' },
      { event: 'message', data: '2' },
    ]);

  });

});
