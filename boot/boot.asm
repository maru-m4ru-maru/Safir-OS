bits 16
org 0x0000

%define KERNEL_LOAD_SEGMENT 0x1000
%define KERNEL_SECTORS 16

start:
    cli
    cld

    xor ax, ax
    mov ds, ax
    mov ss, ax
    mov sp, 0x7C00

    mov [boot_drive], dl

    mov ax, KERNEL_LOAD_SEGMENT
    mov es, ax
    xor bx, bx

    ; Read sectors 2..17 of the first floppy track.
    mov ah, 0x02
    mov al, KERNEL_SECTORS
    mov ch, 0x00
    mov cl, 0x02
    mov dh, 0x00
    mov dl, [boot_drive]
    int 0x13
    jc disk_error

    ; 0x1000:0000 = physical 0x00010000.
    jmp KERNEL_LOAD_SEGMENT:0x0000

disk_error:
    mov ax, 0x0003
    int 0x10
    mov si, error_message

.error_loop:
    lodsb
    test al, al
    jz .halt
    mov ah, 0x0E
    mov bh, 0x00
    int 0x10
    jmp .error_loop

.halt:
    cli
    hlt
    jmp .halt

boot_drive db 0
error_message db "SafirOS: Kernel load failed.", 13, 10, 0

times 510 - ($ - $$) db 0
dw 0xAA55
