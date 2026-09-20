NASM ?= nasm

BUILD_DIR := build
BOOT_BIN := $(BUILD_DIR)/boot.bin
KERNEL_BIN := $(BUILD_DIR)/kernel.bin
IMAGE := $(BUILD_DIR)/SafirOS.img
FLOPPY_SIZE := 1474560
KERNEL_SIZE := 2048

.PHONY: all image check clean run

all: image

image: $(IMAGE)

$(BUILD_DIR):
	mkdir -p $@

$(BOOT_BIN): boot/boot.asm | $(BUILD_DIR)
	$(NASM) -f bin $< -o $@

$(KERNEL_BIN): kernel/kernel.asm | $(BUILD_DIR)
	$(NASM) -f bin $< -o $@

$(IMAGE): $(BOOT_BIN) $(KERNEL_BIN)
	dd if=/dev/zero of=$@ bs=512 count=2880 status=none
	dd if=$(BOOT_BIN) of=$@ bs=512 seek=0 conv=notrunc status=none
	dd if=$(KERNEL_BIN) of=$@ bs=512 seek=1 conv=notrunc status=none

check: image
	test "$$(stat -c%s $(BOOT_BIN))" -eq 512
	test "$$(stat -c%s $(KERNEL_BIN))" -eq $(KERNEL_SIZE)
	test "$$(stat -c%s $(IMAGE))" -eq $(FLOPPY_SIZE)
	test "$$(od -An -tx2 -j 510 -N 2 $(BOOT_BIN) | tr -d '[:space:]')" = "aa55"

run: image
	qemu-system-i386 -drive format=raw,file=$(IMAGE),if=floppy

clean:
	rm -rf $(BUILD_DIR)
