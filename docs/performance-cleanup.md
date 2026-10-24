# Runtime cleanup and shared API routing

The production web app uses `src/main.tsx`; Vercel sends `/api/:path*` to
`api/router.ts`, which initializes and reuses the shared Express app in
`server.ts`. Standalone copies of those handlers were redundant. They have
been removed, while the Express route paths, HTTP methods, authentication,
authorization, request bodies and query parameters remain intact. The Lucy
implementation now lives in `src/server/lucy.ts` and is called by the existing
authenticated `/api/lucy` route.

Cleanup also removes unreferenced screens/helpers, unused imports and local
bindings, obsolete navigation definitions, and the unmounted merchant-support
console. That console previously ran a five-second polling timer and updated
three arrays in dashboard state even though none was rendered. Current support,
notifications, subscription and workspace recovery paths remain active.

The online cache now skips writes of an unchanged string, removal of an absent
key and clearing an empty cache. Repeating an identical value therefore does
not restart the debounce timer and postpone a real pending save. Actual changes
retain the existing persistence path and tenant key.

Runtime reachability was inspected across static imports, re-exports, dynamic
imports, server/API entry points and test imports. Ambient type declarations,
database migrations, rollback paths, stored history and legacy recovery data
are retained. An exported backend endpoint is not considered unused solely
because the browser does not call it.

Regression coverage includes public API forwarding, the staff-login query
parameter, singleton Express initialization, unchanged cache writes and real
cache persistence. Existing product/stock, purchase-payment and normalized
workspace suites remain part of CI. Website and PWA business saves remain
online-only; this cleanup does not enable browser offline replay.
