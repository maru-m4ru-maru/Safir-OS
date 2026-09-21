use core::arch::global_asm;

use crate::CpuContext;

global_asm!(r#"
.intel_syntax noprefix

.global safiros_context_switch
.type safiros_context_switch, @function
safiros_context_switch:
    mov qword ptr [rdi + 0], rax
    mov qword ptr [rdi + 8], rbx
    mov qword ptr [rdi + 16], rcx
    mov qword ptr [rdi + 24], rdx
    mov qword ptr [rdi + 32], rsi
    mov qword ptr [rdi + 40], rdi
    mov qword ptr [rdi + 48], rbp
    mov qword ptr [rdi + 56], r8
    mov qword ptr [rdi + 64], r9
    mov qword ptr [rdi + 72], r10
    mov qword ptr [rdi + 80], r11
    mov qword ptr [rdi + 88], r12
    mov qword ptr [rdi + 96], r13
    mov qword ptr [rdi + 104], r14
    mov qword ptr [rdi + 112], r15
    lea rax, [rsp + 8]
    mov qword ptr [rdi + 120], rax
    mov rax, qword ptr [rsp]
    mov qword ptr [rdi + 128], rax
    pushfq
    pop rax
    mov qword ptr [rdi + 136], rax

    mov rax, qword ptr [rsi + 136]
    push rax
    popfq
    mov r15, qword ptr [rsi + 112]
    mov r14, qword ptr [rsi + 104]
    mov r13, qword ptr [rsi + 96]
    mov r12, qword ptr [rsi + 88]
    mov r11, qword ptr [rsi + 80]
    mov r10, qword ptr [rsi + 72]
    mov r9, qword ptr [rsi + 64]
    mov r8, qword ptr [rsi + 56]
    mov rbp, qword ptr [rsi + 48]
    mov rdx, qword ptr [rsi + 24]
    mov rcx, qword ptr [rsi + 16]
    mov rbx, qword ptr [rsi + 8]
    mov rdi, qword ptr [rsi + 40]
    mov rsi, qword ptr [rsi + 32]
    mov rsp, qword ptr [rsi + 120]
    mov rax, qword ptr [rsi + 128]
    push rax
    mov rax, qword ptr [rsi + 0]
    ret

.global safiros_start_first_task
.type safiros_start_first_task, @function
safiros_start_first_task:
    mov rax, qword ptr [rdi + 136]
    push rax
    popfq
    mov r15, qword ptr [rdi + 112]
    mov r14, qword ptr [rdi + 104]
    mov r13, qword ptr [rdi + 96]
    mov r12, qword ptr [rdi + 88]
    mov r11, qword ptr [rdi + 80]
    mov r10, qword ptr [rdi + 72]
    mov r9, qword ptr [rdi + 64]
    mov r8, qword ptr [rdi + 56]
    mov rbp, qword ptr [rdi + 48]
    mov rdx, qword ptr [rdi + 24]
    mov rcx, qword ptr [rdi + 16]
    mov rbx, qword ptr [rdi + 8]
    mov rdi, qword ptr [rdi + 40]
    mov rsi, qword ptr [rdi + 32]
    mov rsp, qword ptr [rdi + 120]
    sub rsp, 24
    mov rax, qword ptr [rdi + 128]
    mov qword ptr [rsp + 0], rax
    mov qword ptr [rsp + 8], 0x18
    mov rax, qword ptr [rdi + 136]
    mov qword ptr [rsp + 16], rax
    mov rax, qword ptr [rdi + 0]
    iretq

.global safiros_restore_context
.type safiros_restore_context, @function
safiros_restore_context:
    mov rax, qword ptr [rdi + 136]
    push rax
    popfq
    mov r15, qword ptr [rdi + 112]
    mov r14, qword ptr [rdi + 104]
    mov r13, qword ptr [rdi + 96]
    mov r12, qword ptr [rdi + 88]
    mov r11, qword ptr [rdi + 80]
    mov r10, qword ptr [rdi + 72]
    mov r9, qword ptr [rdi + 64]
    mov r8, qword ptr [rdi + 56]
    mov rbp, qword ptr [rdi + 48]
    mov rdx, qword ptr [rdi + 24]
    mov rcx, qword ptr [rdi + 16]
    mov rbx, qword ptr [rdi + 8]
    mov rsi, qword ptr [rdi + 32]
    mov rsp, qword ptr [rdi + 120]
    sub rsp, 24
    mov rax, qword ptr [rdi + 128]
    mov qword ptr [rsp + 0], rax
    mov qword ptr [rsp + 8], 0x18
    mov rax, qword ptr [rdi + 136]
    mov qword ptr [rsp + 16], rax
    mov rdi, qword ptr [rdi + 40]
    mov rax, qword ptr [rsp]
    mov rax, qword ptr [rdi + 0]
    iretq

.global safiros_timer_interrupt
.type safiros_timer_interrupt, @function
safiros_timer_interrupt:
    push r15
    push r14
    push r13
    push r12
    push r11
    push r10
    push r9
    push r8
    push rdi
    push rsi
    push rbp
    push rbx
    push rdx
    push rcx
    push rax

    mov r12, rsp
    mov rdi, rsp

    mov al, 'T'
    out 0xE9, al

    mov al, 0x20
    out 0x20, al

    and rsp, -16
    call safiros_timer_schedule
    mov rdi, rax
    mov rsp, r12
    jmp safiros_restore_context

.global safiros_task_a
.type safiros_task_a, @function
safiros_task_a:
.task_a_loop:
    mov al, 'A'
    out 0xE9, al
    hlt
    jmp .task_a_loop

.global safiros_task_b
.type safiros_task_b, @function
safiros_task_b:
.task_b_loop:
    mov al, 'B'
    out 0xE9, al
    hlt
    jmp .task_b_loop

.att_syntax
"#);

unsafe extern "C" {
    fn safiros_context_switch(old: *mut CpuContext, new: *const CpuContext);
    fn safiros_start_first_task(context: *const CpuContext) -> !;
}

pub unsafe fn context_switch(old: &mut CpuContext, new: &CpuContext) {
    safiros_context_switch(old as *mut CpuContext, new as *const CpuContext);
}

pub unsafe fn start_first_task(context: *const CpuContext) -> ! {
    safiros_start_first_task(context)
}
