use safiros_kernel::Bitmap;

#[test]
fn differential_bitmap_trace() {
    let operations = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../../verification/bitmap_vectors.txt"),
    )
    .expect("bitmap vectors");

    let expected_path = std::env::var("BITMAP_EXPECTED")
        .expect("BITMAP_EXPECTED is required for the differential test");
    let expected = std::fs::read_to_string(expected_path)
        .expect("Dafny expected trace");

    let expected: Vec<&str> = expected.lines().filter(|line| !line.is_empty()).collect();

    let mut bitmap = Bitmap::<2>::new();
    let mut actual = Vec::new();

    for op in operations.lines().filter(|line| !line.is_empty()) {
        match op {
            "S0" => {
                let ok = bitmap.allocate_specific(0);
                actual.push(format!("S0:{}:{}", ok as u8, bitmap.used()));
            }
            "S63" => {
                let ok = bitmap.allocate_specific(63);
                actual.push(format!("S63:{}:{}", ok as u8, bitmap.used()));
            }
            "F0" => {
                let ok = bitmap.free_index(0);
                actual.push(format!("F0:{}:{}", ok as u8, bitmap.used()));
            }
            "F63" => {
                let ok = bitmap.free_index(63);
                actual.push(format!("F63:{}:{}", ok as u8, bitmap.used()));
            }
            other => panic!("unknown bitmap vector: {other}"),
        }
    }

    assert_eq!(actual, expected);
}
