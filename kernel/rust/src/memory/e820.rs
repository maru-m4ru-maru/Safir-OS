#[repr(C)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct E820Entry {
    pub base: u64,
    pub length: u64,
    pub kind: u32,
    pub attrs: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MemoryRegion {
    pub base: u64,
    pub length: u64,
    pub kind: u32,
    pub attrs: u32,
}

impl MemoryRegion {
    pub const fn end(self) -> Option<u64> {
        self.base.checked_add(self.length)
    }

    pub const fn is_usable(self) -> bool {
        self.kind == 1
    }
}

pub struct MemoryMap<const N: usize> {
    regions: [MemoryRegion; N],
    len: usize,
}

impl<const N: usize> MemoryMap<N> {
    pub const fn new() -> Self {
        Self {
            regions: [MemoryRegion {
                base: 0,
                length: 0,
                kind: 0,
                attrs: 0,
            }; N],
            len: 0,
        }
    }

    pub fn from_entries(entries: &[E820Entry]) -> Self {
        let mut map = Self::new();

        for entry in entries {
            if entry.length == 0 || entry.base.checked_add(entry.length).is_none() {
                continue;
            }

            if !map.push(MemoryRegion {
                base: entry.base,
                length: entry.length,
                kind: entry.kind,
                attrs: entry.attrs,
            }) {
                break;
            }
        }

        map
    }

    pub unsafe fn from_raw(ptr: *const E820Entry, len: usize) -> Self {
        let entries = core::slice::from_raw_parts(ptr, len);
        Self::from_entries(entries)
    }

    pub fn push(&mut self, region: MemoryRegion) -> bool {
        if self.len == N {
            return false;
        }

        self.regions[self.len] = region;
        self.len += 1;
        true
    }

    pub const fn len(&self) -> usize {
        self.len
    }

    pub const fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn get(&self, index: usize) -> Option<MemoryRegion> {
        if index < self.len {
            Some(self.regions[index])
        } else {
            None
        }
    }

    pub fn usable_regions(&self) -> impl Iterator<Item = MemoryRegion> + '_ {
        self.regions[..self.len]
            .iter()
            .copied()
            .filter(|region| region.is_usable())
    }

    pub fn usable_region_count(&self) -> usize {
        self.usable_regions().count()
    }
}

#[cfg(test)]
mod tests {
    use super::{E820Entry, MemoryMap};

    #[test]
    fn parses_valid_entries() {
        let entries = [
            E820Entry {
                base: 0,
                length: 0x9FC00,
                kind: 1,
                attrs: 1,
            },
            E820Entry {
                base: 0x9FC00,
                length: 0x400,
                kind: 2,
                attrs: 1,
            },
        ];

        let map = MemoryMap::<4>::from_entries(&entries);

        assert_eq!(map.len(), 2);
        assert_eq!(map.usable_region_count(), 1);
        assert_eq!(map.get(0).unwrap().base, 0);
        assert_eq!(map.get(1).unwrap().kind, 2);
    }

    #[test]
    fn rejects_invalid_ranges() {
        let entries = [
            E820Entry {
                base: 0x1000,
                length: 0,
                kind: 1,
                attrs: 1,
            },
            E820Entry {
                base: u64::MAX - 0x100,
                length: 0x200,
                kind: 1,
                attrs: 1,
            },
        ];

        let map = MemoryMap::<4>::from_entries(&entries);

        assert!(map.is_empty());
    }

    #[test]
    fn respects_capacity() {
        let entries = [
            E820Entry { base: 0, length: 1, kind: 1, attrs: 1 },
            E820Entry { base: 2, length: 1, kind: 1, attrs: 1 },
            E820Entry { base: 4, length: 1, kind: 1, attrs: 1 },
        ];

        let map = MemoryMap::<2>::from_entries(&entries);

        assert_eq!(map.len(), 2);
        assert_eq!(map.usable_region_count(), 2);
    }
}
