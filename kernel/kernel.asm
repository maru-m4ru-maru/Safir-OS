; SafirOS Kernel
; GPL-3.0-or-later

bits 16
org 0x0000

start:

    ; 画面をクリア
    mov ax, 0x0003
    int 0x10

    ; カーネル起動メッセージ
    mov si, message

print_loop:
    lodsb

    cmp al, 0
    je halt

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp print_loop

halt:
    cli
    hlt
    jmp halt

message db "SafirOS Kernel v0.1", 13, 10
        db "Kernel loaded successfully.", 13, 10
        db "> ", 0

; 1セクタ(512 bytes)にする
times 510 - ($ - $$) db 0

dw 0x0000
