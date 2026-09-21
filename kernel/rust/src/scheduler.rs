pub struct Scheduler<const N: usize> {
    data: [u64; N],
    head: usize,
    tail: usize,
    len: usize,
}

impl<const N: usize> Scheduler<N> {
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

    pub fn enqueue(&mut self, task_id: u64) -> bool {
        if N == 0 || self.is_full() {
            return false;
        }

        self.data[self.tail] = task_id;
        self.tail = if self.tail + 1 == N { 0 } else { self.tail + 1 };
        self.len += 1;
        true
    }

    pub fn dequeue(&mut self) -> Option<u64> {
        if self.is_empty() {
            return None;
        }

        let task_id = self.data[self.head];
        self.head = if self.head + 1 == N { 0 } else { self.head + 1 };
        self.len -= 1;
        Some(task_id)
    }

    pub fn next(&mut self) -> Option<u64> {
        let task_id = self.dequeue()?;
        if self.enqueue(task_id) {
            Some(task_id)
        } else {
            None
        }
    }

    pub fn peek(&self) -> Option<u64> {
        if self.is_empty() {
            None
        } else {
            Some(self.data[self.head])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Scheduler;

    #[test]
    fn starts_empty() {
        let scheduler = Scheduler::<4>::new();
        assert!(scheduler.is_empty());
        assert!(!scheduler.is_full());
        assert_eq!(scheduler.len(), 0);
        assert_eq!(scheduler.free(), 4);
        assert_eq!(scheduler.peek(), None);
    }

    #[test]
    fn fifo_order_is_preserved() {
        let mut scheduler = Scheduler::<4>::new();
        assert!(scheduler.enqueue(1));
        assert!(scheduler.enqueue(2));
        assert!(scheduler.enqueue(3));

        assert_eq!(scheduler.peek(), Some(1));
        assert_eq!(scheduler.dequeue(), Some(1));
        assert_eq!(scheduler.dequeue(), Some(2));
        assert_eq!(scheduler.dequeue(), Some(3));
        assert_eq!(scheduler.dequeue(), None);
    }

    #[test]
    fn full_queue_rejects_enqueue() {
        let mut scheduler = Scheduler::<2>::new();
        assert!(scheduler.enqueue(10));
        assert!(scheduler.enqueue(20));
        assert!(scheduler.is_full());
        assert_eq!(scheduler.free(), 0);
        assert!(!scheduler.enqueue(30));
        assert_eq!(scheduler.peek(), Some(10));
    }

    #[test]
    fn next_rotates_round_robin() {
        let mut scheduler = Scheduler::<3>::new();
        assert!(scheduler.enqueue(1));
        assert!(scheduler.enqueue(2));
        assert!(scheduler.enqueue(3));

        assert_eq!(scheduler.next(), Some(1));
        assert_eq!(scheduler.next(), Some(2));
        assert_eq!(scheduler.next(), Some(3));
        assert_eq!(scheduler.peek(), Some(1));
        assert_eq!(scheduler.len(), 3);
    }

    #[test]
    fn wraparound_preserves_schedule_order() {
        let mut scheduler = Scheduler::<3>::new();
        assert!(scheduler.enqueue(1));
        assert!(scheduler.enqueue(2));
        assert_eq!(scheduler.dequeue(), Some(1));
        assert!(scheduler.enqueue(3));
        assert!(scheduler.enqueue(4));

        assert_eq!(scheduler.next(), Some(2));
        assert_eq!(scheduler.next(), Some(3));
        assert_eq!(scheduler.next(), Some(4));
        assert_eq!(scheduler.next(), Some(2));
    }

    #[test]
    fn empty_scheduler_returns_none() {
        let mut scheduler = Scheduler::<1>::new();
        assert_eq!(scheduler.dequeue(), None);
        assert_eq!(scheduler.next(), None);
        assert_eq!(scheduler.peek(), None);
    }

    #[test]
    fn zero_capacity_is_safe() {
        let mut scheduler = Scheduler::<0>::new();
        assert_eq!(scheduler.capacity(), 0);
        assert!(scheduler.is_empty());
        assert!(scheduler.is_full());
        assert_eq!(scheduler.free(), 0);
        assert!(!scheduler.enqueue(1));
        assert_eq!(scheduler.dequeue(), None);
        assert_eq!(scheduler.next(), None);
        assert_eq!(scheduler.peek(), None);
    }

    #[test]
    fn duplicate_task_ids_are_allowed() {
        let mut scheduler = Scheduler::<4>::new();
        assert!(scheduler.enqueue(7));
        assert!(scheduler.enqueue(7));
        assert_eq!(scheduler.next(), Some(7));
        assert_eq!(scheduler.next(), Some(7));
    }

    #[test]
    fn state_invariants_survive_mixed_operations() {
        let mut scheduler = Scheduler::<4>::new();
        let operations = [
            ("enqueue", 1u64),
            ("enqueue", 2),
            ("enqueue", 3),
            ("next", 0),
            ("enqueue", 4),
            ("dequeue", 0),
            ("enqueue", 5),
            ("enqueue", 6),
            ("next", 0),
            ("next", 0),
            ("dequeue", 0),
            ("next", 0),
        ];

        for (kind, value) in operations {
            match kind {
                "enqueue" => {
                    let _ = scheduler.enqueue(value);
                }
                "dequeue" => {
                    let _ = scheduler.dequeue();
                }
                "next" => {
                    let _ = scheduler.next();
                }
                _ => unreachable!(),
            }

            assert!(scheduler.len() <= scheduler.capacity());
            assert_eq!(scheduler.len() + scheduler.free(), scheduler.capacity());
            assert_eq!(scheduler.is_empty(), scheduler.len() == 0);
            assert_eq!(scheduler.is_full(), scheduler.len() == scheduler.capacity());
        }
    }
}
