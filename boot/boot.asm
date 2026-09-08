; SafirOS - First Bootloader
; GPL-3.0-or-later

bits 16
org 0x7C00

start:
    ; BIOSが設定したセグメントをそろえる
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00

    ; 画面をクリア
    mov ax, 0x0003
    int 0x10

    ; 文字列を表示
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

message db "Hello from SafirOS!", 13, 10
        db "SafirOS is booting...", 0

; ブートセクタを512バイトにする
times 510 - ($ - $$) db 0

; BIOSブートシグネチャ
dw 0xAA55
