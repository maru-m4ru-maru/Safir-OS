use core::ptr;
use core::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};

use crate::{CpuContext, Scheduler, Task, TaskState};

pub const IDT_BASE: usize = 0x80000;
const TIMER_VECTOR: usize = 0x20;
const TASK_COUNT: usize = 2;
const TASK_STACK_A_TOP: u64 = 0x6E000;
const TASK_STACK_B_TOP: u64 = 0x70000;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct InterruptFrame {
    pub rax: u64,
    pub rcx: u64,
    pub rdx: u64,
    pub rbx: u64,
    pub rbp: u64,
    pub rsi: u64,
    pub rdi: u64,
    pub r8: u64,
    pub r9: u64,
    pub r10: u64,
    pub r11: u64,
    pub r12: u64,
    pub r13: u64,
    pub r14: u64,
    pub r15: u64,
    pub rip: u64,
    pub cs: u64,
    pub rflags: u64,
}

static mut TASKS: [Task; TASK_COUNT] = [
    Task::new(0, CpuContext::new(1, 1)),
    Task::new(1, CpuContext::new(1, 1)),
];

static mut SCHEDULER: Scheduler<TASK_COUNT> = Scheduler::new();

static CURRENT_TASK: AtomicUsize = AtomicUsize::new(0);
static TEST_MODE: AtomicBool = AtomicBool::new(false);
static TICKS: AtomicU64 = AtomicU64::new(0);

unsafe extern "C" {
    fn safiros_timer_interrupt();
    fn safiros_task_a() -> !;
    fn safiros_task_b() -> !;
    fn safiros_start_first_task(context: *const CpuContext) -> !;
}

pub unsafe fn initialize(test_mode: u64) -> *const CpuContext {
    TEST_MODE.store(test_mode != 0, Ordering::Relaxed);
    TICKS.store(0, Ordering::Relaxed);
    CURRENT_TASK.store(0, Ordering::Relaxed);

    let tasks = ptr::addr_of_mut!(TASKS);
    *tasks = [
        Task::new(
            0,
            CpuContext::new(TASK_STACK_A_TOP, safiros_task_a as usize as u64),
        ),
        Task::new(
            1,
            CpuContext::new(TASK_STACK_B_TOP, safiros_task_b as usize as u64),
        ),
    ];

    let scheduler = ptr::addr_of_mut!(SCHEDULER);
    *scheduler = Scheduler::new();
    assert!((*scheduler).enqueue(0));
    assert!((*scheduler).enqueue(1));
    assert!((*tasks).get_unchecked_mut(0).transition(TaskState::Running));

    install_timer_gate();

    (*tasks).get_unchecked(0).context_ptr()
}

unsafe fn install_timer_gate() {
    let handler = safiros_timer_interrupt as usize as u64;
    let gate = (IDT_BASE + TIMER_VECTOR * 16) as *mut u8;

    ptr::write_volatile(gate.add(0).cast::<u16>(), handler as u16);
    ptr::write_volatile(gate.add(2).cast::<u16>(), 0x18);
    ptr::write_volatile(gate.add(4), 0);
    ptr::write_volatile(gate.add(5), 0x8E);
    ptr::write_volatile(gate.add(6).cast::<u16>(), (handler >> 16) as u16);
    ptr::write_volatile(gate.add(8).cast::<u32>(), (handler >> 32) as u32);
    ptr::write_volatile(gate.add(12).cast::<u32>(), 0);
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn safiros_timer_schedule(frame: *const InterruptFrame) -> *const CpuContext {
    let frame = &*frame;

    if frame.cs != 0x18 || (frame.rflags & 2) == 0 {
        loop {
            core::hint::spin_loop();
        }
    }

    let current = CURRENT_TASK.load(Ordering::Relaxed);
    if current >= TASK_COUNT {
        loop {
            core::hint::spin_loop();
        }
    }

    let context = CpuContext {
        rax: frame.rax,
        rbx: frame.rbx,
        rcx: frame.rcx,
        rdx: frame.rdx,
        rsi: frame.rsi,
        rdi: frame.rdi,
        rbp: frame.rbp,
        r8: frame.r8,
        r9: frame.r9,
        r10: frame.r10,
        r11: frame.r11,
        r12: frame.r12,
        r13: frame.r13,
        r14: frame.r14,
        r15: frame.r15,
        rsp: frame as *const InterruptFrame as u64 + core::mem::size_of::<InterruptFrame>() as u64,
        rip: frame.rip,
        rflags: frame.rflags,
    };

    let tasks = ptr::addr_of_mut!(TASKS);
    if !(*tasks).get_unchecked_mut(current).set_context(context) {
        loop {
            core::hint::spin_loop();
        }
    }

    let scheduler = ptr::addr_of_mut!(SCHEDULER);
    (*tasks).get_unchecked_mut(current).transition(TaskState::Ready);

    let _ = (*scheduler).next();
    let next = match (*scheduler).peek() {
        Some(task_id) if (task_id as usize) < TASK_COUNT => task_id as usize,
        _ => current,
    };

    if next != current {
        if !(*tasks).get_unchecked_mut(next).transition(TaskState::Running) {
            loop {
                core::hint::spin_loop();
            }
        }
        CURRENT_TASK.store(next, Ordering::Relaxed);
    } else {
        let _ = (*tasks).get_unchecked_mut(current).transition(TaskState::Running);
    }

    let tick = TICKS.fetch_add(1, Ordering::Relaxed) + 1;
    if TEST_MODE.load(Ordering::Relaxed) && tick >= 10 {
        core::arch::asm!(
            "mov al, 0x10",
            "out 0xF4, al",
            options(nostack, nomem, preserves_flags)
        );
        loop {
            core::hint::spin_loop();
        }
    }

    (*tasks).get_unchecked(next).context_ptr()
}

pub unsafe fn start_first_task(context: *const CpuContext) -> ! {
    safiros_start_first_task(context)
}

#[cfg(test)]
mod tests {
    use super::InterruptFrame;

    #[test]
    fn interrupt_frame_layout_matches_timer_abi() {
        assert_eq!(core::mem::size_of::<InterruptFrame>(), 144);
        assert_eq!(core::mem::align_of::<InterruptFrame>(), 8);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rax), 0);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rcx), 8);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rdx), 16);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rbx), 24);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rbp), 32);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rsi), 40);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rdi), 48);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r8), 56);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r9), 64);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r10), 72);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r11), 80);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r12), 88);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r13), 96);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r14), 104);
        assert_eq!(core::mem::offset_of!(InterruptFrame, r15), 112);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rip), 120);
        assert_eq!(core::mem::offset_of!(InterruptFrame, cs), 128);
        assert_eq!(core::mem::offset_of!(InterruptFrame, rflags), 136);
    }
}
