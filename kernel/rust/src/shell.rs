pub const PROMPT: &[u8] = b"safiros> ";

const MAX_LINE_LENGTH: usize = 96;
const MAX_LINE_CELLS: usize = 70;
const HISTORY_CAPACITY: usize = 8;
const ESCAPE_BUFFER_LENGTH: usize = 8;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum InputAction {
    Redraw,
    Submit,
    Interrupt,
    ClearScreen,
    Nothing,
    Overflow,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Command<'a> {
    Empty,
    Help,
    Clear,
    About,
    Echo(&'a [u8]),
    Unknown(&'a [u8]),
}

pub struct Shell {
    line: [u8; MAX_LINE_LENGTH],
    length: usize,
    cursor: usize,
    escape_state: u8,
    escape_params: [u8; ESCAPE_BUFFER_LENGTH],
    escape_len: usize,
    utf8_remaining: u8,
    history: [[u8; MAX_LINE_LENGTH]; HISTORY_CAPACITY],
    history_lengths: [usize; HISTORY_CAPACITY],
    history_next: usize,
    history_count: usize,
    history_position: usize,
    draft: [u8; MAX_LINE_LENGTH],
    draft_length: usize,
}

impl Shell {
    pub const fn new() -> Self {
        Self {
            line: [0; MAX_LINE_LENGTH],
            length: 0,
            cursor: 0,
            escape_state: 0,
            escape_params: [0; ESCAPE_BUFFER_LENGTH],
            escape_len: 0,
            utf8_remaining: 0,
            history: [[0; MAX_LINE_LENGTH]; HISTORY_CAPACITY],
            history_lengths: [0; HISTORY_CAPACITY],
            history_next: 0,
            history_count: 0,
            history_position: 0,
            draft: [0; MAX_LINE_LENGTH],
            draft_length: 0,
        }
    }

    pub fn feed_byte(&mut self, byte: u8) -> InputAction {
        if self.escape_state != 0 {
            return self.feed_escape(byte);
        }

        if byte == 0x1B {
            self.escape_state = 1;
            self.escape_len = 0;
            return InputAction::Nothing;
        }

        match byte {
            b'\r' | b'\n' => {
                self.remember_history();
                self.history_position = 0;
                self.utf8_remaining = 0;
                InputAction::Submit
            }
            0x03 => {
                self.clear_line();
                InputAction::Interrupt
            }
            0x04 => self.delete_forward(),
            0x08 | 0x7F => self.backspace(),
            0x01 => self.move_home(),
            0x02 => self.move_left(),
            0x05 => self.move_end(),
            0x06 => self.move_right(),
            0x0B => self.delete_range(self.cursor, self.length),
            0x0C => InputAction::ClearScreen,
            0x0E => self.history_down(),
            0x10 => self.history_up(),
            0x15 => self.delete_range(0, self.cursor),
            0x17 => self.delete_previous_word(),
            b'\t' => self.insert_byte(b' '),
            0x20..=0x7E | 0x80..=0xF4 => self.insert_byte(byte),
            _ => InputAction::Nothing,
        }
    }

    fn feed_escape(&mut self, byte: u8) -> InputAction {
        match self.escape_state {
            1 => match byte {
                b'[' => {
                    self.escape_state = 2;
                    self.escape_len = 0;
                    InputAction::Nothing
                }
                b'O' => {
                    self.escape_state = 3;
                    InputAction::Nothing
                }
                0x1B => {
                    self.escape_state = 1;
                    InputAction::Nothing
                }
                _ => {
                    self.escape_state = 0;
                    self.feed_byte(byte)
                }
            },
            2 => {
                if (0x40..=0x7E).contains(&byte) {
                    let params = self.escape_params;
                    let length = self.escape_len;
                    self.escape_state = 0;
                    self.escape_len = 0;
                    self.handle_csi(&params[..length], byte)
                } else if self.escape_len < ESCAPE_BUFFER_LENGTH {
                    self.escape_params[self.escape_len] = byte;
                    self.escape_len += 1;
                    InputAction::Nothing
                } else {
                    self.escape_state = 0;
                    self.escape_len = 0;
                    InputAction::Nothing
                }
            }
            3 => {
                self.escape_state = 0;
                match byte {
                    b'A' => self.history_up(),
                    b'B' => self.history_down(),
                    b'C' => self.move_right(),
                    b'D' => self.move_left(),
                    b'H' => self.move_home(),
                    b'F' => self.move_end(),
                    _ => InputAction::Nothing,
                }
            }
            _ => {
                self.escape_state = 0;
                InputAction::Nothing
            }
        }
    }

    fn handle_csi(&mut self, params: &[u8], final_byte: u8) -> InputAction {
        let word_motion = params.windows(2).any(|pair| pair == b";5");

        match final_byte {
            b'A' => self.history_up(),
            b'B' => self.history_down(),
            b'C' => {
                if word_motion {
                    self.move_word_right()
                } else {
                    self.move_right()
                }
            }
            b'D' => {
                if word_motion {
                    self.move_word_left()
                } else {
                    self.move_left()
                }
            }
            b'H' => self.move_home(),
            b'F' => self.move_end(),
            b'Z' => InputAction::Nothing,
            b'~' => match first_parameter(params) {
                1 | 7 => self.move_home(),
                3 => self.delete_forward(),
                4 | 8 => self.move_end(),
                _ => InputAction::Nothing,
            },
            _ => InputAction::Nothing,
        }
    }

    fn insert_byte(&mut self, byte: u8) -> InputAction {
        if byte & 0xC0 == 0x80 && self.utf8_remaining == 0 {
            return InputAction::Nothing;
        }

        if self.length == MAX_LINE_LENGTH {
            return InputAction::Overflow;
        }

        self.line.copy_within(self.cursor..self.length, self.cursor + 1);
        self.line[self.cursor] = byte;
        self.length += 1;
        self.cursor += 1;

        if display_width(&self.line[..self.length]) > MAX_LINE_CELLS {
            self.length -= 1;
            self.cursor -= 1;
            self.line.copy_within(self.cursor + 1..self.length + 1, self.cursor);
            return InputAction::Overflow;
        }

        if byte < 0x80 {
            self.utf8_remaining = 0;
            return InputAction::Redraw;
        }

        if byte & 0xC0 == 0xC0 {
            self.utf8_remaining = match byte {
                0xC2..=0xDF => 1,
                0xE0..=0xEF => 2,
                0xF0..=0xF4 => 3,
                _ => 0,
            };
            return if self.utf8_remaining == 0 {
                InputAction::Redraw
            } else {
                InputAction::Nothing
            };
        }

        if byte & 0xC0 == 0x80 && self.utf8_remaining > 0 {
            self.utf8_remaining -= 1;
            return if self.utf8_remaining == 0 {
                InputAction::Redraw
            } else {
                InputAction::Nothing
            };
        }

        self.utf8_remaining = 0;
        InputAction::Redraw
    }

    fn backspace(&mut self) -> InputAction {
        if self.cursor == 0 {
            return InputAction::Nothing;
        }

        let start = previous_char_start(&self.line, self.cursor);
        self.delete_range(start, self.cursor)
    }

    fn delete_forward(&mut self) -> InputAction {
        if self.cursor >= self.length {
            return InputAction::Nothing;
        }

        let end = next_char_end(&self.line, self.length, self.cursor);
        self.delete_range(self.cursor, end)
    }

    fn delete_range(&mut self, start: usize, end: usize) -> InputAction {
        if start >= end || end > self.length {
            return InputAction::Nothing;
        }

        self.line.copy_within(end..self.length, start);
        self.length -= end - start;
        self.cursor = start.min(self.length);
        self.utf8_remaining = 0;
        self.history_position = 0;
        InputAction::Redraw
    }

    fn move_left(&mut self) -> InputAction {
        if self.cursor == 0 {
            return InputAction::Nothing;
        }

        self.cursor = previous_char_start(&self.line, self.cursor);
        InputAction::Redraw
    }

    fn move_right(&mut self) -> InputAction {
        if self.cursor >= self.length {
            return InputAction::Nothing;
        }

        self.cursor = next_char_end(&self.line, self.length, self.cursor);
        InputAction::Redraw
    }

    fn move_home(&mut self) -> InputAction {
        if self.cursor == 0 {
            return InputAction::Nothing;
        }

        self.cursor = 0;
        InputAction::Redraw
    }

    fn move_end(&mut self) -> InputAction {
        if self.cursor == self.length {
            return InputAction::Nothing;
        }

        self.cursor = self.length;
        InputAction::Redraw
    }

    fn move_word_left(&mut self) -> InputAction {
        if self.cursor == 0 {
            return InputAction::Nothing;
        }

        let mut position = self.cursor;

        while position > 0 {
            let previous = previous_char_start(&self.line, position);
            if &self.line[previous..position] != b" " {
                break;
            }
            position = previous;
        }

        while position > 0 {
            let previous = previous_char_start(&self.line, position);
            if &self.line[previous..position] == b" " {
                break;
            }
            position = previous;
        }

        self.cursor = position;
        InputAction::Redraw
    }

    fn move_word_right(&mut self) -> InputAction {
        if self.cursor >= self.length {
            return InputAction::Nothing;
        }

        let mut position = self.cursor;

        while position < self.length {
            let next = next_char_end(&self.line, self.length, position);
            if &self.line[position..next] == b" " {
                break;
            }
            position = next;
        }

        while position < self.length {
            let next = next_char_end(&self.line, self.length, position);
            if &self.line[position..next] != b" " {
                break;
            }
            position = next;
        }

        self.cursor = position;
        InputAction::Redraw
    }

    fn delete_previous_word(&mut self) -> InputAction {
        if self.cursor == 0 {
            return InputAction::Nothing;
        }

        let mut start = self.cursor;

        while start > 0 {
            let previous = previous_char_start(&self.line, start);
            if &self.line[previous..start] != b" " {
                break;
            }
            start = previous;
        }

        while start > 0 {
            let previous = previous_char_start(&self.line, start);
            if &self.line[previous..start] == b" " {
                break;
            }
            start = previous;
        }

        self.delete_range(start, self.cursor)
    }

    fn history_up(&mut self) -> InputAction {
        if self.history_count == 0 || self.history_position == self.history_count {
            return InputAction::Nothing;
        }

        if self.history_position == 0 {
            self.draft[..self.length].copy_from_slice(&self.line[..self.length]);
            self.draft_length = self.length;
        }

        self.history_position += 1;
        let index = (self.history_next + HISTORY_CAPACITY - self.history_position)
            % HISTORY_CAPACITY;
        let history_line = self.history[index];
        let length = self.history_lengths[index];
        self.restore_line(&history_line, length);
        InputAction::Redraw
    }

    fn history_down(&mut self) -> InputAction {
        if self.history_position == 0 {
            return InputAction::Nothing;
        }

        self.history_position -= 1;

        if self.history_position == 0 {
            let draft = self.draft;
            self.restore_line(&draft, self.draft_length);
        } else {
            let index = (self.history_next + HISTORY_CAPACITY - self.history_position)
                % HISTORY_CAPACITY;
            let history_line = self.history[index];
            let length = self.history_lengths[index];
            self.restore_line(&history_line, length);
        }

        InputAction::Redraw
    }

    fn restore_line(&mut self, source: &[u8; MAX_LINE_LENGTH], length: usize) {
        self.line[..length].copy_from_slice(&source[..length]);
        self.length = length;
        self.cursor = length;
        self.utf8_remaining = 0;
    }

    fn remember_history(&mut self) {
        if self.length == 0 {
            return;
        }

        if self.history_count > 0 {
            let latest = (self.history_next + HISTORY_CAPACITY - 1) % HISTORY_CAPACITY;
            if self.history_lengths[latest] == self.length
                && self.history[latest][..self.length] == self.line[..self.length]
            {
                return;
            }
        }

        self.history[self.history_next][..self.length]
            .copy_from_slice(&self.line[..self.length]);
        self.history_lengths[self.history_next] = self.length;
        self.history_next = (self.history_next + 1) % HISTORY_CAPACITY;
        self.history_count = (self.history_count + 1).min(HISTORY_CAPACITY);
    }

    fn clear_line(&mut self) {
        self.length = 0;
        self.cursor = 0;
        self.escape_state = 0;
        self.escape_len = 0;
        self.utf8_remaining = 0;
        self.history_position = 0;
    }

    pub fn command(&self) -> Command<'_> {
        let line = trim_spaces(&self.line[..self.length]);

        if line.is_empty() {
            return Command::Empty;
        }

        if line == b"help" {
            return Command::Help;
        }

        if line == b"clear" {
            return Command::Clear;
        }

        if line == b"about" {
            return Command::About;
        }

        if line == b"echo" {
            return Command::Echo(&[]);
        }

        if line.starts_with(b"echo ") {
            return Command::Echo(trim_spaces(&line[5..]));
        }

        Command::Unknown(line)
    }

    pub fn clear(&mut self) {
        self.clear_line();
    }

    pub fn line(&self) -> &[u8] {
        &self.line[..self.length]
    }

    pub const fn cursor(&self) -> usize {
        self.cursor
    }

    #[cfg(test)]
    pub const fn length(&self) -> usize {
        self.length
    }
}

fn first_parameter(params: &[u8]) -> u8 {
    let mut value = 0u16;
    let mut found = false;

    for &byte in params {
        if byte == b';' {
            break;
        }

        if byte.is_ascii_digit() {
            value = value.saturating_mul(10).saturating_add((byte - b'0') as u16);
            found = true;
        }
    }

    if found { value.min(255) as u8 } else { 0 }
}

fn previous_char_start(line: &[u8; MAX_LINE_LENGTH], cursor: usize) -> usize {
    if cursor == 0 {
        return 0;
    }

    let mut start = cursor - 1;
    while start > 0 && line[start] & 0xC0 == 0x80 {
        start -= 1;
    }
    start
}

fn next_char_end(line: &[u8; MAX_LINE_LENGTH], length: usize, cursor: usize) -> usize {
    if cursor >= length {
        return length;
    }

    let first = line[cursor];
    let count = match first {
        0xC2..=0xDF => 2,
        0xE0..=0xEF => 3,
        0xF0..=0xF4 => 4,
        _ => 1,
    };

    let mut end = (cursor + count).min(length);
    while end < length && line[end] & 0xC0 == 0x80 {
        end += 1;
    }
    end
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
            index += match byte {
                0xC2..=0xDF => 2,
                0xE0..=0xEF => 3,
                0xF0..=0xF4 => 4,
                _ => 1,
            };
        }
    }

    width
}

