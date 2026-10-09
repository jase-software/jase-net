/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import type { SseEvent } from '../types';

/** Mutable parse state for incremental SSE framing. */
export interface SseParseState {
  buffer: string;
  eventName: string;
  dataLines: string[];
  id?: string;
}

/** Creates initial SSE parse state. */
export function createSseParseState(): SseParseState {

  return {
    buffer: '',
    eventName: 'message',
    dataLines: [],
  };

}

/**
 * Feeds a decoded text chunk into {@link state} and returns completed events.
 * Spec-aligned enough for typical APIs: blank line dispatches; {@code :} comments ignored.
 */
export function pushSseText(
  state: SseParseState,
  chunk: string,
): SseEvent[] {

  const completed: SseEvent[] = [];
  state.buffer += chunk;
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() ?? '';

  for (const line of parts) {

    if (line.length === 0) {

      if (state.dataLines.length > 0) {

        const event: SseEvent = {
          event: state.eventName,
          data: state.dataLines.join('\n'),
        };
        if (state.id !== undefined) {

          event.id = state.id;

        }

        completed.push(event);

      }

      state.eventName = 'message';
      state.dataLines = [];
      delete state.id;
      continue;

    }

    if (line.startsWith(':')) {

      continue;

    }

    if (line.startsWith('event:')) {

      state.eventName = line.slice(6).trim();
      continue;

    }

    if (line.startsWith('data:')) {

      state.dataLines.push(line.slice(5).trimStart());
      continue;

    }

    if (line.startsWith('id:')) {

      state.id = line.slice(3).trim();

    }

  }

  return completed;

}
