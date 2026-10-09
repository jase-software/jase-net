/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import { describe, expect, it } from 'vitest';
import { CborSerializer } from '../src/serializers/CborSerializer';
import { JsonSerializer } from '../src/serializers/JsonSerializer';

describe('JsonSerializer', () => {

  const serializer = new JsonSerializer();

  it('round-trips objects', () => {

    const payload = { id: 7, name: 'widget' };
    const encoded = serializer.serialize(payload);
    const decoded = serializer.deserialize<typeof payload>(
      new TextEncoder().encode(encoded),
    );

    expect(decoded).toEqual(payload);

  });

  it('returns undefined for empty bodies', () => {

    expect(serializer.deserialize(new Uint8Array())).toBeUndefined();
    expect(serializer.deserialize(new TextEncoder().encode('   '))).toBeUndefined();

  });

});

describe('CborSerializer', () => {

  const serializer = new CborSerializer();

  it('round-trips objects as binary', () => {

    const payload = { ok: true, count: 3 };
    const encoded = serializer.serialize(payload);

    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(serializer.deserialize<typeof payload>(encoded)).toEqual(payload);

  });

});
