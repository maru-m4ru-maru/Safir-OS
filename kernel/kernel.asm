bits 16
org 0x0000

%define KERNEL_BASE     0x00010000
%define RUST_BASE       0x00011000

%define EARLY_STACK     0x00070000
%define E820_BASE       0x00006000
%define E820_MAX_ENTRIES 32
%define E820_ENTRY_SIZE 24
%define IDT_BASE        0x00080000
%define PML4_BASE       0x00090000
%define PDPT_BASE       0x00091000
%define PD_BASE         0x00092000
%define VGA_BASE        0x000B8000
%define PREEMPT_HOOK_SLOT 0x0005F000
%define PREEMPT_STACK_TOP 0x0006F000
%define PREEMPT_BOOTSTRAP_SLOT 0x0005F008
%define KEYBOARD_HOOK_SLOT 0x0005F010
%define KEYBOARD_TEST_SEEN_SLOT 0x0005F018

%define PIT_FREQUENCY   100
%define PIT_DIVISOR     11931

start:
    cli
    cld

    mov ax, 0x1000
    mov ds, ax
    mov es, ax

    lgdt [cs:gdt32_descriptor]

    mov word [e820_count], 0
    mov ax, E820_BASE >> 4
    mov es, ax
    xor di, di
    xor ebx, ebx
    xor bp, bp
.e820_next:
    cmp bp, E820_MAX_ENTRIES
    jae .e820_done

    mov dword [es:di + 20], 1
    mov eax, 0x0000E820
    mov edx, 0x534D4150
    mov ecx, E820_ENTRY_SIZE
    int 0x15
    jc .e820_done
    cmp eax, 0x534D4150
    jne .e820_done
    cmp ecx, 20
    jb .e820_done

    inc bp
    add di, E820_ENTRY_SIZE
    test ebx, ebx
    jnz .e820_next

.e820_done:
    mov [cs:e820_count], bp
    mov ax, 0x1000
    mov es, ax

    in al, 0x92
    or al, 00000010b
    out 0x92, al

    mov eax, cr0
    or eax, 0x00000001
    mov cr0, eax
    jmp dword 0x08:(KERNEL_BASE + protected_mode_start)

bits 32

protected_mode_start:
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov ss, ax

    xor ax, ax
    mov fs, ax
    mov gs, ax

    mov esp, EARLY_STACK

%ifdef SAFIROS_QEMU_TEST
    mov al, 'P'
    out 0xE9, al
%endif

    mov edi, PML4_BASE
    xor eax, eax
    mov ecx, 3072
    rep stosd

    mov dword [PML4_BASE + 0], PDPT_BASE | 0x003
    mov dword [PML4_BASE + 4], 0

    mov dword [PDPT_BASE + 0], PD_BASE | 0x003
    mov dword [PDPT_BASE + 4], 0

    mov edi, PD_BASE
    xor ebx, ebx
    mov ecx, 512
.page_loop:
    mov eax, ebx
    or eax, 0x00000083
    mov [edi + 0], eax
    mov dword [edi + 4], 0
    add ebx, 0x00200000
    add edi, 8
    loop .page_loop

    mov eax, cr4
    or eax, (1 << 5) | (1 << 4)
    mov cr4, eax

    mov eax, PML4_BASE
    mov cr3, eax

    mov ecx, 0xC0000080
    rdmsr
    or eax, (1 << 8)
    wrmsr

    mov eax, cr0
    or eax, (1 << 31)
    mov cr0, eax

    jmp dword 0x18:(KERNEL_BASE + long_mode_start)

bits 64

long_mode_start:
    mov ax, 0x20
    mov ds, ax
    mov es, ax
    mov ss, ax

    xor eax, eax
    mov fs, ax
    mov gs, ax

    mov rsp, EARLY_STACK
    cld

    mov rdi, VGA_BASE
    mov rcx, 80 * 25
    mov ax, 0x0F20
    rep stosw

    mov rdi, VGA_BASE
    mov rsi, KERNEL_BASE + msg_long_mode
    call vga_print

    mov rdi, VGA_BASE + (80 * 2)
    mov rsi, KERNEL_BASE + msg_idt
    call vga_print

    mov rdi, VGA_BASE + (80 * 4)
    mov rsi, KERNEL_BASE + msg_pit
    call vga_print

    mov rdi, IDT_BASE
    mov rcx, 256
