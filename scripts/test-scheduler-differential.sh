#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

mkdir -p build

OPS="$(tr '
' ' ' < verification/scheduler_vectors.txt)"

dafny run --allow-warnings verification/scheduler_model.dfy -- $OPS |
  tee build/scheduler_dafny_output.txt

grep -E '^(E[0-9]+|P|D|N):' build/scheduler_dafny_output.txt > build/scheduler_expected.txt

EXPECTED_COUNT="$(grep -Ec '^[[:space:]]*(E[0-9]+|P|D|N)[[:space:]]*$' verification/scheduler_vectors.txt)"
ACTUAL_COUNT="$(wc -l < build/scheduler_expected.txt)"
test "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT"

cargo test   --features host-test   --test scheduler_differential   --manifest-path kernel/rust/Cargo.toml
