bits 16
org 0x7C00

%define KERNEL_SECTORS 4

start:

    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00

    mov [boot_drive], dl

    mov ax, 0x1000
    mov es, ax
    xor bx, bx

    ; Read the kernel starting at sector 2.  Keep this value in sync with
    ; KERNEL_SECTORS in kernel/kernel.asm and the Makefile checks.
    mov ah, 0x02
    mov al, KERNEL_SECTORS
    mov ch, 0x00
    mov cl, 0x02
    mov dh, 0x00
    mov dl, [boot_drive]

    int 0x13
    jc disk_error

    jmp 0x1000:0x0000


disk_error:

    mov ax, 0x0003
    int 0x10

    mov si, error_message


error_loop:

    lodsb

    cmp al, 0
    je error_halt

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp error_loop


error_halt:

    cli
    hlt

    jmp error_halt


boot_drive db 0

error_message db "SafirOS: Kernel load failed.", 13, 10, 0

times 510 - ($ - $$) db 0

dw 0xAA55
