#!/usr/bin/env bash

# Loads variables from a .env file into the current Bash/Zsh session.
#
# Usage:
#   source ./load-env.sh
#
# Optional:
#   source ./load-env.sh .env.local
#
# Important:
#   Use source. If you run this script normally, the variables will only exist
#   inside the script process and will not remain in your current shell session.
#
# This script is safe to commit because it does not contain secrets.
# Secrets are read from the local .env file, which should not be committed.

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE"
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "Loaded environment variables from $ENV_FILE"