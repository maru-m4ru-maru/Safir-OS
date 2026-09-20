bits 16
org 0x0000

; SafirOS kernel load address.
; boot.asm loads 2 sectors to 0x1000:0000 = linear 0x00010000.
%define KERNEL_BASE 0x00010000

start:
    cli

    ; We entered through a far jump to 0x1000:0000.
    ; Keep DS/ES pointing at the loaded kernel while still in real mode.
    mov ax, 0x1000
    mov ds, ax
    mov es, ax

    ; Load a GDT whose physical address is the actual load address.
    lgdt [cs:gdt_descriptor]

    ; Enable A20 through the fast A20 gate.
    in al, 0x92
    or al, 00000010b
    out 0x92, al

    ; Enter 32-bit protected mode.
    mov eax, cr0
    or eax, 0x00000001
    mov cr0, eax

    ; The code-segment descriptor has base KERNEL_BASE.
    ; The far jump therefore uses an offset relative to that base.
    jmp dword 0x08:protected_mode_start


bits 32

protected_mode_start:
    ; All normal memory segments use the kernel's load base.
    mov ax, 0x10
    mov ds, ax
    mov ss, ax

    ; ES is a flat data segment so physical VGA memory can be addressed
    ; directly at 0xB8000.
    mov ax, 0x18
    mov es, ax

    ; Safe stack below VGA memory.
    mov esp, 0x00090000

    ; Clear a small area of the VGA text buffer.
    xor edi, edi
    mov ecx, 80 * 25
    mov ax, 0x0720
.clear:
    mov [es:edi], ax
    add edi, 2
    loop .clear

    ; Print a 32-bit protected-mode message.
    xor edi, edi
    mov esi, message
.print:
    lodsb
    test al, al
    jz .done

    mov ah, 0x07
    mov [es:edi], ax
    add edi, 2
    jmp .print

.done:
    cli
.halt:
    hlt
    jmp .halt


; --------------------------------
; GDT
; --------------------------------

align 8

gdt_start:

gdt_null:
    dq 0x0000000000000000

; 32-bit code: base = KERNEL_BASE, limit = 4 GiB, D=1, G=1
gdt_code:
    dw 0xFFFF
    dw 0x0000
    db 0x01
    db 10011010b
    db 11001111b
    db 0x00

; 32-bit data/stack: base = KERNEL_BASE, limit = 4 GiB, D=1, G=1
gdt_data:
    dw 0xFFFF
    dw 0x0000
    db 0x01
    db 10010010b
    db 11001111b
    db 0x00

; Flat 32-bit data segment for MMIO/VGA: base = 0
gdt_flat_data:
    dw 0xFFFF
    dw 0x0000
    db 0x00
    db 10010010b
    db 11001111b
    db 0x00

gdt_end:

gdt_descriptor:
    dw gdt_end - gdt_start - 1
    dd KERNEL_BASE + gdt_start

message db "SafirOS - 32-bit Protected Mode OK", 0

; Keep the current two-sector kernel image size.
times 1024 - ($ - $$) db 0
