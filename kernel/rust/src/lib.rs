#![cfg_attr(not(feature = "host-test"), no_std)]

pub mod context_switch;
pub mod keyboard;
pub mod memory;
pub mod preemption;
pub mod ring_buffer;
pub mod scheduler;
pub mod task;
mod vga;

#[cfg(not(feature = "host-test"))]
use core::panic::PanicInfo;

pub use context_switch::context_switch;
pub use keyboard::KeyboardDecoder;
pub use preemption::InterruptContext;
pub use memory::{
    Bitmap,
    E820Entry,
    FrameAllocator,
    MemoryMap,
    MemoryRegion,
    PhysicalMemoryManager,
    PhysFrame,
};
pub use ring_buffer::RingBuffer;
pub use scheduler::Scheduler;
pub use task::{CpuContext, Task, TaskState};

#[cfg(not(feature = "host-test"))]
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {
        core::hint::spin_loop();
    }
}

#[unsafe(no_mangle)]
#[unsafe(link_section = ".text.rust_main")]
pub extern "C" fn rust_main(e820_ptr: u64, e820_len: usize, test_mode: u64) {
    let memory_map = unsafe {
        MemoryMap::<32>::from_raw(e820_ptr as *const E820Entry, e820_len)
    };

    let mut physical_memory = PhysicalMemoryManager::<4096>::from_memory_map(&memory_map);

    physical_memory.reserve_range(0x00006000, 32 * 24);
    physical_memory.reserve_range(0x00010000, 0x4000);
    physical_memory.reserve_range(0x0005F000, 0x1000);
    physical_memory.reserve_range(0x00060000, 0x8000);
    physical_memory.reserve_range(0x00068000, 0x4000);
    physical_memory.reserve_range(0x0006C000, 0x4000);
    physical_memory.reserve_range(0x00080000, 0x1000);
    physical_memory.reserve_range(0x00090000, 0x3000);
    physical_memory.reserve_range(0x000B8000, 0x1000);

    let mut writer = vga::Writer::new();
    writer.clear();
    writer.write_bytes(b"SafirOS Rust Kernel\n");
    writer.write_bytes(b"Kernel Core: OK\n");

    if memory_map.is_empty() {
        writer.write_bytes(b"Memory Map: EMPTY\n");
    } else {
        writer.write_bytes(b"Memory Map: OK\n");
    }

    if physical_memory.free_frames() > 0 {
        writer.write_bytes(b"Physical Memory: OK");
    } else {
        writer.write_bytes(b"Physical Memory: EMPTY");
    }

    #[cfg(not(feature = "host-test"))]
    unsafe {
        preemption::init_preemption(test_mode);
    }

    #[cfg(feature = "host-test")]
    {
        let _ = test_mode;
    }
}