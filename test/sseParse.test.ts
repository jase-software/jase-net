/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import { describe, expect, it } from 'vitest';
import { createSseParseState, pushSseText } from '../src/core/sseParse';

describe('pushSseText', () => {

  it('dispatches a default message event on a blank line', () => {

    const state = createSseParseState();
    const events = pushSseText(state, 'data: hello\n\n');

    expect(events).toEqual([{ event: 'message', data: 'hello' }]);

  });

  it('joins multi-line data and preserves event name and id', () => {

    const state = createSseParseState();
    const events = pushSseText(
      state,
      'event: tick\nid: 42\ndata: one\ndata: two\n\n',
    );

    expect(events).toEqual([
      { event: 'tick', data: 'one\ntwo', id: '42' },
    ]);

  });

  it('ignores comment lines', () => {

    const state = createSseParseState();
    const events = pushSseText(state, ': keep-alive\ndata: ok\n\n');

    expect(events).toEqual([{ event: 'message', data: 'ok' }]);

  });

  it('buffers incomplete frames across chunks', () => {

    const state = createSseParseState();

    expect(pushSseText(state, 'event: partial\ndata: he')).toEqual([]);
    expect(pushSseText(state, 'llo\n\n')).toEqual([
      { event: 'partial', data: 'hello' },
    ]);

  });

  it('resets fields after each dispatched event', () => {

    const state = createSseParseState();
    const events = pushSseText(
      state,
      'event: a\nid: 1\ndata: first\n\ndata: second\n\n',
    );

    expect(events).toEqual([
      { event: 'a', data: 'first', id: '1' },
      { event: 'message', data: 'second' },
    ]);

  });

});
