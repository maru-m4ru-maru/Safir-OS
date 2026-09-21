use safiros_kernel::RingBuffer;

#[test]
fn differential_ring_buffer_trace() {
    let operations = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../verification/ring_buffer_vectors.txt"),
    )
    .expect("ring buffer vectors");

    let expected = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../build/ring_buffer_expected.txt"),
    )
    .expect("Dafny ring buffer trace");

    let expected: Vec<&str> = expected.lines().filter(|line| !line.is_empty()).collect();

    let mut buffer = RingBuffer::<8>::new();
    let mut actual = Vec::new();

    for op in operations.lines().filter(|line| !line.is_empty()) {
        match op {
            "P0" => {
                let ok = buffer.push(0);
                actual.push(format!("P0:{}:{}", ok as u8, buffer.len()));
            }
            "P10" => {
                let ok = buffer.push(10);
                actual.push(format!("P10:{}:{}", ok as u8, buffer.len()));
            }
            "P20" => {
                let ok = buffer.push(20);
                actual.push(format!("P20:{}:{}", ok as u8, buffer.len()));
            }
            "P30" => {
                let ok = buffer.push(30);
                actual.push(format!("P30:{}:{}", ok as u8, buffer.len()));
            }
            "P40" => {
                let ok = buffer.push(40);
                actual.push(format!("P40:{}:{}", ok as u8, buffer.len()));
            }
            "P50" => {
                let ok = buffer.push(50);
                actual.push(format!("P50:{}:{}", ok as u8, buffer.len()));
            }
            "P60" => {
                let ok = buffer.push(60);
                actual.push(format!("P60:{}:{}", ok as u8, buffer.len()));
            }
            "P70" => {
                let ok = buffer.push(70);
                actual.push(format!("P70:{}:{}", ok as u8, buffer.len()));
            }
            "P80" => {
                let ok = buffer.push(80);
                actual.push(format!("P80:{}:{}", ok as u8, buffer.len()));
            }
            "P90" => {
                let ok = buffer.push(90);
                actual.push(format!("P90:{}:{}", ok as u8, buffer.len()));
            }
            "P255" => {
                let ok = buffer.push(255);
                actual.push(format!("P255:{}:{}", ok as u8, buffer.len()));
            }
            "O" => {
                match buffer.pop() {
                    Some(value) => actual.push(format!("O:1:{}:{}", value, buffer.len())),
                    None => actual.push(format!("O:0:0:{}", buffer.len())),
                }
            }
            "K" => {
                match buffer.peek() {
                    Some(value) => actual.push(format!("K:1:{}:{}", value, buffer.len())),
                    None => actual.push(format!("K:0:0:{}", buffer.len())),
                }
            }
            other => panic!("unknown ring buffer vector: {other}"),
        }
    }

    assert_eq!(actual, expected);
}
