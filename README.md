# SafirOS

16-bit boot sector and a minimal 32-bit protected-mode kernel for x86 PCs.
The boot sector loads four kernel sectors at `0x1000:0000`; the kernel enables
the A20 line, installs a flat GDT, switches to protected mode, and writes a
status screen directly to the VGA text buffer.

## Build

```sh
make check
```

This creates `build/SafirOS.img`, a 1.44 MB floppy image.  To run it locally
when QEMU is installed:

```sh
make run
```

## Layout

* `boot/boot.asm` — BIOS boot sector, including the kernel disk load.
* `kernel/kernel.asm` — 32-bit mode switch, GDT, and VGA console screen.
* `web/` — GitHub Pages frontend that boots the generated floppy in v86.
