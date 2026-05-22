#!/usr/bin/env bash
# Apply the Better Auth schema to the DB in apps/auth/.env.
# Re-run after adding/changing plugins. Press `y` at the prompt.
set -a; source apps/auth/.env; set +a
pnpm dlx @better-auth/cli@latest migrate --config apps/auth/src/auth.ts
