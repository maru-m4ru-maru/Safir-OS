bits 16
org 0x0000

start:

    mov ax, cs
    mov ds, ax
    mov es, ax

    mov ax, 0x0003
    int 0x10

    mov si, message
    call print_string

    call new_prompt

read_key:

    mov ah, 0x00
    int 0x16

    cmp al, 0x08
    je handle_backspace

    cmp al, 0x0D
    je handle_enter

    cmp al, 0x20
    jb read_key

    cmp byte [input_length], 63
    jae read_key

    xor bx, bx
    mov bl, [input_length]

    mov [input_buffer + bx], al

    inc byte [input_length]

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp read_key


handle_backspace:

    cmp byte [input_length], 0
    je read_key

    dec byte [input_length]

    mov ah, 0x0E
    mov bh, 0x00

    mov al, 0x08
    int 0x10

    mov al, ' '
    int 0x10

    mov al, 0x08
    int 0x10

    jmp read_key


handle_enter:

    mov ah, 0x0E
    mov bh, 0x00

    mov al, 0x0D
    int 0x10

    mov al, 0x0A
    int 0x10

    mov byte [input_length], 0

    call new_prompt

    jmp read_key


new_prompt:

    mov si, prompt
    call print_string

    ret


print_string:

    lodsb

    cmp al, 0
    je .done

    mov ah, 0x0E
    mov bh, 0x00
    int 0x10

    jmp print_string

.done:

    ret


message db "SafirOS Kernel v0.3", 13, 10
        db "Keyboard input enabled.", 13, 10, 0

prompt db "> ", 0

input_length db 0

input_buffer times 64 db 0

times 510 - ($ - $$) db 0

dw 0x0000
