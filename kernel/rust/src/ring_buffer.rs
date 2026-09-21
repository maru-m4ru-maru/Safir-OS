pub struct RingBuffer<const N: usize> {
    data: [u8; N],
    head: usize,
    tail: usize,
    len: usize,
}

impl<const N: usize> RingBuffer<N> {
    pub const fn new() -> Self {
        Self {
            data: [0; N],
            head: 0,
            tail: 0,
            len: 0,
        }
    }

    pub const fn capacity(&self) -> usize {
        N
    }

    pub const fn len(&self) -> usize {
        self.len
    }

    pub const fn free(&self) -> usize {
        N - self.len
    }

    pub const fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub const fn is_full(&self) -> bool {
        self.len == N
    }

    pub fn push(&mut self, value: u8) -> bool {
        if N == 0 || self.is_full() {
            return false;
        }

        self.data[self.tail] = value;
        self.tail = if self.tail + 1 == N { 0 } else { self.tail + 1 };
        self.len += 1;
        true
    }

    pub fn pop(&mut self) -> Option<u8> {
        if self.is_empty() {
            return None;
        }

        let value = self.data[self.head];
        self.head = if self.head + 1 == N { 0 } else { self.head + 1 };
        self.len -= 1;
        Some(value)
    }

    pub fn peek(&self) -> Option<u8> {
        if self.is_empty() {
            None
        } else {
            Some(self.data[self.head])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::RingBuffer;

    #[test]
    fn starts_empty() {
        let buffer = RingBuffer::<4>::new();
        assert!(buffer.is_empty());
        assert!(!buffer.is_full());
        assert_eq!(buffer.len(), 0);
        assert_eq!(buffer.free(), 4);
        assert_eq!(buffer.peek(), None);
        assert_eq!(buffer.pop(), None);
    }

    #[test]
    fn fifo_order_is_preserved() {
        let mut buffer = RingBuffer::<4>::new();
        assert!(buffer.push(10));
        assert!(buffer.push(20));
        assert!(buffer.push(30));

        assert_eq!(buffer.peek(), Some(10));
        assert_eq!(buffer.pop(), Some(10));
        assert_eq!(buffer.pop(), Some(20));
        assert_eq!(buffer.pop(), Some(30));
        assert_eq!(buffer.pop(), None);
    }

    #[test]
    fn full_buffer_rejects_push() {
        let mut buffer = RingBuffer::<2>::new();
        assert!(buffer.push(1));
        assert!(buffer.push(2));
        assert!(buffer.is_full());
        assert_eq!(buffer.free(), 0);
        assert!(!buffer.push(3));
        assert_eq!(buffer.len(), 2);
        assert_eq!(buffer.peek(), Some(1));
    }

    #[test]
    fn wraparound_preserves_order() {
        let mut buffer = RingBuffer::<3>::new();
        assert!(buffer.push(1));
        assert!(buffer.push(2));
        assert_eq!(buffer.pop(), Some(1));
        assert!(buffer.push(3));
        assert!(buffer.push(4));

        assert_eq!(buffer.pop(), Some(2));
        assert_eq!(buffer.pop(), Some(3));
        assert_eq!(buffer.pop(), Some(4));
        assert_eq!(buffer.pop(), None);
    }

    #[test]
    fn empty_buffer_rejects_pop_and_peek() {
        let mut buffer = RingBuffer::<1>::new();
        assert_eq!(buffer.pop(), None);
        assert_eq!(buffer.peek(), None);
        assert!(buffer.push(7));
        assert_eq!(buffer.pop(), Some(7));
        assert_eq!(buffer.pop(), None);
    }

    #[test]
    fn zero_capacity_is_safe() {
        let mut buffer = RingBuffer::<0>::new();
        assert_eq!(buffer.capacity(), 0);
        assert!(buffer.is_empty());
        assert!(buffer.is_full());
        assert_eq!(buffer.free(), 0);
        assert!(!buffer.push(1));
        assert_eq!(buffer.pop(), None);
        assert_eq!(buffer.peek(), None);
    }

    #[test]
    fn state_invariants_survive_mixed_operations() {
        let mut buffer = RingBuffer::<4>::new();
        let operations = [
            ("push", 0u8),
            ("push", 1),
            ("push", 2),
            ("pop", 0),
            ("push", 3),
            ("push", 4),
            ("push", 5),
            ("pop", 0),
            ("pop", 0),
            ("push", 6),
            ("push", 7),
            ("pop", 0),
            ("pop", 0),
            ("pop", 0),
        ];

        for (kind, value) in operations {
            match kind {
                "push" => {
                    let _ = buffer.push(value);
                }
                "pop" => {
                    let _ = buffer.pop();
                }
                _ => unreachable!(),
            }

            assert!(buffer.len() <= buffer.capacity());
            assert_eq!(buffer.len() + buffer.free(), buffer.capacity());
            assert_eq!(buffer.is_empty(), buffer.len() == 0);
            assert_eq!(buffer.is_full(), buffer.len() == buffer.capacity());
        }
    }
}