.fill_idt:
    mov rax, KERNEL_BASE + default_interrupt
    mov word [rdi + 0], ax
    mov word [rdi + 2], 0x18
    mov byte [rdi + 4], 0
    mov byte [rdi + 5], 0x8E
    shr rax, 16
    mov word [rdi + 6], ax
    shr rax, 16
    mov dword [rdi + 8], eax
    mov dword [rdi + 12], 0
    add rdi, 16
    loop .fill_idt

    mov rdi, IDT_BASE + (0x20 * 16)
    mov rax, KERNEL_BASE + timer_interrupt
    mov word [rdi + 0], ax
    mov word [rdi + 2], 0x18
    mov byte [rdi + 4], 0
    mov byte [rdi + 5], 0x8E
    shr rax, 16
    mov word [rdi + 6], ax
    shr rax, 16
    mov dword [rdi + 8], eax
    mov dword [rdi + 12], 0

    mov rdi, IDT_BASE + (0x21 * 16)
    mov rax, KERNEL_BASE + keyboard_interrupt
    mov word [rdi + 0], ax
    mov word [rdi + 2], 0x18
    mov byte [rdi + 4], 0
    mov byte [rdi + 5], 0x8E
    shr rax, 16
    mov word [rdi + 6], ax
    shr rax, 16
    mov dword [rdi + 8], eax
    mov dword [rdi + 12], 0

    lidt [KERNEL_BASE + idtr]

%ifdef SAFIROS_QEMU_TEST
    mov al, 'I'
    out 0xE9, al
%endif

    call ps2_init_keyboard

    mov al, 0x11
    out 0x20, al
    out 0xA0, al

    mov al, 0x20
    out 0x21, al

    mov al, 0x28
    out 0xA1, al

    mov al, 0x04
    out 0x21, al

    mov al, 0x02
    out 0xA1, al

    mov al, 0x01
    out 0x21, al
    out 0xA1, al

    mov al, 0xFC
    out 0x21, al

    mov al, 0xFF
    out 0xA1, al

%ifdef SAFIROS_QEMU_TEST
    mov al, 'C'
    out 0xE9, al
%endif

    mov al, 0x36
    out 0x43, al

    mov ax, PIT_DIVISOR
    out 0x40, al
    mov al, ah
    out 0x40, al

%ifdef SAFIROS_QEMU_TEST
    mov al, 'H'
    out 0xE9, al
%endif

%ifdef SAFIROS_QEMU_TEST
    mov al, 'S'
    out 0xE9, al
    mov al, 'J'
    out 0xE9, al
%endif

    mov rdi, E820_BASE
    movzx rsi, word [KERNEL_BASE + e820_count]
    xor edx, edx
%ifdef SAFIROS_QEMU_TEST
    mov edx, 1
%endif
    mov rax, RUST_BASE
    call rax

    cli
.idle:
    hlt
    jmp .idle

vga_print:
.next:
    lodsb
    test al, al
    jz .done
    mov ah, 0x0F
    mov [rdi], ax
    add rdi, 2
    jmp .next
.done:
    ret

print_hex64:
    mov rdx, rax
    mov rbx, KERNEL_BASE + hex_table
    mov rcx, 16
.hex_loop:
    mov rax, rdx
    shr rax, 60
    mov al, [rbx + rax]
    mov byte [rdi], al
    mov byte [rdi + 1], 0x0F
    add rdi, 2
    rol rdx, 4
    loop .hex_loop
    ret

ps2_wait_input_clear:
.wait:
    in al, 0x64
    test al, 0x02
    jnz .wait
    ret

ps2_flush_output:
.flush:
    in al, 0x64
    test al, 0x01
    jz .done
    in al, 0x60
    jmp .flush
