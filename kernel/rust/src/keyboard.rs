use crate::RingBuffer;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct KeyboardDecoder {
    shift: bool,
    caps_lock: bool,
    extended: bool,
}

impl KeyboardDecoder {
    pub const fn new() -> Self {
        Self {
            shift: false,
            caps_lock: false,
            extended: false,
        }
    }

    pub const fn shift_active(self) -> bool {
        self.shift
    }

    pub const fn caps_lock_active(self) -> bool {
        self.caps_lock
    }

    pub fn feed(&mut self, scancode: u8) -> Option<u8> {
        if scancode == 0xE0 {
            self.extended = true;
            return None;
        }

        if scancode == 0x2A || scancode == 0x36 {
            if self.extended {
                self.extended = false;
                return None;
            }
            self.shift = true;
            return None;
        }

        if scancode == 0xAA || scancode == 0xB6 {
            if self.extended {
                self.extended = false;
                return None;
            }
            self.shift = false;
            return None;
        }

        if scancode & 0x80 != 0 {
            self.extended = false;
            return None;
        }

        if self.extended {
            self.extended = false;
            return None;
        }

        if scancode == 0x3A {
            self.caps_lock = !self.caps_lock;
            return None;
        }

        let (normal, shifted) = match scancode {
            0x02 => (b'1', b'!'),
            0x03 => (b'2', b'@'),
            0x04 => (b'3', b'#'),
            0x05 => (b'4', b'$'),
            0x06 => (b'5', b'%'),
            0x07 => (b'6', b'^'),
            0x08 => (b'7', b'&'),
            0x09 => (b'8', b'*'),
            0x0A => (b'9', b'('),
            0x0B => (b'0', b')'),
            0x0C => (b'-', b'_'),
            0x0D => (b'=', b'+'),
            0x1A => (b'[', b'{'),
            0x1B => (b']', b'}'),
            0x27 => (b';', b':'),
            0x28 => (b'\'', b'"'),
            0x29 => (0x60, 0x7E),
            0x2B => (b'\\', b'|'),
            0x33 => (b',', b'<'),
            0x34 => (b'.', b'>'),
            0x35 => (b'/', b'?'),
            0x39 => (b' ', b' '),
            _ => return self.feed_letter_or_control(scancode),
        };

        Some(if self.shift { shifted } else { normal })
    }

    fn feed_letter_or_control(&self, scancode: u8) -> Option<u8> {
        match scancode {
            0x01 => Some(0x1B),
            0x0E => Some(0x08),
            0x0F => Some(b'\t'),
            0x1C => Some(b'\n'),
            0x10..=0x19 => self.letter(b"qwertyuiop", scancode - 0x10),
            0x1E..=0x26 => self.letter(b"asdfghjkl", scancode - 0x1E),
            0x2C..=0x32 => self.letter(b"zxcvbnm", scancode - 0x2C),
            _ => None,
        }
    }

    fn letter(&self, letters: &[u8], index: u8) -> Option<u8> {
        let byte = letters[index as usize];
        let uppercase = self.shift ^ self.caps_lock;
        Some(if uppercase {
            byte - b'a' + b'A'
        } else {
            byte
        })
    }
}

#[cfg(test)]
mod tests {
    use super::KeyboardDecoder;

    #[test]
    fn starts_with_no_modifiers() {
        let decoder = KeyboardDecoder::new();
        assert!(!decoder.shift_active());
        assert!(!decoder.caps_lock_active());
    }

    #[test]
    fn decodes_letters() {
        let mut decoder = KeyboardDecoder::new();
        assert_eq!(decoder.feed(0x1E), Some(b'a'));
        assert_eq!(decoder.feed(0x30), Some(b'b'));
        assert_eq!(decoder.feed(0x2E), Some(b'c'));
    }

    #[test]
    fn shift_changes_letter_case() {
        let mut decoder = KeyboardDecoder::new();
        assert_eq!(decoder.feed(0x2A), None);
        assert!(decoder.shift_active());
        assert_eq!(decoder.feed(0x1E), Some(b'A'));
        assert_eq!(decoder.feed(0xAA), None);
        assert!(!decoder.shift_active());
        assert_eq!(decoder.feed(0x1E), Some(b'a'));
    }

    #[test]
    fn caps_lock_changes_letter_case() {
        let mut decoder = KeyboardDecoder::new();
        assert_eq!(decoder.feed(0x3A), None);
        assert!(decoder.caps_lock_active());
        assert_eq!(decoder.feed(0x1E), Some(b'A'));
        assert_eq!(decoder.feed(0x3A), None);
        assert!(!decoder.caps_lock_active());
        assert_eq!(decoder.feed(0x1E), Some(b'a'));
    }

    #[test]
    fn shift_and_caps_lock_cancel_for_letters() {
        let mut decoder = KeyboardDecoder::new();
        let _ = decoder.feed(0x3A);
        let _ = decoder.feed(0x2A);
        assert_eq!(decoder.feed(0x1E), Some(b'a'));
        let _ = decoder.feed(0xAA);
    }

