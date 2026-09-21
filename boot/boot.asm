bits 16
org 0x0000

%define KERNEL_LOAD_SEGMENT 0x1000
%define KERNEL_SECTORS 32

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
    mov si, KERNEL_SECTORS
    mov byte [current_sector], 2
    mov byte [current_head], 0

.read_kernel:
    mov ah, 0x02
    mov al, 0x01
    xor ch, ch
    mov cl, [current_sector]
    mov dh, [current_head]
    mov dl, [boot_drive]
    int 0x13
    jc disk_error

    add bx, 512
    dec si
    jz kernel_loaded

    inc byte [current_sector]
    cmp byte [current_sector], 19
    jb .read_kernel

    mov byte [current_sector], 1
    inc byte [current_head]
    cmp byte [current_head], 2
    jb .read_kernel

    jmp disk_error

kernel_loaded:
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
current_sector db 0
current_head db 0
error_message db "SafirOS: Kernel load failed.", 13, 10, 0

times 510 - ($ - $$) db 0
dw 0xAA55
