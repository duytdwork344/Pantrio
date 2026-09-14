#!/usr/bin/env bash
# Generate Flutter API client from NestJS OpenAPI after:
#   pnpm openapi:export
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SPEC="$ROOT/packages/api-client/openapi.json"
OUT="$ROOT/apps/mobile/lib/core/api/generated"

if [[ ! -f "$SPEC" ]]; then
  echo "Missing $SPEC — run pnpm openapi:export first"
  exit 1
fi

mkdir -p "$OUT"
echo "OpenAPI spec ready at $SPEC"
echo "Install openapi_generator_cli when ready, e.g.:"
echo "  dart pub global activate openapi_generator_cli"
echo "  openapi-generator generate -i $SPEC -g dart-dio -o $OUT"
echo "Stub client remains at apps/mobile/lib/core/api/pantrio_api_client.dart"
