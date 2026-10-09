/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import {
  JaseNetConfig,
  RequestOptions,
  SyncRequestOptions,
  JaseNetResult,
  LifecycleHook,
  RequestHeader,
  EventStreamOptions,
} from '../types';

import { JsonSerializer } from '../serializers/JsonSerializer';
import type { SerializedBody } from '../serializers/ISerializer';
import { createSseParseState, pushSseText } from './sseParse';

export abstract class JaseNet {

  private static _config: JaseNetConfig;
  private static _defaultLifecycle?: LifecycleHook<unknown>;

  public static async fetch<T>(url: string, method: string, options: RequestOptions = {}): Promise<JaseNetResult<T>> {

    const fullUrl = JaseNet._buildUrl(url, options.query),
      serializer = options.serializer ?? JaseNet._config?.serializer ?? new JsonSerializer(),
      rLifecycle = JaseNet._getLifecycle(options.lifecycle);

    rLifecycle?.onStart?.();

    try {

      const rFetchOptions: RequestInit = {
        cache: 'no-store',
        keepalive: options.keepalive ?? false,
        method: method,
      };

      rFetchOptions.headers = (rFetchOptions.headers as Headers) || new Headers();
      rFetchOptions.headers.set(RequestHeader.RequestedWith, 'JaseNet Client API');

      rFetchOptions.headers.set(RequestHeader.ContentType, serializer.contentType);
      rFetchOptions.headers.set(RequestHeader.Accept, serializer.contentType);

      JaseNet._applyDefaultHeaders((key, value) => {
        (rFetchOptions.headers as Headers).set(key, value);
      });

      if (options.payload !== undefined && options.payload !== null) {

        rFetchOptions.body = serializer.serialize(options.payload) as BodyInit;

      }

      if (!options.skipAuth && JaseNet._config?.getToken) {

        const tToken = JaseNet._config.getToken();
        if (tToken) {

          rFetchOptions.headers.set(RequestHeader.Authorization, `Bearer ${tToken}`);

        }

      }

      if (JaseNet._config?.getCsrf) {

        const tToken = JaseNet._config.getCsrf();
        if (tToken) {

          rFetchOptions.headers.set(JaseNet._getCsrfHeader(), tToken);

        }

      }

      if (options.headers) {

        for (const [key, value] of Object.entries(options.headers)) {

          rFetchOptions.headers.set(key, value);

        }

      }

      const rFetchResult = await fetch(fullUrl, rFetchOptions);

      if (rFetchResult.status === 401 && JaseNet._config?.on401) {

        const tDoRetry = await JaseNet._config.on401(fullUrl);

        if (tDoRetry) {

          return this.fetch<T>(url, method, options);

        }

      }

      const buffer = await rFetchResult.arrayBuffer(),
        data = serializer.deserialize<T>(new Uint8Array(buffer));

      JaseNet.applyLifecycle(rLifecycle, rFetchResult.status, data);

      return {
        status: rFetchResult.status,
        data,
        headers: JaseNet._parseHeaders(rFetchResult.headers),
      };

    } catch (err) {

      JaseNet._config?.logger?.error?.('fetch error:', err);
      JaseNet.applyLifecycle(rLifecycle, -1, null, err);

      return { status: -1, error: err };

    }

  }

