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

    xor bx, bx
    mov bl, [input_length]

    mov byte [input_buffer + bx], 0

    mov ah, 0x0E
    mov bh, 0x00

    mov al, 0x0D
    int 0x10

    mov al, 0x0A
    int 0x10

    call execute_command

    mov byte [input_length], 0

    call new_prompt

    jmp read_key


execute_command:

    mov si, input_buffer
    mov di, command_help
    call compare_string
    jc .help

    mov si, input_buffer
    mov di, command_version
    call compare_string
    jc .version

    mov si, input_buffer
    mov di, command_clear
    call compare_string
    jc .clear

    mov si, input_buffer
    call check_echo
    jc .echo

    mov si, unknown
    call print_string

    ret


.help:

    mov si, help_text
    call print_string

    ret


.version:

    mov si, version_text
    call print_string

    ret


.clear:

    mov ax, 0x0003
    int 0x10

    ret


.echo:

    call print_echo

    ret


check_echo:

    push si
    push di

    mov di, command_echo

.echo_compare:

    mov al, [si]
    mov ah, [di]

    cmp al, ah
    jne .not_echo

    cmp al, 0
    je .echo_only

    inc si
    inc di

    jmp .echo_compare


.echo_only:

    pop di
    pop si

    clc
    ret


.not_echo:

    cmp byte [di], 0
    jne .not_echo_result

    cmp al, ' '
    jne .not_echo_result

    pop di
    pop si

    stc
    ret


.not_echo_result:

    pop di
    pop si

    clc
    ret


print_echo:

    mov si, input_buffer

.skip_echo:

    mov al, [si]

    cmp al, 0
    je .done

    cmp al, ' '
    je .found_space

    inc si

    jmp .skip_echo


.found_space:

    inc si

    call print_string


.done:

    ret


compare_string:

.loop:

    mov al, [si]
    mov ah, [di]

    cmp al, ah
    jne .not_equal

    cmp al, 0
    je .equal

    inc si
    inc di

    jmp .loop


.not_equal:

    clc
    ret


.equal:

    stc
    ret


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


message db "SafirOS Kernel v0.5", 13, 10
        db "Simple shell enabled.", 13, 10, 0

prompt db "> ", 0

command_help db "help", 0
command_version db "version", 0
command_clear db "clear", 0
command_echo db "echo", 0

help_text db "Available commands:", 13, 10
          db "help", 13, 10
          db "version", 13, 10
          db "clear", 13, 10
          db "echo", 13, 10, 0

version_text db "SafirOS Kernel v0.5", 13, 10, 0

unknown db "Unknown command.", 13, 10, 0

input_length db 0

input_buffer times 64 db 0

times 1024 - ($ - $$) db 0
