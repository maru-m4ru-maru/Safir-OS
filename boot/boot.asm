bits 16
org 0x7C00

%define KERNEL_LOAD_SEGMENT 0x1000
%define KERNEL_SECTORS 64

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
    mov byte [current_cylinder], 0

%ifdef SAFIROS_QEMU_TEST
    mov al, 'B'
    out 0xE9, al
%endif

.read_kernel:
    mov ah, 0x02
    mov al, 0x01
    mov ch, [current_cylinder]
    mov cl, [current_sector]
    mov dh, [current_head]
    mov dl, [boot_drive]
    int 0x13
    jc disk_error

    add bx, 512
    dec si

%ifdef SAFIROS_QEMU_TEST
    cmp si, 48
    jne .check_second_marker
    mov al, '1'
    out 0xE9, al
.check_second_marker:
    cmp si, 32
    jne .check_third_marker
    mov al, '2'
    out 0xE9, al
.check_third_marker:
    cmp si, 16
    jne .check_final_marker
    mov al, '3'
    out 0xE9, al
.check_final_marker:
    cmp si, 0
    jne .after_markers
    mov al, '4'
    out 0xE9, al
.after_markers:
%endif

    jz kernel_loaded

    inc byte [current_sector]
    cmp byte [current_sector], 19
    jb .read_kernel

    mov byte [current_sector], 1
    inc byte [current_head]
    cmp byte [current_head], 2
    jb .read_kernel

    mov byte [current_head], 0
    inc byte [current_cylinder]
    cmp byte [current_cylinder], 80
    jb .read_kernel

    jmp disk_error

kernel_loaded:
    jmp KERNEL_LOAD_SEGMENT:0x0000

disk_error:
%ifdef SAFIROS_QEMU_TEST
    mov al, 'D'
    out 0xE9, al
%endif
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
current_cylinder db 0
error_message db "SafirOS: Kernel load failed.", 13, 10, 0

times 510 - ($ - $$) db 0
dw 0xAA55
