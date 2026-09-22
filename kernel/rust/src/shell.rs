pub const PROMPT: &[u8] = b"safiros> ";

const MAX_LINE_LENGTH: usize = 96;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum InputAction {
    Character(u8),
    Backspace,
    Submit,
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
}

impl Shell {
    pub const fn new() -> Self {
        Self {
            line: [0; MAX_LINE_LENGTH],
            length: 0,
        }
    }

    pub fn feed_byte(&mut self, byte: u8) -> InputAction {
        match byte {
            b'\n' => InputAction::Submit,
            0x08 => {
                if self.length == 0 {
                    InputAction::Nothing
                } else {
                    self.length -= 1;
                    InputAction::Backspace
                }
            }
            0x20..=0x7E => {
                if self.length == MAX_LINE_LENGTH {
                    InputAction::Overflow
                } else {
                    self.line[self.length] = byte;
                    self.length += 1;
                    InputAction::Character(byte)
                }
            }
            _ => InputAction::Nothing,
        }
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
        self.length = 0;
    }

    pub const fn length(&self) -> usize {
        self.length
    }
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
    use super::{Command, InputAction, Shell, MAX_LINE_LENGTH};

    fn enter(shell: &mut Shell, text: &[u8]) {
        for &byte in text {
            assert_eq!(shell.feed_byte(byte), InputAction::Character(byte));
        }
        assert_eq!(shell.feed_byte(b'\n'), InputAction::Submit);
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
    fn backspace_removes_last_character() {
        let mut shell = Shell::new();
        assert_eq!(shell.feed_byte(b'a'), InputAction::Character(b'a'));
        assert_eq!(shell.feed_byte(b'b'), InputAction::Character(b'b'));
        assert_eq!(shell.feed_byte(0x08), InputAction::Backspace);
        assert_eq!(shell.length(), 1);
        assert_eq!(shell.command(), Command::Unknown(b"a"));
    }

    #[test]
    fn backspace_on_empty_line_does_nothing() {
        let mut shell = Shell::new();
        assert_eq!(shell.feed_byte(0x08), InputAction::Nothing);
    }

    #[test]
    fn rejects_input_after_buffer_is_full() {
        let mut shell = Shell::new();

        for _ in 0..MAX_LINE_LENGTH {
            assert_eq!(shell.feed_byte(b'x'), InputAction::Character(b'x'));
        }

        assert_eq!(shell.feed_byte(b'x'), InputAction::Overflow);
    }
}