    #[test]
    fn shifted_symbols_are_decoded() {
        let mut decoder = KeyboardDecoder::new();
        assert_eq!(decoder.feed(0x02), Some(b'1'));
        let _ = decoder.feed(0x2A);
        assert_eq!(decoder.feed(0x02), Some(b'!'));
        let _ = decoder.feed(0xAA);
        assert_eq!(decoder.feed(0x0D), Some(b'='));
        let _ = decoder.feed(0x2A);
        assert_eq!(decoder.feed(0x35), Some(b'?'));
        let _ = decoder.feed(0xAA);
    }

    #[test]
    fn control_keys_are_decoded() {
        let mut decoder = KeyboardDecoder::new();
        assert_eq!(decoder.feed(0x01), Some(0x1B));
        assert_eq!(decoder.feed(0x0E), Some(0x08));
        assert_eq!(decoder.feed(0x0F), Some(b'\t'));
        assert_eq!(decoder.feed(0x1C), Some(b'\n'));
        assert_eq!(decoder.feed(0x39), Some(b' '));
    }

    #[test]
    fn break_codes_and_extended_codes_do_not_emit_keys() {
        let mut decoder = KeyboardDecoder::new();
        assert_eq!(decoder.feed(0x9E), None);
        assert_eq!(decoder.feed(0xE0), None);
        assert_eq!(decoder.feed(0x48), None);
        assert_eq!(decoder.feed(0xC8), None);
    }

    #[test]
    fn right_shift_release_is_handled() {
        let mut decoder = KeyboardDecoder::new();
        assert_eq!(decoder.feed(0x36), None);
        assert!(decoder.shift_active());
        assert_eq!(decoder.feed(0xB6), None);
        assert!(!decoder.shift_active());
        assert_eq!(decoder.feed(0x1E), Some(b'a'));
    }
}


pub const KEYBOARD_HOOK_SLOT: usize = 0x0005F010;
const KEYBOARD_BUFFER_CAPACITY: usize = 64;

pub struct KeyboardInput<const N: usize> {
    decoder: KeyboardDecoder,
    buffer: RingBuffer<N>,
}

impl<const N: usize> KeyboardInput<N> {
    pub const fn new() -> Self {
        Self {
            decoder: KeyboardDecoder::new(),
            buffer: RingBuffer::new(),
        }
    }

    pub fn feed_scancode(&mut self, scancode: u8) -> bool {
        let Some(byte) = self.decoder.feed(scancode) else {
            return false;
        };

        self.buffer.push(byte)
    }

    pub fn pop(&mut self) -> Option<u8> {
        self.buffer.pop()
    }

    pub const fn len(&self) -> usize {
        self.buffer.len()
    }

    pub const fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    pub const fn is_full(&self) -> bool {
        self.buffer.is_full()
    }
}

static mut KEYBOARD_INPUT: KeyboardInput<KEYBOARD_BUFFER_CAPACITY> =
    KeyboardInput::new();

#[unsafe(no_mangle)]
pub unsafe extern "C" fn keyboard_irq(scancode: u8) -> u64 {
    let input = &mut *core::ptr::addr_of_mut!(KEYBOARD_INPUT);
    if input.feed_scancode(scancode) {
        1
    } else {
        0
    }
}

#[cfg(test)]
mod input_tests {
    use super::KeyboardInput;

    #[test]
    fn input_queue_decodes_and_buffers_keys() {
        let mut input = KeyboardInput::<4>::new();
        assert!(input.is_empty());
        assert_eq!(input.len(), 0);

        assert!(input.feed_scancode(0x1E));
        assert!(input.feed_scancode(0x30));
        assert_eq!(input.len(), 2);

        assert_eq!(input.pop(), Some(b'a'));
        assert_eq!(input.pop(), Some(b'b'));
        assert_eq!(input.pop(), None);
        assert!(input.is_empty());
    }

    #[test]
    fn input_queue_ignores_break_codes() {
        let mut input = KeyboardInput::<4>::new();
        assert!(!input.feed_scancode(0x9E));
        assert_eq!(input.pop(), None);
    }

    #[test]
    fn input_queue_rejects_when_full() {
        let mut input = KeyboardInput::<2>::new();
        assert!(input.feed_scancode(0x1E));
        assert!(input.feed_scancode(0x30));
        assert!(!input.feed_scancode(0x2E));
        assert!(input.is_full());
        assert_eq!(input.pop(), Some(b'a'));
        assert_eq!(input.pop(), Some(b'b'));
        assert_eq!(input.pop(), None);
    }

    #[test]
    fn input_queue_preserves_shift_and_caps_state() {
        let mut input = KeyboardInput::<8>::new();
        assert!(!input.feed_scancode(0x2A));
        assert!(input.feed_scancode(0x1E));
        assert!(!input.feed_scancode(0xAA));
        assert!(!input.feed_scancode(0x3A));
        assert!(input.feed_scancode(0x30));

        assert_eq!(input.pop(), Some(b'A'));
        assert_eq!(input.pop(), Some(b'B'));
    }
}
