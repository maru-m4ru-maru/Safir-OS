use super::Bitmap;

pub const PAGE_SIZE: u64 = 4096;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PhysFrame(u64);

impl PhysFrame {
    pub const fn containing_address(address: u64) -> Self {
        Self(address / PAGE_SIZE)
    }

    pub const fn number(self) -> u64 {
        self.0
    }

    pub const fn start_address(self) -> u64 {
        self.0 * PAGE_SIZE
    }
}

pub struct FrameAllocator<const WORDS: usize> {
    base: PhysFrame,
    bitmap: Bitmap<WORDS>,
}

impl<const WORDS: usize> FrameAllocator<WORDS> {
    pub const fn new(base: PhysFrame) -> Self {
        Self {
            base,
            bitmap: Bitmap::new(),
        }
    }

    pub const fn capacity(&self) -> usize {
        Bitmap::<WORDS>::CAPACITY
    }

    pub const fn allocated(&self) -> usize {
        self.bitmap.used()
    }

    pub const fn free(&self) -> usize {
        self.bitmap.free()
    }

    pub fn allocate(&mut self) -> Option<PhysFrame> {
        self.bitmap
            .allocate()
            .map(|index| PhysFrame(self.base.number() + index as u64))
    }

    pub fn allocate_specific(&mut self, frame: PhysFrame) -> bool {
        match self.index_of(frame) {
            Some(index) => self.bitmap.allocate_specific(index),
            None => false,
        }
    }

    pub fn deallocate(&mut self, frame: PhysFrame) -> bool {
        match self.index_of(frame) {
            Some(index) => self.bitmap.free_index(index),
            None => false,
        }
    }

    pub fn is_allocated(&self, frame: PhysFrame) -> Option<bool> {
        self.index_of(frame)
            .and_then(|index| self.bitmap.is_allocated(index))
    }

    fn index_of(&self, frame: PhysFrame) -> Option<usize> {
        let index = frame.number().checked_sub(self.base.number())?;
        usize::try_from(index)
            .ok()
            .filter(|&index| index < Bitmap::<WORDS>::CAPACITY)
    }
}

#[cfg(test)]
mod tests {
    use super::{FrameAllocator, PhysFrame, PAGE_SIZE};

    #[test]
    fn frame_round_trip() {
        let frame = PhysFrame::containing_address(0x12345);
        assert_eq!(frame.number(), 0x12);
        assert_eq!(frame.start_address(), 0x12000);
    }

    #[test]
    fn allocator_returns_contiguous_frames() {
        let base = PhysFrame::containing_address(0x200000);
        let mut allocator = FrameAllocator::<1>::new(base);

        let a = allocator.allocate();
        let b = allocator.allocate();

        assert_eq!(a, Some(base));
        assert_eq!(b, Some(PhysFrame::containing_address(0x201000)));
        assert_eq!(allocator.allocated(), 2);
        assert_eq!(allocator.free(), 62);
    }

    #[test]
    fn deallocate_reuses_frame() {
        let base = PhysFrame::containing_address(0x300000);
        let mut allocator = FrameAllocator::<1>::new(base);

        let frame = allocator.allocate().unwrap();
        assert!(allocator.deallocate(frame));
        assert_eq!(allocator.allocate(), Some(frame));
    }

    #[test]
    fn rejects_frame_outside_range() {
        let base = PhysFrame::containing_address(0x400000);
        let mut allocator = FrameAllocator::<1>::new(base);
        let before = allocator.allocated();

        let outside = PhysFrame::containing_address(0x500000);
        assert!(!allocator.deallocate(outside));
        assert_eq!(allocator.is_allocated(outside), None);
        assert_eq!(allocator.allocated(), before);
    }

    #[test]
    fn specific_allocation_is_idempotently_rejected() {
        let base = PhysFrame::containing_address(0x600000);
        let mut allocator = FrameAllocator::<1>::new(base);

        let frame = PhysFrame::containing_address(0x603000);
        assert!(allocator.allocate_specific(frame));
        assert!(!allocator.allocate_specific(frame));
        assert_eq!(allocator.allocated(), 1);
    }

    #[test]
    fn page_size_is_4kib() {
        assert_eq!(PAGE_SIZE, 4096);
    }
}
