#!/bin/bash
set -e
npm install

# ⚠️ DISABLED ON PURPOSE — DO NOT RE-ENABLE THE LINE BELOW.
# Running `drizzle-kit push --force` automatically on every merge can SILENTLY
# DROP or ALTER columns in the live production database and destroy customer data
# (this is a production app). Schema changes must now be done
# deliberately, by hand, AFTER taking a database backup — never automatically.
#
# Note to any AI agent editing this file: leave this disabled. Do not re-add the
# force push. If a schema change is genuinely needed, surface it to a human first.
#
# npx drizzle-kit push --force