.done:
    ret

ps2_init_keyboard:
    call ps2_wait_input_clear
    mov al, 0xAD
    out 0x64, al
    call ps2_wait_input_clear
    call ps2_flush_output

    call ps2_wait_input_clear
    mov al, 0x20
    out 0x64, al
    call ps2_wait_input_clear
.read_config_wait:
    in al, 0x64
    test al, 0x01
    jz .read_config_wait
    in al, 0x60
    or al, 0x41
    and al, 0xEF
    push rax

    call ps2_wait_input_clear
    mov al, 0x60
    out 0x64, al
    call ps2_wait_input_clear
    pop rax
    out 0x60, al

    call ps2_wait_input_clear
    mov al, 0xAE
    out 0x64, al

    call ps2_wait_input_clear
    mov al, 0xF4
    out 0x60, al
    call ps2_flush_output
    ret

keyboard_interrupt:
    push rax
    push rbx
    push rcx
    push rdx
    push rdi
    push rsi
    push rbp
    push r8
    push r9
    push r10
    push r11
    push r12
    push r13
    push r14
    push r15

    in al, 0x60
    movzx edi, al
    mov rax, [KEYBOARD_HOOK_SLOT]
    test rax, rax
    jz .no_hook

    call rax
    test rax, rax
    jz .no_key

%ifdef SAFIROS_QEMU_TEST
    mov al, 'K'
    out 0xE9, al
    mov byte [KEYBOARD_TEST_SEEN_SLOT], 1
%endif

.no_key:
.no_hook:
    mov al, 0x20
    out 0x20, al

    pop r15
    pop r14
    pop r13
    pop r12
    pop r11
    pop r10
    pop r9
    pop r8
    pop rbp
    pop rsi
    pop rdx
    pop rcx
    pop rbx
    pop rax
    iretq

timer_interrupt:
    push rax
    push rbx
    push rcx
    push rdx
    push rdi
    push rsi
    push rbp
    push r8
    push r9
    push r10
    push r11
    push r12
    push r13
    push r14
    push r15

%ifdef SAFIROS_QEMU_TEST
    mov al, 'T'
    out 0xE9, al
%endif

    mov rdi, rsp
    mov rax, [PREEMPT_HOOK_SLOT]
    test rax, rax
    jz .no_hook

    lea rsp, [PREEMPT_STACK_TOP - 8]
    jmp rax

.no_hook:
    mov r12, rsp
    mov al, 0x20
    out 0x20, al
    mov rsp, r12

    pop r15
    pop r14
    pop r13
    pop r12
    pop r11
    pop r10
    pop r9
    pop r8
    pop rbp
    pop rsi
    pop rdi
    pop rdx
    pop rcx
    pop rbx
    pop rax
    iretq

default_halt:
    cli
.fault_halt:
    hlt
    jmp .fault_halt

default_interrupt:
%ifdef SAFIROS_QEMU_TEST
    mov al, 'E'
    out 0xE9, al
%endif
    cli
    mov rdi, VGA_BASE + (80 * 8)
    mov rsi, KERNEL_BASE + msg_fault
    call vga_print
.halt:
    hlt
    jmp .halt

align 8

gdt_start:
    dq 0x0000000000000000
    dq 0x00CF9A000000FFFF
    dq 0x00CF92000000FFFF
    dq 0x00AF9A000000FFFF
    dq 0x00CF92000000FFFF

gdt_end:

gdt32_descriptor:
    dw gdt_end - gdt_start - 1
    dd KERNEL_BASE + gdt_start

idtr:
    dw 256 * 16 - 1
    dq IDT_BASE

msg_long_mode db "SafirOS 64-bit Long Mode", 0
msg_idt       db "IDT: OK", 0
msg_pit       db "PIT: 100 Hz", 0
msg_fault     db "EXCEPTION: CPU STOPPED", 0
hex_table     db "0123456789ABCDEF"

timer_ticks   dq 0
e820_count    dw 0

%if ($ - $) > 4096
    %error "SafirOS assembly stage exceeds 4 KiB"
%endif
