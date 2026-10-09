/*
 *    Copyright (C) 2026 JASE Software LLC.
 *
 *    This Source Code Form is subject to the terms of the Mozilla Public
 *    License, v. 2.0. If a copy of the MPL was not distributed with this
 *    file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 */
/** Body types supported by JaseNet fetch and sync XHR. */
export type SerializedBody = string | Uint8Array | ArrayBuffer | Blob;

/** Describes the serializer interface. */
export interface ISerializer {

  contentType: string;
  serialize(input: unknown): SerializedBody;
  deserialize<T>(input: Uint8Array): T;

}
