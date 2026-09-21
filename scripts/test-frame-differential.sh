#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p build

mapfile -t OPS < <(sed '/^[[:space:]]*$/d' verification/frame_vectors.txt)

dafny run --allow-warnings verification/frame_model.dfy -- "${OPS[@]}" |
  tee build/frame_dafny_output.txt

grep -E '^(A|S3|S63|S64|D0|D3|D63|D64):' build/frame_dafny_output.txt > build/frame_expected.txt
test "$(wc -l < build/frame_expected.txt)" -eq "${#OPS[@]}"

cargo test \
  --features host-test \
  --test frame_differential \
  --manifest-path kernel/rust/Cargo.toml
