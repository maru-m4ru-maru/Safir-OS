use safiros_kernel::memory::{E820Entry, MemoryMap, PhysicalMemoryManager, PhysFrame};

#[test]
fn differential_pmm_trace() {
    let operations = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../verification/pmm_vectors.txt"),
    )
    .expect("pmm vectors");

    let expected = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../build/pmm_expected.txt"),
    )
    .expect("Dafny PMM trace");

    let expected: Vec<&str> = expected.lines().filter(|line| !line.is_empty()).collect();

    let entries = [
        E820Entry {
            base: 0,
            length: 0x4000,
            kind: 2,
            attrs: 1,
        },
        E820Entry {
            base: 0x4000,
            length: 0xC000,
            kind: 1,
            attrs: 1,
        },
    ];

    let map = MemoryMap::<4>::from_entries(&entries);
    let mut manager = PhysicalMemoryManager::<1>::from_memory_map(&map);
    let mut actual = Vec::new();

    for op in operations.lines().filter(|line| !line.is_empty()) {
        match op {
            "A" => {
                match manager.allocate() {
                    Some(frame) => actual.push(format!(
                        "A:{}:{}:{}",
                        frame.number(),
                        manager.allocated_frames(),
                        manager.free_frames()
                    )),
                    None => actual.push(format!(
                        "A:FAIL:{}:{}",
                        manager.allocated_frames(),
                        manager.free_frames()
                    )),
                }
            }
            "R5" => {
                manager.reserve_range(5 * 4096, 4096);
                actual.push(format!(
                    "R5:{}:{}",
                    manager.allocated_frames(),
                    manager.free_frames()
                ));
            }
            "R6" => {
                manager.reserve_range(6 * 4096, 4096);
                actual.push(format!(
                    "R6:{}:{}",
                    manager.allocated_frames(),
                    manager.free_frames()
                ));
            }
            "D4" => {
                let ok = manager.deallocate(PhysFrame::containing_address(4 * 4096));
                actual.push(format!(
                    "D4:{}:{}:{}",
                    ok as u8,
                    manager.allocated_frames(),
                    manager.free_frames()
                ));
            }
            "D5" => {
                let ok = manager.deallocate(PhysFrame::containing_address(5 * 4096));
                actual.push(format!(
                    "D5:{}:{}:{}",
                    ok as u8,
                    manager.allocated_frames(),
                    manager.free_frames()
                ));
            }
            "D6" => {
                let ok = manager.deallocate(PhysFrame::containing_address(6 * 4096));
                actual.push(format!(
                    "D6:{}:{}:{}",
                    ok as u8,
                    manager.allocated_frames(),
                    manager.free_frames()
                ));
            }
            "D63" => {
                let ok = manager.deallocate(PhysFrame::containing_address(63 * 4096));
                actual.push(format!(
                    "D63:{}:{}:{}",
                    ok as u8,
                    manager.allocated_frames(),
                    manager.free_frames()
                ));
            }
            other => panic!("unknown PMM vector: {other}"),
        }
    }

    assert_eq!(actual, expected);
}
