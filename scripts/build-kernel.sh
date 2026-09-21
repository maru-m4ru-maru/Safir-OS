#!/usr/bin/env bash
set -euo pipefail

mkdir -p build

rustup target add x86_64-unknown-none
RUSTFLAGS='-C relocation-model=static' cargo build --manifest-path kernel/rust/Cargo.toml --release --target x86_64-unknown-none

ld.lld \
  --gc-sections \
  -T kernel/linker.ld \
  -o build/rust.elf \
  kernel/rust/target/x86_64-unknown-none/release/libsafiros_kernel.a

nm -n build/rust.elf | awk '$3=="rust_main" {print $1}' | grep -qx '0000000000011000'
objcopy -O binary build/rust.elf build/rust.bin

test "$(stat -c%s build/rust.bin)" -gt 0
test "$(stat -c%s build/rust.bin)" -le 12288

build_kernel() {
    local define="$1"
    local output="$2"

    if [ -n "$define" ]; then
        nasm -d"$define" -f bin kernel/kernel.asm -o build/kernel-stage.bin
    else
        nasm -f bin kernel/kernel.asm -o build/kernel-stage.bin
    fi

    test "$(stat -c%s build/kernel-stage.bin)" -le 4096

    dd if=/dev/zero of="$output" bs=512 count=32 status=none
    dd if=build/kernel-stage.bin of="$output" bs=1 seek=0 conv=notrunc status=none
    dd if=build/rust.bin of="$output" bs=1 seek=$((0x1000)) conv=notrunc status=none
    test "$(stat -c%s "$output")" -eq 16384
}

build_kernel "" build/kernel.bin
build_kernel "SAFIROS_QEMU_TEST" build/kernel-qemu.bin
