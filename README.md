# @jase/net

HTTP client for over-the-wire APIs. Supports JSON and CBOR payloads, optional auth/CSRF headers, lifecycle hooks, and Server-Sent Events.

## Install

Not published to npm yet. Consume from git or as a workspace package until then.

**Git dependency**

```bash
yarn add jase-software/jase-net#v0.1.0
# or
npm install jase-software/jase-net#v0.1.0
```

Use a branch or commit instead of a tag if you prefer (`#main`, `#abcdef0`).

**Yarn / npm workspace**

Point a workspace package at this repo (or a path checkout) and depend on `@jase/net@0.1.0`. Entry points resolve to TypeScript source under `src/`.

## Configuration

```ts
import { JaseNet, JsonSerializer } from '@jase/net';

JaseNet.setConfiguration({
  baseUrl: 'https://api.example.com/',
  serializer: new JsonSerializer(),
  getToken: () => localStorage.getItem('token') ?? undefined,
  getCsrf: () => document.querySelector('meta[name="csrf"]')?.getAttribute('content') ?? undefined,
  on401: async () => {
    // refresh credentials if needed; return true to retry the request
    return false;
  },
});
```

## Requests

```ts
const result = await JaseNet.fetch<MyDto>('api/items', 'GET');

if (result.error) {
  // network / client failure (status === -1)
} else {
  // result.status, result.data, result.headers
}
```

Pass a body with `payload`, override serialization per call, or skip auth:

```ts
import { CborSerializer } from '@jase/net';

await JaseNet.fetch('api/items', 'POST', {
  payload: { name: 'widget' },
  serializer: new CborSerializer(),
  skipAuth: true,
});
```

Synchronous XHR is available when a blocking call is required:

```ts
const result = JaseNet.fetchSync<MyDto>({
  url: 'api/items/1',
  method: 'GET',
});
```

## Event streams

```ts
const abort = new AbortController();

await JaseNet.openEventStream('api/sse', {
  signal: abort.signal,
  onEvent: ({ event, data }) => {
    // route by event name; data is the joined SSE data lines
  },
});
```

One connection until the body ends or abort — reconnect loops belong in the application.

## Serializers

| Class | Content-Type |
|-------|----------------|
| `JsonSerializer` | `application/json` |
| `CborSerializer` | `application/cbor` |

Both implement `ISerializer` (`serialize` / `deserialize`). The configured default is used when a request does not pass its own serializer.

## License

Mozilla Public License 2.0 — see [LICENSE](./LICENSE).
