bits 16
org 0x0000

start:
    cli

    ; データセグメントを初期化
    xor ax, ax
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

    ; VGA Text Mode
    mov edi, 0xB8000

    mov esi, message

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
    hlt
    jmp .done


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
    dd gdt_start


message db "SafirOS - Protected Mode OK", 0


times 1022 - ($ - $$) db 0

dw 0x0000
