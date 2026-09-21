#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p build

mapfile -t OPS < <(sed "/^[[:space:]]*$/d" verification/pmm_vectors.txt)

dafny run --allow-warnings verification/pmm_model.dfy -- "${OPS[@]}" |
  tee build/pmm_dafny_output.txt

grep -E '^(A|R5|R6|D4|D5|D6|D63):' build/pmm_dafny_output.txt > build/pmm_expected.txt
test "$(wc -l < build/pmm_expected.txt)" -eq "${#OPS[@]}"

cargo test \
  --features host-test \
  --test pmm_differential \
  --manifest-path kernel/rust/Cargo.toml
