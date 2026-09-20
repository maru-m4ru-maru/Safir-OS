bits 16
org 0x0000

%define KERNEL_BASE 0x00010000

start:
    cli
    mov ax, 0x1000
    mov ds, ax
    mov es, ax
    lgdt [cs:gdt_descriptor]

    in al, 0x92
    or al, 00000010b
    out 0x92, al

    mov eax, cr0
    or eax, 0x00000001
    mov cr0, eax

    jmp dword 0x08:(KERNEL_BASE + protected_mode_start)

bits 32

protected_mode_start:
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov ss, ax

    xor ax, ax
    mov fs, ax
    mov gs, ax

    mov esp, 0x00080000

    mov edi, 0x000B8000
    mov ecx, 80 * 25
    mov ax, 0x0720
    rep stosw

    mov edi, 0x000B8000
    mov esi, KERNEL_BASE + message

.print:
    lodsb
    test al, al
    jz .done
    mov ah, 0x07
    mov [edi], ax
    add edi, 2
    jmp .print

.done:
    cli
.halt:
    hlt
    jmp .halt

align 8

gdt_start:
    dq 0x0000000000000000
    dq 0x00CF9A000000FFFF
    dq 0x00CF92000000FFFF

gdt_end:

gdt_descriptor:
    dw gdt_end - gdt_start - 1
    dd KERNEL_BASE + gdt_start

message db "SafirOS - 32-bit Protected Mode OK", 0

times 1024 - ($ - $$) db 0
