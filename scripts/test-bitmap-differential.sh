#!/usr/bin/env bash
set -euo pipefail

mkdir -p build

mapfile -t OPS < <(sed '/^[[:space:]]*$/d' verification/bitmap_vectors.txt)
dafny_output="$(dafny run verification/bitmap_model.dfy -- ${OPS[@]})"
printf '%s\n' "$dafny_output" | grep -E '^(S0|S63|F0|F63):' > build/bitmap_expected.txt
test "$(wc -l < build/bitmap_expected.txt)" -eq "${#OPS[@]}"

BITMAP_EXPECTED="$PWD/build/bitmap_expected.txt" cargo test --features host-test --manifest-path kernel/rust/Cargo.toml --test bitmap_differential
