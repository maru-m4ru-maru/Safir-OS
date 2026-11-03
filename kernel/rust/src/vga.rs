use core::ptr::write_volatile;

const VGA_BASE: usize = 0xB8000;
const VGA_WIDTH: usize = 80;
const VGA_HEIGHT: usize = 25;
const DEFAULT_ATTRIBUTE: u8 = 0x0F;
const CONSOLE_START_ROW: usize = 6;

#[cfg(target_os = "none")]
fn serial_write_byte(byte: u8) {
    unsafe {
        loop {
            let status: u8;

            core::arch::asm!(
                "in al, dx",
                in("dx") 0x3FDu16,
                lateout("al") status,
                options(nomem, nostack, preserves_flags)
            );

            if status & 0x20 != 0 {
                break;
            }
        }

        core::arch::asm!(
            "out dx, al",
            in("dx") 0x3F8u16,
            in("al") byte,
            options(nomem, nostack, preserves_flags)
        );
    }
}

#[cfg(not(target_os = "none"))]
fn serial_write_byte(_byte: u8) {}

fn serial_write_bytes(bytes: &[u8]) {
    for &byte in bytes {
        serial_write_byte(byte);
    }
}

fn utf8_sequence_length(first: u8) -> usize {
    match first {
        0xC2..=0xDF => 2,
        0xE0..=0xEF => 3,
        0xF0..=0xF4 => 4,
        _ => 1,
    }
}

fn display_width(bytes: &[u8]) -> usize {
    let mut width = 0;
    let mut index = 0;

    while index < bytes.len() {
        let byte = bytes[index];

        if byte < 0x80 {
            width += 1;
            index += 1;
        } else if byte & 0xC0 == 0x80 {
            index += 1;
        } else {
            width += 2;
            index += utf8_sequence_length(byte);
        }
    }

    width
}

pub struct Writer {
    row: usize,
    column: usize,
    attribute: u8,
    input_anchor: Option<(usize, usize)>,
}

impl Writer {
    pub const fn new() -> Self {
        Self {
            row: 0,
            column: 0,
            attribute: DEFAULT_ATTRIBUTE,
            input_anchor: None,
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
        self.input_anchor = None;
    }

    pub fn write_bytes(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.write_byte(byte);
        }
    }

    fn write_byte(&mut self, byte: u8) {
        match byte {
            b'\n' => {
                serial_write_byte(b'\r');
                serial_write_byte(b'\n');
                self.column = 0;
                self.input_anchor = None;
                if self.row + 1 < VGA_HEIGHT {
                    self.row += 1;
                }
            }
            0x08 => {
                serial_write_byte(0x08);
                serial_write_byte(b' ');
                serial_write_byte(0x08);

                if self.column > 0 {
                    self.column -= 1;
                } else if self.row > 0 {
                    self.row -= 1;
                    self.column = VGA_WIDTH - 1;
                } else {
                    return;
                }
                self.put_at(self.row, self.column, b' ');
            }
            b'\t' => {
                serial_write_byte(byte);
                let next = (self.column + 4) & !3;
                while self.column < next {
                    self.put_at(self.row, self.column, b' ');
                    self.column += 1;
                    if self.column == VGA_WIDTH {
                        self.column = 0;
                        if self.row + 1 < VGA_HEIGHT {
                            self.row += 1;
                        }
                        break;
                    }
                }
            }
            b'\r' => {
                serial_write_byte(byte);
                self.column = 0;
            }
            0x20..=0x7E => {
                serial_write_byte(byte);
                self.put_at(self.row, self.column, byte);
                self.column += 1;
                if self.column == VGA_WIDTH {
                    self.column = 0;
                    if self.row + 1 < VGA_HEIGHT {
                        self.row += 1;
                    }
                }
            }
            0x80..=0xFF => {
                serial_write_byte(byte);
            }
            _ => {}
        }
    }

    fn redraw_input_line(&mut self, prompt: &[u8], line: &[u8], cursor: usize) {
        let (row, column) = self.input_anchor.unwrap_or((self.row, 0));
        let cursor = cursor.min(line.len());
        let line_width = display_width(line);
        let cursor_width = display_width(&line[..cursor]);
        let trailing_width = line_width.saturating_sub(cursor_width);

        serial_write_byte(b'\r');
        serial_write_bytes(prompt);
        serial_write_bytes(line);
        serial_write_bytes(b"\x1B[K");

        for _ in 0..trailing_width {
            serial_write_bytes(b"\x1B[D");
        }

        for screen_column in column..VGA_WIDTH {
            self.put_at(row, screen_column, b' ');
        }

        let mut screen_column = column;
        Self::write_vga_text(self, row, &mut screen_column, prompt);
        Self::write_vga_text(self, row, &mut screen_column, line);

        self.row = row;
        self.column = screen_column.min(VGA_WIDTH - 1);
        self.input_anchor = Some((row, column));
    }

    fn finish_input_line(&mut self, message: &[u8]) {
        let (row, column) = self.input_anchor.unwrap_or((self.row, 0));

        serial_write_bytes(b"\r\x1B[K");
        serial_write_bytes(message);
        serial_write_bytes(b"\r\n");

        for screen_column in column..VGA_WIDTH {
            self.put_at(row, screen_column, b' ');
        }

        let mut message_column = column;
        Self::write_vga_text(self, row, &mut message_column, message);

        self.row = if row + 1 < VGA_HEIGHT { row + 1 } else { row };
        self.column = 0;
        self.input_anchor = None;
    }

    fn write_vga_text(
        &self,
        row: usize,
        column: &mut usize,
        bytes: &[u8],
    ) {
        let mut index = 0;

        while index < bytes.len() && *column < VGA_WIDTH {
            let byte = bytes[index];

            if byte < 0x80 {
                self.put_at(row, *column, byte);
                *column += 1;
                index += 1;
            } else if byte & 0xC0 == 0x80 {
                index += 1;
            } else {
                let sequence_length = utf8_sequence_length(byte);
                self.put_at(row, *column, b'?');
                *column += 1;

                if *column < VGA_WIDTH {
                    self.put_at(row, *column, b'?');
                    *column += 1;
                }

                index = (index + sequence_length).min(bytes.len());
            }
        }
    }

    fn put_at(&self, row: usize, column: usize, byte: u8) {
        if row >= VGA_HEIGHT || column >= VGA_WIDTH {
            return;
        }

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

static mut CONSOLE_WRITER: Writer = Writer::new();

pub fn console_init() {
    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.row = CONSOLE_START_ROW;
        writer.column = 0;
        writer.write_bytes(b"SafirOS Rust Kernel\n");
        writer.write_bytes(b"Kernel Core: OK\n");
    }
}

pub fn console_clear() {
    serial_write_bytes(b"\x1B[2J\x1B[H");

    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.clear();
    }
}

pub fn console_write_prompt(prompt: &[u8]) {
    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.input_anchor = Some((writer.row, writer.column));
        writer.redraw_input_line(prompt, &[], 0);
    }
}

pub fn console_redraw_input_line(prompt: &[u8], line: &[u8], cursor: usize) {
    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.redraw_input_line(prompt, line, cursor);
    }
}

pub fn console_end_input_line() {
    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.input_anchor = None;
    }
}

pub fn console_finish_input_line(message: &[u8]) {
    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.finish_input_line(message);
    }
}

pub fn console_write_bytes(bytes: &[u8]) {
    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.write_bytes(bytes);
    }
}

pub fn console_write_byte(byte: u8) {
    unsafe {
        let writer = &mut *core::ptr::addr_of_mut!(CONSOLE_WRITER);
        writer.write_byte(byte);
    }
}
