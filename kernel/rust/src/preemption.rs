use core::arch::asm;

#[cfg(not(feature = "host-test"))]
use core::arch::global_asm;

use crate::{CpuContext, Scheduler, Task, TaskState};

#[repr(C)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct InterruptContext {
    pub r15: u64,
    pub r14: u64,
    pub r13: u64,
    pub r12: u64,
    pub r11: u64,
    pub r10: u64,
    pub r9: u64,
    pub r8: u64,
    pub rbp: u64,
    pub rdi: u64,
    pub rsi: u64,
    pub rdx: u64,
    pub rcx: u64,
    pub rbx: u64,
    pub rax: u64,
    pub rip: u64,
    pub cs: u64,
    pub rflags: u64,
}

impl InterruptContext {
    pub const fn new(rip: u64, cs: u64, rflags: u64) -> Self {
        Self {
            r15: 0,
            r14: 0,
            r13: 0,
            r12: 0,
            r11: 0,
            r10: 0,
            r9: 0,
            r8: 0,
            rbp: 0,
            rdi: 0,
            rsi: 0,
            rdx: 0,
            rcx: 0,
            rbx: 0,
            rax: 0,
            rip,
            cs,
            rflags,
        }
    }

    pub const fn is_valid(self) -> bool {
        self.rip != 0 &&
        self.cs == 0x18 &&
        (self.rflags & 0x2) != 0 &&
        (self.rflags & 0x200) != 0
    }
}

const TASK_A_ID: u64 = 1;
const TASK_B_ID: u64 = 2;
const TASK_A_STACK_TOP: usize = 0x00063FE8;
const TASK_B_STACK_TOP: usize = 0x00067FE8;
const TASK_STACK_SS: u64 = 0x20;
#[cfg(not(feature = "host-test"))]
const TRACE_TICKS: u64 = 8;

#[repr(C)]
struct RuntimeState {
    scheduler: Scheduler<2>,
    tasks: [Task; 2],
    frames: [usize; 2],
    trace_enabled: bool,
    trace_ticks: u64,
    initialized: bool,
}

impl RuntimeState {
    const fn new() -> Self {
        Self {
            scheduler: Scheduler::new(),
            tasks: [
                Task::new(1, CpuContext::new(TASK_A_STACK_TOP as u64, 1)),
                Task::new(2, CpuContext::new(TASK_B_STACK_TOP as u64, 1)),
            ],
            frames: [0, 0],
            trace_enabled: false,
            trace_ticks: 0,
            initialized: false,
        }
    }
}

#[unsafe(link_section = ".data")]
static mut RUNTIME: RuntimeState = RuntimeState::new();

