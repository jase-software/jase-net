/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
import type { ISerializer } from './ISerializer';

export class JsonSerializer implements ISerializer {

  contentType = 'application/json';

  serialize(input: unknown): string {

    return JSON.stringify(input);

  }

  deserialize<T>(input: Uint8Array): T {

    const text = new TextDecoder().decode(input);
    if (text.trim().length === 0) {

      return undefined as T;

    }

    return JSON.parse(text) as T;

  }

}
