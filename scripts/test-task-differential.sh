#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

mkdir -p build

mapfile -t OPS < <(sed '/^[[:space:]]*$/d' verification/task_vectors.txt)

dafny run --allow-warnings verification/task_model.dfy -- "${OPS[@]}" |
  tee build/task_dafny_output.txt

grep -E '^(W|R|B|F):' build/task_dafny_output.txt > build/task_expected.txt
test "$(wc -l < build/task_expected.txt)" -eq "${#OPS[@]}"

cargo test --features host-test --test task_differential --manifest-path kernel/rust/Cargo.toml
