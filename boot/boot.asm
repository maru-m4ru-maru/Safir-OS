; SafirOS Bootloader
; GPL-3.0-or-later

bits 16
org 0x7C00

start:

    ; BIOSから渡された起動ドライブを保存
    mov [boot_drive], dl

    ; セグメント設定
    xor ax, ax
    mov ds, ax

    mov ss, ax
    mov sp, 0x7C00

    ; カーネルを 0x1000:0000 に読み込む
    mov ax, 0x1000
    mov es, ax
    xor bx, bx

    ; BIOSディスク読み込み
    mov ah, 0x02        ; Read sectors
    mov al, 0x01        ; 1 sector
    mov ch, 0x00        ; Cylinder 0
    mov cl, 0x02        ; Sector 2
    mov dh, 0x00        ; Head 0
    mov dl, [boot_drive]

    int 0x13
    jc disk_error

    ; カーネルへジャンプ
    jmp 0x1000:0x0000


disk_error:

    ; ディスク読み込み失敗
    mov ax, 0x0003
    int 0x10

    mov si, error_message

error_loop:
    lodsb

    cmp al, 0
    je error_halt

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp error_loop

error_halt:
    cli
    hlt
    jmp error_halt


boot_drive db 0

error_message db "SafirOS: Kernel load failed.", 13, 10, 0


; 512バイトのブートセクタにする
times 510 - ($ - $$) db 0

; BIOS boot signature
dw 0xAA55
