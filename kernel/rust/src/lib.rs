#![no_std]

pub mod memory;
mod vga;

#[cfg(not(feature = "host-test"))]
use core::panic::PanicInfo;

pub use memory::Bitmap;

#[cfg(not(feature = "host-test"))]
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
    writer.write_bytes(b"SafirOS Rust Kernel
");
    writer.write_bytes(b"Kernel Core: OK");
}
