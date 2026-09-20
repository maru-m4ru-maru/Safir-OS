#![no_std]

pub mod memory;
mod vga;

#[cfg(not(test))]
use core::panic::PanicInfo;

#[cfg(not(test))]
pub use memory::Bitmap;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {
        core::hint::spin_loop();
    }
}

#[unsafe(no_mangle)]
#[unsafe(link_section = ".text.rust_main")]
pub extern "C" fn rust_main() {
    let mut frames = memory::Bitmap::<2>::new();
    let _ = frames.allocate();

    let mut writer = vga::Writer::new();
    writer.clear();
    writer.write_bytes(b"SafirOS Rust Kernel\n");
    writer.write_bytes(b"Kernel Core: OK");
}
