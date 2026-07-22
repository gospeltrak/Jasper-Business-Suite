#!/usr/bin/env bash
# Vercel "Ignored Build Step" gate.
#
# Exit code contract Vercel expects from this script:
#   exit 0  -> SKIP this deploy (do not build/publish it)
#   exit 1  -> PROCEED with the normal build
#
# Design goal: only ever SKIP a deploy because our automated tests
# actually failed — i.e. because the code is genuinely broken in a way
# we've written a regression test for (see src/utils/*.test.ts, which
# cover the exact "deleted sale/expense resurrects" class of bug that
# shipped to production earlier). Any OTHER kind of failure here (npm
# install hiccup, network blip, unrelated tooling issue) must NOT block a
# deploy — that would silently make "git push" stop working for reasons
# that have nothing to do with whether the code is safe to ship, and
# would be far more confusing than just letting the normal build run.
set -uo pipefail

npm ci --no-audit --no-fund
if [ $? -ne 0 ]; then
  echo "[vercel-ignore-check] npm ci failed — this looks like an infra/tooling"
  echo "[vercel-ignore-check] issue, not a code problem. Proceeding with the"
  echo "[vercel-ignore-check] normal build rather than blocking the deploy."
  exit 1
fi

npm test
if [ $? -ne 0 ]; then
  echo "[vercel-ignore-check] Tests failed. Skipping this deploy so the"
  echo "[vercel-ignore-check] currently-live (working) version stays up."
  exit 0
fi

echo "[vercel-ignore-check] Tests passed. Proceeding with build."
exit 1
