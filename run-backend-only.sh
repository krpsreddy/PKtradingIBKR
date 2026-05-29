#!/usr/bin/env bash
# 24/7 laptop: backend JAR only (no Angular). Mobile app → :8180
exec "$(cd "$(dirname "$0")" && pwd)/run-backend-jar.sh"
