#![cfg_attr(not(feature = "host-test"), no_std)]

pub mod memory;
mod vga;

#[cfg(not(feature = "host-test"))]
use core::panic::PanicInfo;

pub use memory::{Bitmap, E820Entry, MemoryMap, MemoryRegion};

#[cfg(not(feature = "host-test"))]
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {
        core::hint::spin_loop();
    }
}

#[unsafe(no_mangle)]
#[unsafe(link_section = ".text.rust_main")]
pub extern "C" fn rust_main(e820_ptr: u64, e820_len: usize) {
    let memory_map = unsafe {
        MemoryMap::<32>::from_raw(e820_ptr as *const E820Entry, e820_len)
    };

    let mut writer = vga::Writer::new();
    writer.clear();
    writer.write_bytes(b"SafirOS Rust Kernel
");
    writer.write_bytes(b"Kernel Core: OK
");
    if memory_map.is_empty() {
        writer.write_bytes(b"Memory Map: EMPTY");
    } else {
        writer.write_bytes(b"Memory Map: OK");
    }
}
