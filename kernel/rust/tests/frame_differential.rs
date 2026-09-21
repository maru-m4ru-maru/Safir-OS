use safiros_kernel::memory::{FrameAllocator, PhysFrame};

#[test]
fn differential_frame_allocator_trace() {
    let operations = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../verification/frame_vectors.txt"),
    )
    .expect("frame vectors");

    let expected = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../build/frame_expected.txt"),
    )
    .expect("Dafny frame trace");

    let expected: Vec<&str> = expected.lines().filter(|line| !line.is_empty()).collect();

    let base = PhysFrame::containing_address(0x200000);
    let mut allocator = FrameAllocator::<1>::new(base);
    let mut actual = Vec::new();

    for op in operations.lines().filter(|line| !line.is_empty()) {
        match op {
            "A" => {
                match allocator.allocate() {
                    Some(frame) => actual.push(format!("A:{}:{}", frame.number(), allocator.allocated())),
                    None => actual.push(format!("A:FAIL:{}", allocator.allocated())),
                }
            }
            "S3" => {
                let ok = allocator.allocate_specific(
                    PhysFrame::containing_address(0x200000 + 3 * 4096),
                );
                actual.push(format!("S3:{}:{}", ok as u8, allocator.allocated()));
            }
            "S63" => {
                let ok = allocator.allocate_specific(
                    PhysFrame::containing_address(0x200000 + 63 * 4096),
                );
                actual.push(format!("S63:{}:{}", ok as u8, allocator.allocated()));
            }
            "S64" => {
                let ok = allocator.allocate_specific(
                    PhysFrame::containing_address(0x200000 + 64 * 4096),
                );
                actual.push(format!("S64:{}:{}", ok as u8, allocator.allocated()));
            }
            "D0" => {
                let ok = allocator.deallocate(
                    PhysFrame::containing_address(0x200000),
                );
                actual.push(format!("D0:{}:{}", ok as u8, allocator.allocated()));
            }
            "D3" => {
                let ok = allocator.deallocate(
                    PhysFrame::containing_address(0x200000 + 3 * 4096),
                );
                actual.push(format!("D3:{}:{}", ok as u8, allocator.allocated()));
            }
            "D63" => {
                let ok = allocator.deallocate(
                    PhysFrame::containing_address(0x200000 + 63 * 4096),
                );
                actual.push(format!("D63:{}:{}", ok as u8, allocator.allocated()));
            }
            "D64" => {
                let ok = allocator.deallocate(
                    PhysFrame::containing_address(0x200000 + 64 * 4096),
                );
                actual.push(format!("D64:{}:{}", ok as u8, allocator.allocated()));
            }
            other => panic!("unknown frame vector: {other}"),
        }
    }

    assert_eq!(actual, expected);
}
