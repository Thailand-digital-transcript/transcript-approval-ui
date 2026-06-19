#!/usr/bin/env bash
set -euo pipefail
SRC="${TRANSCRIPT_LIB:-../transcript-lib}/src/main/resources/transcript/example/Transcript_v2.0.xml"
cp "$SRC" src/test/fixtures/Transcript_v2.0.xml
echo "synced fixture from $SRC"
