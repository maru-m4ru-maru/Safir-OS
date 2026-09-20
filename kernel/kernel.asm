bits 16
org 0x0000

%define KERNEL_LOAD_ADDRESS 0x10000
%define KERNEL_SECTORS 4

start:
    cli

    ; The boot sector loaded us at 0x1000:0000.  Real-mode data references
    ; must use that segment until the protected-mode jump resets CS.
    mov ax, cs
    mov ds, ax
    mov es, ax

    ; A20有効化
    in al, 0x92
    or al, 00000010b
    out 0x92, al

    ; GDTをロード
    lgdt [gdt_descriptor]

    ; Protected Mode有効化
    mov eax, cr0
    or eax, 0x00000001
    mov cr0, eax

    ; Protected ModeへFar Jump
    jmp 0x08:protected_mode_start


bits 32

protected_mode_start:

    ; データセグメント設定
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov ss, ax

    ; スタック
    mov esp, 0x90000

    call clear_screen

    mov esi, KERNEL_LOAD_ADDRESS + title
    mov edi, 0xB8000 + (4 * 80 + 25) * 2
    mov ah, 0x0B
    call print_string

    mov esi, KERNEL_LOAD_ADDRESS + divider
    mov edi, 0xB8000 + (6 * 80 + 12) * 2
    mov ah, 0x08
    call print_string

    mov esi, KERNEL_LOAD_ADDRESS + mode_message
    mov edi, 0xB8000 + (8 * 80 + 18) * 2
    mov ah, 0x0A
    call print_string

    mov esi, KERNEL_LOAD_ADDRESS + status_message
    mov edi, 0xB8000 + (10 * 80 + 18) * 2
    mov ah, 0x07
    call print_string

    mov esi, KERNEL_LOAD_ADDRESS + prompt_message
    mov edi, 0xB8000 + (14 * 80 + 18) * 2
    mov ah, 0x0F
    call print_string

.halt:
    cli
    hlt
    jmp .halt


; Fill the complete 80x25 text buffer with blank, dark-grey cells.
clear_screen:
    mov edi, 0xB8000
    mov ecx, 80 * 25
    mov ax, 0x0720
    rep stosw
    ret


; ESI points to a NUL-terminated string. AH is its VGA colour attribute and
; EDI is the destination cell in the text buffer.
print_string:
.next_character:
    lodsb
    test al, al
    jz .done
    mov [edi], ax
    add edi, 2
    jmp .next_character
.done:
    ret


; --------------------------------
; GDT
; --------------------------------

gdt_start:

; Null descriptor
gdt_null:
    dq 0x0000000000000000

; 32-bit Code segment
gdt_code:
    dw 0xFFFF
    dw 0x0000
    db 0x00
    db 10011010b
    db 11001111b
    db 0x00

; 32-bit Data segment
gdt_data:
    dw 0xFFFF
    dw 0x0000
    db 0x00
    db 10010010b
    db 11001111b
    db 0x00

gdt_end:


gdt_descriptor:
    dw gdt_end - gdt_start - 1
    dd KERNEL_LOAD_ADDRESS + gdt_start


title          db "SafirOS", 0
divider        db "================================================================", 0
mode_message   db "32-bit protected mode is online.", 0
status_message db "Kernel, GDT, A20 line, and VGA text console: OK", 0
prompt_message db "The system is safely halted. Power off or reset to boot again.", 0


times KERNEL_SECTORS * 512 - ($ - $$) db 0
