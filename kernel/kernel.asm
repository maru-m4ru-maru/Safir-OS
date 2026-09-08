bits 16
org 0x0000

start:

    mov ax, cs
    mov ds, ax
    mov es, ax

    mov ax, 0x0003
    int 0x10

    mov si, message

print_message:
    lodsb

    cmp al, 0
    je wait_key

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp print_message


wait_key:

    mov ah, 0x00
    int 0x16

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp wait_key


message db "SafirOS Kernel v0.2", 13, 10
        db "Keyboard input enabled.", 13, 10
        db "> ", 0

times 510 - ($ - $$) db 0

dw 0x0000
