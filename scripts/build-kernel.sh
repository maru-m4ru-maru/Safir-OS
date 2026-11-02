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
printf 'rust_main address: %s\n' "${RUST_MAIN_ADDRESS:-<missing>}"

if [[ "$RUST_MAIN_ADDRESS" != "0000000000011000" ]]; then
    echo "ERROR: rust_main must be linked at 0x11000"
    exit 1
fi

objcopy -O binary build/rust.elf build/rust.bin

RUST_SIZE="$(stat -c%s build/rust.bin)"
printf 'Rust binary size: %s bytes (maximum %s bytes)\n' "$RUST_SIZE" "$MAX_RUST_SIZE"

if (( RUST_SIZE == 0 || RUST_SIZE > MAX_RUST_SIZE )); then
    echo "ERROR: Rust binary does not fit in the kernel image"
    exit 1
fi

build_kernel() {
    local define="$1"
    local output="$2"

    if [ -n "$define" ]; then
        nasm -d"$define" -f bin kernel/kernel.asm -o build/kernel-stage.bin
    else
        nasm -f bin kernel/kernel.asm -o build/kernel-stage.bin
    fi

    KERNEL_STAGE_SIZE="$(stat -c%s build/kernel-stage.bin)"
    printf 'Kernel stage (%s): %s bytes (maximum 4096 bytes)\n' "$output" "$KERNEL_STAGE_SIZE"

    if (( KERNEL_STAGE_SIZE > 4096 )); then
        echo "ERROR: kernel assembly stage exceeds 4096 bytes"
        exit 1
    fi

    dd if=/dev/zero of="$output" bs=512 count="$KERNEL_SECTORS" status=none
    dd if=build/kernel-stage.bin of="$output" bs=1 seek=0 conv=notrunc status=none
    dd if=build/rust.bin of="$output" bs=1 seek="$RUST_LOAD_OFFSET" conv=notrunc status=none
    if ! cmp -n "$KERNEL_STAGE_SIZE" build/kernel-stage.bin "$output"; then
        echo "ERROR: kernel stage copy verification failed"
        exit 1
    fi

    if [[ "$(stat -c%s "$output")" -ne "$KERNEL_SIZE" ]]; then
        echo "ERROR: kernel image has an unexpected size"
        exit 1
    fi
}

build_kernel "" build/kernel.bin
build_kernel "SAFIROS_QEMU_TEST" build/kernel-qemu.bin
