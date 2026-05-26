#!/usr/bin/env bash
# Install IBKR TwsApi.jar into the local Maven repository.
# Usage: ./scripts/install-ib-api.sh /path/to/TwsApi.jar

set -euo pipefail

JAR_PATH="${1:-}"
VERSION="${2:-10.37.02}"

if [[ -z "${JAR_PATH}" || ! -f "${JAR_PATH}" ]]; then
  echo "Usage: $0 /path/to/TwsApi.jar [version]"
  exit 1
fi

mvn install:install-file \
  -Dfile="${JAR_PATH}" \
  -DgroupId=com.ib \
  -DartifactId=client \
  -Dversion="${VERSION}" \
  -Dpackaging=jar

echo "Installed com.ib:client:${VERSION}"
