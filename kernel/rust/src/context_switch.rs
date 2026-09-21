use core::arch::global_asm;

use crate::CpuContext;

global_asm!(r#"
.intel_syntax noprefix

.equ CTX_A, 0x68000
.equ CTX_B, 0x68080
.equ TEST_STACK_B_TOP, 0x6B000

.global safiros_context_switch
.type safiros_context_switch, @function
safiros_context_switch:
    mov qword ptr [rdi + 0], r15
    mov qword ptr [rdi + 8], r14
    mov qword ptr [rdi + 16], r13
    mov qword ptr [rdi + 24], r12
    mov qword ptr [rdi + 32], rbx
    mov qword ptr [rdi + 40], rbp

    mov rax, qword ptr [rsp]
    mov qword ptr [rdi + 56], rax
    lea rax, [rsp + 8]
    mov qword ptr [rdi + 48], rax

    pushfq
    pop rax
    mov qword ptr [rdi + 64], rax

    mov r15, qword ptr [rsi + 0]
    mov r14, qword ptr [rsi + 8]
    mov r13, qword ptr [rsi + 16]
    mov r12, qword ptr [rsi + 24]
    mov rbx, qword ptr [rsi + 32]
    mov rbp, qword ptr [rsi + 40]

    mov rax, qword ptr [rsi + 64]
    push rax
    popfq

    mov rsp, qword ptr [rsi + 48]
    push qword ptr [rsi + 56]
    ret

.global safiros_context_switch_smoke_test
.type safiros_context_switch_smoke_test, @function
safiros_context_switch_smoke_test:
    push rbp
    push rbx
    push r12
    push r13
    push r14
    push r15
    pushfq
    cli

    mov r15, 0x1515151515151515
    mov r14, 0x1414141414141414
    mov r13, 0x1313131313131313
    mov r12, 0x1212121212121212
    mov rbx, 0xB1B1B1B1B1B1B1B1
    mov rbp, 0xA1A1A1A1A1A1A1A1

    mov rax, 0x2525252525252525
    mov qword ptr [CTX_B + 0], rax
    mov rax, 0x2424242424242424
    mov qword ptr [CTX_B + 8], rax
    mov rax, 0x2323232323232323
    mov qword ptr [CTX_B + 16], rax
    mov rax, 0x2222222222222222
    mov qword ptr [CTX_B + 24], rax
    mov rax, 0xC1C1C1C1C1C1C1C1
    mov qword ptr [CTX_B + 32], rax
    mov rax, 0xD1D1D1D1D1D1D1D1
    mov qword ptr [CTX_B + 40], rax
    mov qword ptr [CTX_B + 48], TEST_STACK_B_TOP - 8

    lea rax, [rip + context_test_b]
    mov qword ptr [CTX_B + 56], rax
    mov qword ptr [CTX_B + 64], 0x2

    mov al, 'C'
    out 0xE9, al

    mov rdi, CTX_A
    mov rsi, CTX_B
    call safiros_context_switch

    mov rax, 0x1515151515151515
    cmp r15, rax
    jne context_test_fail
    mov rax, 0x1414141414141414
    cmp r14, rax
    jne context_test_fail
    mov rax, 0x1313131313131313
    cmp r13, rax
    jne context_test_fail
    mov rax, 0x1212121212121212
    cmp r12, rax
    jne context_test_fail
    mov rax, 0xB1B1B1B1B1B1B1B1
    cmp rbx, rax
    jne context_test_fail
    mov rax, 0xA1A1A1A1A1A1A1A1
    cmp rbp, rax
    jne context_test_fail

    mov al, 'X'
    out 0xE9, al

    mov rdi, CTX_A
    mov rsi, CTX_B
    call safiros_context_switch

    mov rax, 0x1515151515151515
    cmp r15, rax
    jne context_test_fail
    mov rax, 0x1414141414141414
    cmp r14, rax
    jne context_test_fail
    mov rax, 0x1313131313131313
    cmp r13, rax
    jne context_test_fail
    mov rax, 0x1212121212121212
    cmp r12, rax
    jne context_test_fail
    mov rax, 0xB1B1B1B1B1B1B1B1
    cmp rbx, rax
    jne context_test_fail
    mov rax, 0xA1A1A1A1A1A1A1A1
    cmp rbp, rax
    jne context_test_fail

context_test_done:
    mov al, 'W'
    out 0xE9, al
    popfq
    pop r15
    pop r14
    pop r13
    pop r12
    pop rbx
    pop rbp
    mov eax, 1
    ret

context_test_b:
    mov rax, rsp
    cmp rax, TEST_STACK_B_TOP - 8
    jne context_test_fail
    pushfq
    pop rax
    cmp rax, 0x2
    jne context_test_fail

    mov rax, 0x2525252525252525
    cmp r15, rax
    jne context_test_fail
    mov rax, 0x2424242424242424
    cmp r14, rax
    jne context_test_fail
    mov rax, 0x2323232323232323
    cmp r13, rax
    jne context_test_fail
    mov rax, 0x2222222222222222
    cmp r12, rax
    jne context_test_fail
    mov rax, 0xC1C1C1C1C1C1C1C1
    cmp rbx, rax
    jne context_test_fail
    mov rax, 0xD1D1D1D1D1D1D1D1
    cmp rbp, rax
    jne context_test_fail

    mov al, 'T'
    out 0xE9, al

    mov rdi, CTX_B
    mov rsi, CTX_A
    call safiros_context_switch

    mov rax, 0x2525252525252525
    cmp r15, rax
    jne context_test_fail
    mov rax, 0x2424242424242424
    cmp r14, rax
    jne context_test_fail
    mov rax, 0x2323232323232323
    cmp r13, rax
    jne context_test_fail
    mov rax, 0x2222222222222222
    cmp r12, rax
    jne context_test_fail
    mov rax, 0xC1C1C1C1C1C1C1C1
    cmp rbx, rax
    jne context_test_fail
    mov rax, 0xD1D1D1D1D1D1D1D1
    cmp rbp, rax
    jne context_test_fail

    mov al, 'S'
    out 0xE9, al

    mov rdi, CTX_B
    mov rsi, CTX_A
    call safiros_context_switch

context_test_fail:
    mov al, 'F'
    out 0xE9, al
    cli
.halt:
    hlt
    jmp .halt

.att_syntax
"#);

unsafe extern "C" {
    fn safiros_context_switch(old: *mut CpuContext, new: *const CpuContext);
    fn safiros_context_switch_smoke_test() -> u64;
}

pub unsafe fn context_switch(old: &mut CpuContext, new: &CpuContext) {
    safiros_context_switch(old as *mut CpuContext, new as *const CpuContext);
}

pub unsafe fn qemu_smoke_test() -> bool {
    safiros_context_switch_smoke_test() != 0
}
