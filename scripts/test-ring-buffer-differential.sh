#!/usr/bin/env bash
set -euo pipefail

mkdir -p build

OPS="$(tr '
' ' ' < verification/ring_buffer_vectors.txt)"

dafny run --allow-warnings verification/ring_buffer_model.dfy -- $OPS |
  tee build/ring_buffer_dafny_output.txt

grep -E '^(P[0-9]+|O|K):' build/ring_buffer_dafny_output.txt > build/ring_buffer_expected.txt

EXPECTED_COUNT="$(grep -Ec '^[[:space:]]*(P[0-9]+|O|K)[[:space:]]*$' verification/ring_buffer_vectors.txt)"
ACTUAL_COUNT="$(wc -l < build/ring_buffer_expected.txt)"
test "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT"

cargo test   --features host-test   --test ring_buffer_differential   --manifest-path kernel/rust/Cargo.toml
