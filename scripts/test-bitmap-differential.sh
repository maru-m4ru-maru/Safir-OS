#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p build

mapfile -t OPS < <(sed '/^[[:space:]]*$/d' verification/bitmap_vectors.txt)

dafny run --allow-warnings verification/bitmap_model.dfy -- "${OPS[@]}" |
  tee build/bitmap_dafny_output.txt

grep -E '^(S0|S63|F0|F63):' build/bitmap_dafny_output.txt > build/bitmap_expected.txt
test "$(wc -l < build/bitmap_expected.txt)" -eq "${#OPS[@]}"

cargo test   --features host-test   --test bitmap_differential   --manifest-path kernel/rust/Cargo.toml