fn trim_spaces(bytes: &[u8]) -> &[u8] {
    let mut start = 0;
    let mut end = bytes.len();

    while start < end && bytes[start] == b' ' {
        start += 1;
    }

    while start < end && bytes[end - 1] == b' ' {
        end -= 1;
    }

    &bytes[start..end]
}

#[cfg(test)]
mod tests {
    use super::{Command, InputAction, Shell, MAX_LINE_CELLS};

    fn type_bytes(shell: &mut Shell, text: &[u8]) {
        for (index, &byte) in text.iter().enumerate() {
            let action = shell.feed_byte(byte);
            if index + 1 == text.len() {
                assert_eq!(action, InputAction::Redraw);
            }
        }
    }

    fn key_sequence(shell: &mut Shell, sequence: &[u8]) -> InputAction {
        let mut result = InputAction::Nothing;
        for &byte in sequence {
            result = shell.feed_byte(byte);
        }
        result
    }

    fn enter(shell: &mut Shell, text: &[u8]) {
        type_bytes(shell, text);
        assert_eq!(shell.feed_byte(b'\r'), InputAction::Submit);
    }

    #[test]
    fn starts_empty() {
        let shell = Shell::new();
        assert_eq!(shell.length(), 0);
        assert_eq!(shell.command(), Command::Empty);
    }

