#![no_std]

mod vga;

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {
        core::hint::spin_loop();
    }
}

#[unsafe(no_mangle)]
#[unsafe(link_section = ".text.rust_main")]
pub extern "C" fn rust_main() {
    let mut writer = vga::Writer::new();
    writer.clear();
    writer.write_bytes(b"SafirOS Rust Kernel\n");
    writer.write_bytes(b"Kernel Core: OK");
}
