/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import type { ISerializer } from './ISerializer';
import { encode, decode } from 'cbor-x';

export class CborSerializer implements ISerializer {

  contentType = 'application/cbor';

  serialize(input: unknown): Uint8Array {

    const encoded = encode(input);
    return encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);

  }

  deserialize<T>(input: Uint8Array): T {

    return decode(input) as T;

  }

}