  public static fetchSync<T>(options: SyncRequestOptions): JaseNetResult<T> {

    const {
      url,
      method,
      headers = {},
      payload,
      serializer = new JsonSerializer(),
      timeout = 5000,
      skipAuth = false,
    } = options,
      fullUrl = JaseNet._buildUrl(url, options.query);

    try {

      const xhr = new XMLHttpRequest();
      xhr.open(method, fullUrl, false);
      xhr.timeout = timeout;

      xhr.setRequestHeader(RequestHeader.RequestedWith, 'JaseNet Client API');
      xhr.setRequestHeader(RequestHeader.ContentType, serializer.contentType);
      xhr.setRequestHeader(RequestHeader.Accept, serializer.contentType);

      JaseNet._applyDefaultHeaders((key, value) => {
        xhr.setRequestHeader(key, value);
      });

      if (!skipAuth && JaseNet._config?.getToken) {

        const token = JaseNet._config.getToken();
        if (token) {

          xhr.setRequestHeader(RequestHeader.Authorization, `Bearer ${token}`);

        }

      }

      if (JaseNet._config?.getCsrf) {

        const csrf = JaseNet._config.getCsrf();
        if (csrf) {

          xhr.setRequestHeader(JaseNet._getCsrfHeader(), csrf);

        }

      }

      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }

      const rBody = payload !== undefined && payload !== null
        ? serializer.serialize(payload)
        : undefined;

      JaseNet._sendXhrBody(xhr, rBody);

      const rBuffer = xhr.response,
        data = serializer.deserialize<T>(new Uint8Array(rBuffer));

      return {
        status: xhr.status,
        data,
        headers: JaseNet._parseXhrHeaders(xhr.getAllResponseHeaders()),
      };

    } catch (err) {

      JaseNet._config?.logger?.error?.('sync fetch error:', err);
      return { status: -1, error: err };

    }

  }

  public static setConfiguration(config: JaseNetConfig): void {

    JaseNet._config = config;

  }

  public static setDefaultLifecycle(hooks: LifecycleHook<unknown>): void {

    JaseNet._defaultLifecycle = hooks;

  }

  /**
   * Opens a Server-Sent Events stream and awaits until the body ends or
   * {@link EventStreamOptions.signal} aborts. Does not reconnect — callers loop if needed.
   * Auth / baseUrl / on401 match {@link fetch}; Accept is forced to {@code text/event-stream}.
   */
  public static async openEventStream(
    url: string,
    options: EventStreamOptions,
  ): Promise<JaseNetResult<void>> {

    return JaseNet._openEventStream(url, options, false);

  }

  private static async _openEventStream(
    url: string,
    options: EventStreamOptions,
    isRetry: boolean,
  ): Promise<JaseNetResult<void>> {

    const fullUrl = JaseNet._buildUrl(url);

    try {

      const headers = new Headers();
      headers.set(RequestHeader.RequestedWith, 'JaseNet Client API');
      headers.set(RequestHeader.Accept, 'text/event-stream');

      if (!options.skipDefaultHeaders) {

        JaseNet._applyDefaultHeaders((key, value) => {

          headers.set(key, value);

        });

      }

      // Force SSE accept after defaults (apps often default Accept to JSON).
      headers.set(RequestHeader.Accept, 'text/event-stream');

      if (!options.skipAuth && JaseNet._config?.getToken) {

        const token = JaseNet._config.getToken();
        if (token) {

          headers.set(RequestHeader.Authorization, `Bearer ${token}`);

        }

      }

      if (JaseNet._config?.getCsrf) {

        const csrf = JaseNet._config.getCsrf();
        if (csrf) {

          headers.set(JaseNet._getCsrfHeader(), csrf);

        }

      }

      if (options.headers) {

        for (const [key, value] of Object.entries(options.headers)) {

          headers.set(key, value);

        }

      }

      const init: RequestInit = {
        method: 'GET',
        headers,
        cache: 'no-store',
      };
      if (options.signal !== undefined) {

        init.signal = options.signal;

      }

      if (options.credentials !== undefined) {

        init.credentials = options.credentials;

      }

      const response = await fetch(fullUrl, init);

      if (response.status === 401 && JaseNet._config?.on401 && !isRetry) {

        const doRetry = await JaseNet._config.on401(fullUrl);
        if (doRetry) {

          return JaseNet._openEventStream(url, options, true);

        }

      }

      if (!response.ok) {

        options.onClose?.({
          reason: 'http_error',
          status: response.status,
          error: new Error(`Event stream HTTP ${response.status}`),
        });

        return {
          status: response.status,
          error: new Error(`Event stream HTTP ${response.status}`),
          headers: JaseNet._parseHeaders(response.headers),
        };

      }

      if (response.body == null) {

        options.onClose?.({
          reason: 'http_error',
          status: response.status,
          error: new Error('Event stream response had no body'),
        });

        return {
          status: response.status,
          error: new Error('Event stream response had no body'),
          headers: JaseNet._parseHeaders(response.headers),
        };

      }

      options.onOpen?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const state = createSseParseState();

      while (true) {

        if (options.signal?.aborted) {

          break;

        }

        const { done, value } = await reader.read();
        if (done) {

          break;

        }

        const events = pushSseText(state, decoder.decode(value, { stream: true }));
        for (const event of events) {

          await options.onEvent(event);

        }

      }

      if (options.signal?.aborted) {

        return { status: -1, error: new DOMException('Aborted', 'AbortError') };

      }

      options.onClose?.({
        reason: 'completed',
        status: response.status,
      });

      return {
        status: response.status,
        headers: JaseNet._parseHeaders(response.headers),
      };

    } catch (err) {

      if (options.signal?.aborted) {

        return { status: -1, error: err };

      }

      JaseNet._config?.logger?.error?.('event stream error:', err);
      options.onClose?.({
        reason: 'network_error',
        status: -1,
        error: err,
      });
      return { status: -1, error: err };

    }

  }

  private static _sendXhrBody(xhr: XMLHttpRequest, body: SerializedBody | undefined): void {

    if (body === undefined) {

      xhr.send();
      return;

    }

    if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer) {

      xhr.send(body as XMLHttpRequestBodyInit);
      return;

    }

    if (body instanceof Blob) {

      xhr.send(body);
      return;

    }

    throw new Error('Unsupported payload type for xhr.send()');

  }

  private static applyLifecycle<T>(
    lifecycle: LifecycleHook<T> | undefined,
    status: number,
    data: T | null,
    error?: unknown,
  ): void {

    try {

      if (status === 0 && error && lifecycle?.onError) {

        lifecycle.onError(error, status);

      } else if (status >= 200 && status < 300 && lifecycle?.onSuccess) {

        lifecycle.onSuccess(data as T, status);

      } else if (lifecycle?.onError) {

        lifecycle.onError(error ?? new Error('Unknown error'), status);

      }
    } finally {

      lifecycle?.onComplete?.();

    }

  }

  private static _applyDefaultHeaders(
    setHeader: (key: string, value: string) => void,
  ): void {

    const defaults = JaseNet._config?.getDefaultHeaders?.();
    if (!defaults) {

      return;

    }

    for (const [key, value] of Object.entries(defaults)) {

      setHeader(key, value);

    }

  }

  private static _buildUrl(path: string, query?: Record<string, unknown>): string {

    let finalUrl: URL;

    try {

      finalUrl = new URL(path);

    } catch {

      const base = JaseNet._config?.baseUrl || '';
      finalUrl = new URL(path, base);

    }

    if (query) {

      for (const [key, value] of Object.entries(query)) {

        if (value !== undefined && value !== null) {

          finalUrl.searchParams.append(key, String(value));

        }

      }

    }

    return finalUrl.toString();

  }

  private static _getCsrfHeader(): string {

    return JaseNet._config?.csrfHeader ?? RequestHeader.CsrfToken;

  }

  private static _getLifecycle(lifecycle?: LifecycleHook<unknown>): LifecycleHook<unknown> {

    return {

      onComplete: lifecycle?.onComplete ?? JaseNet._defaultLifecycle?.onComplete ?? JaseNet._noop,
      onError: lifecycle?.onError ?? JaseNet._defaultLifecycle?.onError ?? JaseNet._noop,
      onStart: lifecycle?.onStart ?? JaseNet._defaultLifecycle?.onStart ?? JaseNet._noop,
      onSuccess: lifecycle?.onSuccess ?? JaseNet._defaultLifecycle?.onSuccess ?? JaseNet._noop,
    };

  }

  private static _noop(): void {

  }

  private static _parseHeaders(headers: Headers): Record<string, string> {

    const result: Record<string, string> = {};
    headers.forEach((val, key) => {

      result[key.toLowerCase()] = val;

    });

    return result;

  }

  private static _parseXhrHeaders(headerStr: string): Record<string, string> {

    const headers: Record<string, string> = {};
    const lines = headerStr.trim().split(/\r?\n/);
    for (const line of lines) {

      const parts = line.split(': ');
      if (parts.length === 2 && typeof parts[0] === 'string') {

        headers[parts[0].toLowerCase()] = parts[1] as string;

      }

    }
    return headers;

  }

}
