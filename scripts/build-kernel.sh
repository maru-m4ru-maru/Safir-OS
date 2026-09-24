#!/usr/bin/env bash
set -euo pipefail

mkdir -p build

KERNEL_SECTORS=64
KERNEL_SIZE=$((KERNEL_SECTORS * 512))
RUST_LOAD_OFFSET=$((0x1000))
MAX_RUST_SIZE=$((KERNEL_SIZE - RUST_LOAD_OFFSET))

rustup target add x86_64-unknown-none
RUSTFLAGS='-C relocation-model=static' cargo build --manifest-path kernel/rust/Cargo.toml --release --target x86_64-unknown-none

ld.lld \
  --gc-sections \
  -T kernel/linker.ld \
  -o build/rust.elf \
  kernel/rust/target/x86_64-unknown-none/release/libsafiros_kernel.a

RUST_MAIN_ADDRESS="$(nm -n build/rust.elf | awk '$3=="rust_main" {print $1; exit}')"
test "$RUST_MAIN_ADDRESS" = "0000000000011000"

objcopy -O binary build/rust.elf build/rust.bin

RUST_SIZE="$(stat -c%s build/rust.bin)"
test "$RUST_SIZE" -gt 0
test "$RUST_SIZE" -le "$MAX_RUST_SIZE"

build_kernel() {
    local define="$1"
    local output="$2"

    if [ -n "$define" ]; then
        nasm -d"$define" -f bin kernel/kernel.asm -o build/kernel-stage.bin
    else
        nasm -f bin kernel/kernel.asm -o build/kernel-stage.bin
    fi

    test "$(stat -c%s build/kernel-stage.bin)" -le 4096

    dd if=/dev/zero of="$output" bs=512 count="$KERNEL_SECTORS" status=none
    dd if=build/kernel-stage.bin of="$output" bs=1 seek=0 conv=notrunc status=none
    dd if=build/rust.bin of="$output" bs=1 seek="$RUST_LOAD_OFFSET" conv=notrunc status=none
    test "$(stat -c%s "$output")" -eq "$KERNEL_SIZE"
}

build_kernel "" build/kernel.bin
build_kernel "SAFIROS_QEMU_TEST" build/kernel-qemu.bin
