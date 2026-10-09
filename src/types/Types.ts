/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import type { ISerializer } from '../serializers/ISerializer';

/** Enumerator for request headers. */
export enum RequestHeader {

  Accept = 'accept',
  Authorization = 'authorization',
  ContentType = 'content-type',
  CsrfToken = 'x-csrf-token',
  RequestedWith = 'x-requested-with',

}

export interface JaseNetConfig {

  baseUrl?: string;

  csrfHeader?: string;

  getCsrf?: () => string | undefined;
  /**
   * Headers merged onto every request (before per-call `options.headers`).
   * Use for app-wide contract headers, tracing, etc.
   */
  getDefaultHeaders?: () => Record<string, string> | undefined;
  getToken?: () => string | undefined;

  on401?: (url: string) => Promise<boolean>;
  serializer?: ISerializer;

  logger?: {
    debug?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
  toast?: (msg: string) => void;

}

export interface RequestOptions {

  lifecycle?: LifecycleHook<unknown> | undefined;

  headers?: Record<string, string>;
  keepalive?: boolean;
  /** When true, do not attach the Bearer token (anonymous auth calls). */
  skipAuth?: boolean;
  payload?: unknown;
  serializer?: ISerializer;
  timeout?: number;
  query?: Record<string, string | number | boolean>;

}

export type ApiOptions = {

  contentType?: string;
  payload?: string | BodyInit | null;

  serializer?: ISerializer;
  timeout?: number;

  keepalive?: boolean;
  noCredentials?: boolean;
  noCacheBust?: boolean;

  requestId?: string;

};

export type LifecycleHook<T> = {

  onStart?: () => void;
  onSuccess?: (data: T, status: number) => void;
  onError?: (error: unknown, status: number) => void;
  onComplete?: () => void;

};

export interface SyncRequestOptions extends RequestOptions {

  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';

}

export type JaseNetResult<T = unknown> = {

  status: number;
  data?: T | null;
  headers?: Record<string, string>;
  error?: unknown;

};

/** One completed Server-Sent Event (comments are not emitted). */
export interface SseEvent {
  /** SSE `event:` field; defaults to {@code message} when omitted by the server. */
  event: string;
  /** Joined SSE `data:` lines. */
  data: string;
  /** SSE `id:` field when present. */
  id?: string;
}

/** Why an event stream ended (see {@link EventStreamOptions.onClose}). */
export type EventStreamCloseReason =
  | 'completed'
  | 'http_error'
  | 'network_error';

/** Passed to {@link EventStreamOptions.onClose}; omitted when the stream was aborted. */
export interface EventStreamCloseInfo {
  reason: EventStreamCloseReason;
  status: number;
  error?: unknown;
}

/** Options for {@code JaseNet.openEventStream}. */
export interface EventStreamOptions {
  /** Per-call headers (applied after config defaults). */
  headers?: Record<string, string>;
  /** When true, do not attach the Bearer token. */
  skipAuth?: boolean;
  /**
   * When true, skip {@link JaseNetConfig.getDefaultHeaders}.
   * Useful when app defaults set Accept/Content-Type unsuitable for SSE.
   */
  skipDefaultHeaders?: boolean;
  /** Abort the underlying fetch / reader. */
  signal?: AbortSignal;
  /** Fetch credentials mode (default: same as browser fetch — omit). */
  credentials?: RequestCredentials;
  /** Invoked once after a successful HTTP response before reading the body. */
  onOpen?: () => void;
  /**
   * Invoked when the stream ends or fails. Not called for intentional {@link EventStreamOptions.signal} abort.
   */
  onClose?: (info: EventStreamCloseInfo) => void;
  /**
   * Invoked for each completed event. May be async; events are awaited in order.
   */
  onEvent: (event: SseEvent) => void | Promise<void>;
}
