use core::ptr::write_volatile;

const VGA_BASE: usize = 0xB8000;
const VGA_WIDTH: usize = 80;
const VGA_HEIGHT: usize = 25;
const DEFAULT_ATTRIBUTE: u8 = 0x07;

pub struct Writer {
    row: usize,
    column: usize,
    attribute: u8,
}

impl Writer {
    pub const fn new() -> Self {
        Self {
            row: 0,
            column: 0,
            attribute: DEFAULT_ATTRIBUTE,
        }
    }

    pub fn clear(&mut self) {
        for row in 0..VGA_HEIGHT {
            for column in 0..VGA_WIDTH {
                self.put_at(row, column, b' ');
            }
        }
        self.row = 0;
        self.column = 0;
    }

    pub fn write_bytes(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.write_byte(byte);
        }
    }

    fn write_byte(&mut self, byte: u8) {
        match byte {
            b'\n' => {
                self.column = 0;
                if self.row + 1 < VGA_HEIGHT {
                    self.row += 1;
                }
            }
            byte => {
                self.put_at(self.row, self.column, byte);
                self.column += 1;
                if self.column == VGA_WIDTH {
                    self.column = 0;
                    if self.row + 1 < VGA_HEIGHT {
                        self.row += 1;
                    }
                }
            }
        }
    }

    fn put_at(&self, row: usize, column: usize, byte: u8) {
        let offset = (row * VGA_WIDTH + column) * 2;
        unsafe {
            write_volatile((VGA_BASE + offset) as *mut u8, byte);
            write_volatile(
                (VGA_BASE + offset + 1) as *mut u8,
                self.attribute,
            );
        }
    }
}