#[cfg(not(feature = "host-test"))]
global_asm!(r#"

.global safiros_preemptive_start
.type safiros_preemptive_start, @function
safiros_preemptive_start:
    mov rsp, rdi
    pop r15
    pop r14
    pop r13
    pop r12
    pop r11
    pop r10
    pop r9
    pop r8
    pop rbp
    pop rdi
    pop rsi
    pop rdx
    pop rcx
    pop rbx
    pop rax

    mov r10, rsp
    mov r11, 0x0005F800

    mov rax, [r10]
    mov [r11 + 0], rax
    mov rax, [r10 + 8]
    mov [r11 + 8], rax
    mov rax, [r10 + 16]
    mov [r11 + 16], rax

    mov al, 'I'
    out 0xE9, al

    mov rsp, r10
    iretq

"#);

#[cfg(not(feature = "host-test"))]
unsafe extern "C" {
    fn safiros_preemptive_start(frame: *mut InterruptContext) -> !;
}

#[cfg(not(feature = "host-test"))]
#[inline(always)]
fn debugcon(byte: u8) {
    unsafe {
        core::arch::asm!(
            "out dx, al",
            in("dx") 0xE9u16,
            in("al") byte,
            options(nomem, nostack, preserves_flags)
        );
    }
}

#[cfg(not(feature = "host-test"))]
#[inline(always)]
fn qemu_exit(code: u8) {
    unsafe {
        core::arch::asm!(
            "out dx, al",
            in("dx") 0xF4u16,
            in("al") code,
            options(nomem, nostack, preserves_flags)
        );
    }
}

#[cfg(not(feature = "host-test"))]
unsafe fn task_frame(stack_top: usize, rip: usize) -> usize {
    let frame = stack_top - core::mem::size_of::<InterruptContext>();
    core::ptr::write(
        frame as *mut InterruptContext,
        InterruptContext::new(rip as u64, 0x18, 0x202),
    );
    core::ptr::write(
        (frame + core::mem::size_of::<InterruptContext>()) as *mut u64,
        stack_top as u64,
    );
    core::ptr::write(
        (frame + core::mem::size_of::<InterruptContext>() + 8) as *mut u64,
        TASK_STACK_SS,
    );
    frame
}

#[unsafe(no_mangle)]
pub extern "C" fn preempt_task_a() -> ! {
    loop {
        unsafe {
            asm!("hlt", options(nomem, nostack, preserves_flags));
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn preempt_task_b() -> ! {
    loop {
        unsafe {
            asm!("hlt", options(nomem, nostack, preserves_flags));
        }
    }
}

#[cfg(not(feature = "host-test"))]
pub unsafe fn init_preemption(test_mode: u64) -> ! {
    let runtime = &mut *core::ptr::addr_of_mut!(RUNTIME);

    let frame_a = task_frame(TASK_A_STACK_TOP, preempt_task_a as *const () as usize);
    let frame_b = task_frame(TASK_B_STACK_TOP, preempt_task_b as *const () as usize);

    runtime.frames[0] = frame_a;
    runtime.frames[1] = frame_b;

    runtime.scheduler = Scheduler::new();
    assert!(runtime.scheduler.enqueue(TASK_A_ID));
    assert!(runtime.scheduler.enqueue(TASK_B_ID));
    assert_eq!(runtime.scheduler.next(), Some(TASK_A_ID));

    runtime.tasks[0] = Task::new(
        TASK_A_ID,
        CpuContext::new(TASK_A_STACK_TOP as u64, preempt_task_a as *const () as usize as u64),
    );
    runtime.tasks[1] = Task::new(
        TASK_B_ID,
        CpuContext::new(TASK_B_STACK_TOP as u64, preempt_task_b as *const () as usize as u64),
    );
    assert!(runtime.tasks[0].transition(TaskState::Running));

    runtime.trace_enabled = test_mode != 0;
    runtime.trace_ticks = 0;
    runtime.initialized = true;

    core::ptr::write_volatile(0x0005F000usize as *mut u64, preempt_timer_tick as *const () as usize as u64);

    if runtime.trace_enabled {
        debugcon(b'R');
    }

    safiros_preemptive_start(frame_a as *mut InterruptContext)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn preempt_timer_tick(ctx: *mut InterruptContext) -> *mut InterruptContext {
    let runtime = &mut *core::ptr::addr_of_mut!(RUNTIME);
    if !runtime.initialized || ctx.is_null() {
        return ctx;
    }

    let current_frame = ctx as usize;
    let current = if runtime.frames[0] == current_frame {
        0
    } else if runtime.frames[1] == current_frame {
        1
    } else {
        #[cfg(not(feature = "host-test"))]
        {
            runtime.trace_enabled = false;
        }
        return ctx;
    };

    runtime.frames[current] = current_frame;

    let Some(next_id) = runtime.scheduler.next() else {
        return ctx;
    };

    let next = if next_id == TASK_A_ID {
        0
    } else if next_id == TASK_B_ID {
        1
    } else {
        return ctx;
    };

    if next != current {
        if !runtime.tasks[current].transition(TaskState::Ready) {
            return ctx;
        }
        if !runtime.tasks[next].transition(TaskState::Running) {
            let _ = runtime.tasks[current].transition(TaskState::Running);
            return ctx;
        }
    } else if runtime.tasks[current].state() != TaskState::Running {
        return ctx;
    }

    #[cfg(not(feature = "host-test"))]
    if runtime.trace_enabled {
        runtime.trace_ticks += 1;
        debugcon(if next == 0 { b'A' } else { b'B' });
        if runtime.trace_ticks >= TRACE_TICKS {
            debugcon(b'Q');
            qemu_exit(0x10);
        }
    }

    let next_frame = runtime.frames[next];
    if next_frame == 0 || (next_frame & 7) != 0 {
        return ctx;
    }

    next_frame as *mut InterruptContext
}

#[cfg(test)]
mod tests {
    use super::InterruptContext;

    #[test]
    fn interrupt_context_layout_matches_isr_stack() {
        assert_eq!(core::mem::size_of::<InterruptContext>(), 144);
        assert_eq!(core::mem::align_of::<InterruptContext>(), 8);
        assert_eq!(core::mem::offset_of!(InterruptContext, r15), 0);
        assert_eq!(core::mem::offset_of!(InterruptContext, r14), 8);
        assert_eq!(core::mem::offset_of!(InterruptContext, r13), 16);
        assert_eq!(core::mem::offset_of!(InterruptContext, r12), 24);
        assert_eq!(core::mem::offset_of!(InterruptContext, r11), 32);
        assert_eq!(core::mem::offset_of!(InterruptContext, r10), 40);
        assert_eq!(core::mem::offset_of!(InterruptContext, r9), 48);
        assert_eq!(core::mem::offset_of!(InterruptContext, r8), 56);
        assert_eq!(core::mem::offset_of!(InterruptContext, rbp), 64);
        assert_eq!(core::mem::offset_of!(InterruptContext, rdi), 72);
        assert_eq!(core::mem::offset_of!(InterruptContext, rsi), 80);
        assert_eq!(core::mem::offset_of!(InterruptContext, rdx), 88);
        assert_eq!(core::mem::offset_of!(InterruptContext, rcx), 96);
        assert_eq!(core::mem::offset_of!(InterruptContext, rbx), 104);
        assert_eq!(core::mem::offset_of!(InterruptContext, rax), 112);
        assert_eq!(core::mem::offset_of!(InterruptContext, rip), 120);
        assert_eq!(core::mem::offset_of!(InterruptContext, cs), 128);
        assert_eq!(core::mem::offset_of!(InterruptContext, rflags), 136);
    }

    #[test]
    fn interrupt_context_validity_matches_kernel_frame() {
        let valid = InterruptContext::new(0x11000, 0x18, 0x202);
        assert!(valid.is_valid());
        assert!(!InterruptContext::new(0, 0x18, 0x202).is_valid());
        assert!(!InterruptContext::new(0x11000, 0x10, 0x202).is_valid());
        assert!(!InterruptContext::new(0x11000, 0x18, 0x2).is_valid());
    }
}