    #[test]
    fn parses_builtin_commands() {
        let mut shell = Shell::new();

        enter(&mut shell, b"help");
        assert_eq!(shell.command(), Command::Help);
        shell.clear();

        enter(&mut shell, b"clear");
        assert_eq!(shell.command(), Command::Clear);
        shell.clear();

        enter(&mut shell, b"about");
        assert_eq!(shell.command(), Command::About);
    }

    #[test]
    fn parses_echo_text() {
        let mut shell = Shell::new();
        enter(&mut shell, b"echo hello world");
        assert_eq!(shell.command(), Command::Echo(b"hello world"));
    }

    #[test]
    fn trims_command_spaces() {
        let mut shell = Shell::new();
        enter(&mut shell, b"  help  ");
        assert_eq!(shell.command(), Command::Help);
    }

    #[test]
    fn reports_unknown_commands() {
        let mut shell = Shell::new();
        enter(&mut shell, b"version");
        assert_eq!(shell.command(), Command::Unknown(b"version"));
    }

    #[test]
    fn supports_cursor_movement_and_middle_insertion() {
        let mut shell = Shell::new();
        type_bytes(&mut shell, b"helo");
        assert_eq!(key_sequence(&mut shell, b"\x1B[D"), InputAction::Redraw);
        assert_eq!(shell.cursor(), 3);
        type_bytes(&mut shell, b"l");
        assert_eq!(shell.line(), b"hello");
        assert_eq!(shell.cursor(), 4);
    }

