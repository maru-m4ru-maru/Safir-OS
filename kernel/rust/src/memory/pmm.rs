use super::{Bitmap, MemoryMap, PhysFrame, PAGE_SIZE};

pub struct PhysicalMemoryManager<const WORDS: usize> {
    bitmap: Bitmap<WORDS>,
    reserved: Bitmap<WORDS>,
}

impl<const WORDS: usize> PhysicalMemoryManager<WORDS> {
    pub fn from_memory_map<const N: usize>(map: &MemoryMap<N>) -> Self {
        let mut manager = Self {
            bitmap: Bitmap::new(),
            reserved: Bitmap::new(),
        };

        let capacity = manager.capacity();
        for index in 0..capacity {
            if !map.frame_is_usable(index as u64) {
                let _ = manager.bitmap.allocate_specific(index);
                let _ = manager.reserved.allocate_specific(index);
            }
        }

        manager
    }

    pub const fn capacity(&self) -> usize {
        Bitmap::<WORDS>::CAPACITY
    }

    pub const fn free_frames(&self) -> usize {
        self.bitmap.free()
    }

    pub const fn allocated_frames(&self) -> usize {
        self.bitmap.used()
    }

    pub fn allocate(&mut self) -> Option<PhysFrame> {
        self.bitmap
            .allocate()
            .map(|index| PhysFrame::containing_address(index as u64 * PAGE_SIZE))
    }

    pub fn deallocate(&mut self, frame: PhysFrame) -> bool {
        let index = usize::try_from(frame.number()).ok();
        match index {
            Some(index) if index < self.capacity() => {
                if self.reserved.is_allocated(index) == Some(true) {
                    false
                } else {
                    self.bitmap.free_index(index)
                }
            }
            _ => false,
        }
    }

    pub fn reserve_range(&mut self, base: u64, length: u64) {
        let Some(end) = base.checked_add(length) else {
            return;
        };

        if length == 0 {
            return;
        }

        let first = base / PAGE_SIZE;
        let last = end.saturating_add(PAGE_SIZE - 1) / PAGE_SIZE;
        let capacity = self.capacity() as u64;

        let start = first.min(capacity);
        let finish = last.min(capacity);

        for index in start..finish {
            if let Ok(index) = usize::try_from(index) {
                let _ = self.bitmap.allocate_specific(index);
                let _ = self.reserved.allocate_specific(index);
            }
        }
    }

    pub fn is_allocated(&self, frame: PhysFrame) -> Option<bool> {
        usize::try_from(frame.number())
            .ok()
            .filter(|&index| index < self.capacity())
            .and_then(|index| self.bitmap.is_allocated(index))
    }
}

#[cfg(test)]
mod tests {
    use super::PhysicalMemoryManager;
    use crate::memory::{E820Entry, MemoryMap, PhysFrame};

    #[test]
    fn builds_from_usable_memory_map() {
        let entries = [
            E820Entry {
                base: 0,
                length: 0x1000,
                kind: 2,
                attrs: 1,
            },
            E820Entry {
                base: 0x1000,
                length: 0x5000,
                kind: 1,
                attrs: 1,
            },
        ];

        let map = MemoryMap::<4>::from_entries(&entries);
        let manager = PhysicalMemoryManager::<1>::from_memory_map(&map);

        assert_eq!(manager.free_frames(), 5);
        assert_eq!(manager.allocated_frames(), 59);
    }

    #[test]
    fn reserves_ranges() {
        let entries = [E820Entry {
            base: 0,
            length: 0x10000,
            kind: 1,
            attrs: 1,
        }];

        let map = MemoryMap::<2>::from_entries(&entries);
        let mut manager = PhysicalMemoryManager::<1>::from_memory_map(&map);

        assert_eq!(manager.free_frames(), 16);
        manager.reserve_range(0x3000, 0x2800);

        assert_eq!(manager.free_frames(), 13);
        assert_eq!(
            manager.is_allocated(PhysFrame::containing_address(0x3000)),
            Some(true)
        );
        assert_eq!(
            manager.is_allocated(PhysFrame::containing_address(0x5000)),
            Some(true)
        );
        assert_eq!(
            manager.is_allocated(PhysFrame::containing_address(0x2000)),
            Some(false)
        );
    }

    #[test]
    fn reserved_frames_cannot_be_deallocated() {
        let entries = [E820Entry {
            base: 0,
            length: 0x10000,
            kind: 1,
            attrs: 1,
        }];

        let map = MemoryMap::<2>::from_entries(&entries);
        let mut manager = PhysicalMemoryManager::<1>::from_memory_map(&map);

        manager.reserve_range(0x3000, 0x1000);
        assert!(!manager.deallocate(PhysFrame::containing_address(0x3000)));
        assert_eq!(
            manager.is_allocated(PhysFrame::containing_address(0x3000)),
            Some(true)
        );
        assert_eq!(manager.free_frames(), 15);
    }

    #[test]
    fn allocation_uses_only_usable_frames() {
        let entries = [
            E820Entry {
                base: 0,
                length: 0x2000,
                kind: 2,
                attrs: 1,
            },
            E820Entry {
                base: 0x2000,
                length: 0x3000,
                kind: 1,
                attrs: 1,
            },
        ];

        let map = MemoryMap::<4>::from_entries(&entries);
        let mut manager = PhysicalMemoryManager::<1>::from_memory_map(&map);

        assert_eq!(
            manager.allocate(),
            Some(PhysFrame::containing_address(0x2000))
        );
        assert_eq!(
            manager.allocate(),
            Some(PhysFrame::containing_address(0x3000))
        );
        assert_eq!(
            manager.allocate(),
            Some(PhysFrame::containing_address(0x4000))
        );
        assert_eq!(manager.allocate(), None);
    }

    #[test]
    fn deallocation_releases_frame() {
        let entries = [E820Entry {
            base: 0x1000,
            length: 0x2000,
            kind: 1,
            attrs: 1,
        }];

        let map = MemoryMap::<2>::from_entries(&entries);
        let mut manager = PhysicalMemoryManager::<1>::from_memory_map(&map);

        let frame = manager.allocate().unwrap();
        assert!(manager.deallocate(frame));
        assert_eq!(manager.allocate(), Some(frame));
    }
}
