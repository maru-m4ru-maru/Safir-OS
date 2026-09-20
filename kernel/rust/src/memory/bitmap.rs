pub struct Bitmap<const WORDS: usize> {
    bits: [u64; WORDS],
    used: usize,
}

impl<const WORDS: usize> Bitmap<WORDS> {
    pub const CAPACITY: usize = WORDS * 64;

    pub const fn new() -> Self {
        Self {
            bits: [0; WORDS],
            used: 0,
        }
    }

    pub const fn used(&self) -> usize {
        self.used
    }

    pub const fn free(&self) -> usize {
        Self::CAPACITY - self.used
    }

    pub const fn is_full(&self) -> bool {
        self.used == Self::CAPACITY
    }

    pub const fn is_empty(&self) -> bool {
        self.used == 0
    }

    pub fn is_allocated(&self, index: usize) -> Option<bool> {
        if index >= Self::CAPACITY {
            return None;
        }

        let word = index / 64;
        let bit = index % 64;
        Some((self.bits[word] & (1u64 << bit)) != 0)
    }

    pub fn allocate(&mut self) -> Option<usize> {
        if self.is_full() {
            return None;
        }

        for word_index in 0..WORDS {
            let word = self.bits[word_index];
            if word != u64::MAX {
                let bit = word.trailing_ones() as usize;
                self.bits[word_index] |= 1u64 << bit;
                self.used += 1;
                return Some(word_index * 64 + bit);
            }
        }

        None
    }

    pub fn allocate_specific(&mut self, index: usize) -> bool {
        if index >= Self::CAPACITY || self.is_allocated(index) == Some(true) {
            return false;
        }

        let word = index / 64;
        let bit = index % 64;
        self.bits[word] |= 1u64 << bit;
        self.used += 1;
        true
    }

    pub fn free_index(&mut self, index: usize) -> bool {
        if index >= Self::CAPACITY || self.is_allocated(index) != Some(true) {
            return false;
        }

        let word = index / 64;
        let bit = index % 64;
        self.bits[word] &= !(1u64 << bit);
        self.used -= 1;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::Bitmap;

    #[test]
    fn starts_empty() {
        let bitmap = Bitmap::<2>::new();
        assert!(bitmap.is_empty());
        assert_eq!(bitmap.used(), 0);
        assert_eq!(bitmap.free(), 128);
    }

    #[test]
    fn allocates_unique_indices() {
        let mut bitmap = Bitmap::<1>::new();
        let a = bitmap.allocate();
        let b = bitmap.allocate();

        assert_eq!(a, Some(0));
        assert_eq!(b, Some(1));
        assert_eq!(a, b);
        assert_eq!(bitmap.used(), 2);
    }

    #[test]
    fn reuses_freed_index() {
        let mut bitmap = Bitmap::<1>::new();
        assert_eq!(bitmap.allocate(), Some(0));
        assert!(bitmap.free_index(0));
        assert_eq!(bitmap.allocate(), Some(0));
    }

    #[test]
    fn rejects_invalid_and_double_free() {
        let mut bitmap = Bitmap::<1>::new();
        assert_eq!(bitmap.is_allocated(64), None);
        assert!(!bitmap.free_index(0));
        assert!(bitmap.allocate_specific(0));
        assert!(!bitmap.allocate_specific(0));
        assert!(bitmap.free_index(0));
        assert!(!bitmap.free_index(0));
    }

    #[test]
    fn fills_to_capacity() {
        let mut bitmap = Bitmap::<1>::new();

        for index in 0..64 {
            assert_eq!(bitmap.allocate(), Some(index));
        }

        assert!(bitmap.is_full());
        assert_eq!(bitmap.allocate(), None);
        assert_eq!(bitmap.used(), 64);
    }

    #[test]
    fn state_invariants_survive_mixed_operations() {
        let mut bitmap = Bitmap::<1>::new();
        let operations = [
            ("alloc", 0usize),
            ("alloc", 0),
            ("specific", 63),
            ("free", 0),
            ("specific", 0),
            ("free", 63),
            ("alloc", 0),
            ("alloc", 0),
        ];

        for (kind, index) in operations {
            match kind {
                "alloc" => {
                    let _ = bitmap.allocate();
                }
                "specific" => {
                    let _ = bitmap.allocate_specific(index);
                }
                "free" => {
                    let _ = bitmap.free_index(index);
                }
                _ => unreachable!(),
            }

            let mut counted = 0usize;
            for i in 0..Bitmap::<1>::CAPACITY {
                if bitmap.is_allocated(i) == Some(true) {
                    counted += 1;
                }
            }

            assert_eq!(bitmap.used(), counted);
            assert_eq!(bitmap.free() + bitmap.used(), Bitmap::<1>::CAPACITY);
            assert!(!bitmap.is_full() || bitmap.free() == 0);
            assert!(!bitmap.is_empty() || bitmap.used() == 0);
        }
    }
}