    #[test]
    fn supports_home_end_and_delete() {
        let mut shell = Shell::new();
        type_bytes(&mut shell, b"heXllo");
        assert_eq!(key_sequence(&mut shell, b"\x1B[H"), InputAction::Redraw);
        assert_eq!(shell.cursor(), 0);
        assert_eq!(key_sequence(&mut shell, b"\x1B[3~"), InputAction::Redraw);
        assert_eq!(shell.line(), b"eXllo");
        assert_eq!(key_sequence(&mut shell, b"\x1B[F"), InputAction::Redraw);
        assert_eq!(shell.cursor(), shell.length());
    }

    #[test]
    fn control_shortcuts_edit_the_line() {
        let mut shell = Shell::new();
        type_bytes(&mut shell, b"one two");
        assert_eq!(shell.feed_byte(0x17), InputAction::Redraw);
        assert_eq!(shell.line(), b"one ");
        assert_eq!(shell.feed_byte(0x01), InputAction::Redraw);
        assert_eq!(shell.feed_byte(0x0B), InputAction::Redraw);
        assert_eq!(shell.line(), b"");
    }

    #[test]
    fn supports_utf8_cursor_movement_and_backspace() {
        let mut shell = Shell::new();
        type_bytes(&mut shell, "あい".as_bytes());
        assert_eq!(key_sequence(&mut shell, b"\x1B[D"), InputAction::Redraw);
        assert_eq!(shell.cursor(), 3);
        assert_eq!(shell.feed_byte(0x7F), InputAction::Redraw);
        assert_eq!(shell.line(), "い".as_bytes());
    }

