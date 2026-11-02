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

    call serial_init
    mov si, boot_message
    call serial_print16

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
    mov si, kernel_loaded_message
    call serial_print16
    jmp KERNEL_LOAD_SEGMENT:0x0000

disk_error:
    mov si, disk_error_serial_message
    call serial_print16
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

serial_init:
    mov dx, 0x3F9
    xor al, al
    out dx, al
    mov dx, 0x3FB
    mov al, 0x80
    out dx, al
    mov dx, 0x3F8
    mov al, 0x03
    out dx, al
    mov dx, 0x3F9
    xor al, al
    out dx, al
    mov dx, 0x3FB
    mov al, 0x03
    out dx, al
    mov dx, 0x3FA
    mov al, 0xC7
    out dx, al
    mov dx, 0x3FC
    mov al, 0x0B
    out dx, al
    ret

serial_print16:
.next:
    lodsb
    test al, al
    jz .done
    push ax
.wait:
    mov dx, 0x3FD
    in al, dx
    test al, 0x20
    jz .wait
    pop ax
    mov dx, 0x3F8
    out dx, al
    jmp .next
.done:
    ret

boot_message db "BOOT: BIOS boot sector entered", 13, 10, 0
kernel_loaded_message db "BOOT: kernel image loaded", 13, 10, 0
disk_error_serial_message db "BOOT ERROR: kernel disk read failed", 13, 10, 0

boot_drive db 0
current_sector db 0
current_head db 0
current_cylinder db 0
error_message db "SafirOS: Kernel load failed.", 13, 10, 0

times 510 - ($ - $$) db 0
dw 0xAA55
