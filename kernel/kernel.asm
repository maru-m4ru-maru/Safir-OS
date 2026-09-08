bits 16
org 0x0000

start:

    mov ax, cs
    mov ds, ax
    mov es, ax

    mov ax, 0x0003
    int 0x10

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

times 510 - ($ - $$) db 0

dw 0x0000