    #[test]
    fn history_restores_the_previous_command_and_draft() {
        let mut shell = Shell::new();
        enter(&mut shell, b"help");
        shell.clear();
        type_bytes(&mut shell, b"draft");
        assert_eq!(key_sequence(&mut shell, b"\x1B[A"), InputAction::Redraw);
        assert_eq!(shell.line(), b"help");
        assert_eq!(key_sequence(&mut shell, b"\x1B[B"), InputAction::Redraw);
        assert_eq!(shell.line(), b"draft");
    }

    #[test]
    fn supports_control_c_and_clear_screen() {
        let mut shell = Shell::new();
        type_bytes(&mut shell, b"help");
        assert_eq!(shell.feed_byte(0x03), InputAction::Interrupt);
        assert_eq!(shell.line(), b"");
        assert_eq!(shell.feed_byte(0x0C), InputAction::ClearScreen);
    }

    #[test]
    fn backspace_on_empty_line_does_nothing() {
        let mut shell = Shell::new();
        assert_eq!(shell.feed_byte(0x08), InputAction::Nothing);
    }

    #[test]
    fn rejects_input_after_buffer_is_full() {
        let mut shell = Shell::new();

        for _ in 0..MAX_LINE_CELLS {
            assert_eq!(shell.feed_byte(b'x'), InputAction::Redraw);
        }

        assert_eq!(shell.feed_byte(b'x'), InputAction::Overflow);
    }
}
