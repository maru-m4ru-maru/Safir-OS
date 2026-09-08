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

    cmp al, 0x08
    je backspace

    cmp al, 0x0D
    je enter_key

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp wait_key


backspace:

    mov ah, 0x0E
    mov al, 0x08
    int 0x10

    mov al, ' '
    int 0x10

    mov al, 0x08
    int 0x10

    jmp wait_key


enter_key:

    mov ah, 0x0E

    mov al, 0x0D
    int 0x10

    mov al, 0x0A
    int 0x10

    jmp wait_key


message db "Safirm Kernel v0.3", 13, 10
        db "Keyboard input enabled.", 13, 10
        db "> ", 0

times 510 - ($ - $$) db 0

dw 0x0000
