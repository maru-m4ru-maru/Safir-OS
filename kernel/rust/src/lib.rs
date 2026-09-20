#![no_std]

use core::panic::PanicInfo;
use core::ptr::write_volatile;

const VGA_BASE: *mut u8 = 0xB8000 as *mut u8;
const VGA_ATTR: u8 = 0x07;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {
        core::hint::spin_loop();
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_main() {
    let message = b"Rust kernel: OK";
    let row = 10usize;

    for (i, byte) in message.iter().copied().enumerate() {
        let offset = (row * 80 + i) * 2;
        unsafe {
            write_volatile(VGA_BASE.add(offset), byte);
            write_volatile(VGA_BASE.add(offset + 1), VGA_ATTR);
        }
    }
}
