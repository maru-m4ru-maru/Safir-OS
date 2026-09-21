use safiros_kernel::Scheduler;

#[test]
fn differential_scheduler_trace() {
    let operations = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../verification/scheduler_vectors.txt"),
    )
    .expect("scheduler vectors");

    let expected = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../build/scheduler_expected.txt"),
    )
    .expect("Dafny scheduler trace");

    let expected: Vec<&str> = expected.lines().filter(|line| !line.is_empty()).collect();

    let mut scheduler = Scheduler::<8>::new();
    let mut actual = Vec::new();

    for op in operations.lines().filter(|line| !line.is_empty()) {
        match op {
            "E1" => {
                let ok = scheduler.enqueue(1);
                actual.push(format!("E1:{}:{}", ok as u8, scheduler.len()));
            }
            "E2" => {
                let ok = scheduler.enqueue(2);
                actual.push(format!("E2:{}:{}", ok as u8, scheduler.len()));
            }
            "E3" => {
                let ok = scheduler.enqueue(3);
                actual.push(format!("E3:{}:{}", ok as u8, scheduler.len()));
            }
            "E4" => {
                let ok = scheduler.enqueue(4);
                actual.push(format!("E4:{}:{}", ok as u8, scheduler.len()));
            }
            "E5" => {
                let ok = scheduler.enqueue(5);
                actual.push(format!("E5:{}:{}", ok as u8, scheduler.len()));
            }
            "E6" => {
                let ok = scheduler.enqueue(6);
                actual.push(format!("E6:{}:{}", ok as u8, scheduler.len()));
            }
            "E7" => {
                let ok = scheduler.enqueue(7);
                actual.push(format!("E7:{}:{}", ok as u8, scheduler.len()));
            }
            "E8" => {
                let ok = scheduler.enqueue(8);
                actual.push(format!("E8:{}:{}", ok as u8, scheduler.len()));
            }
            "E9" => {
                let ok = scheduler.enqueue(9);
                actual.push(format!("E9:{}:{}", ok as u8, scheduler.len()));
            }
            "P" => {
                match scheduler.peek() {
                    Some(task_id) => actual.push(format!("P:1:{}:{}", task_id, scheduler.len())),
                    None => actual.push(format!("P:0:0:{}", scheduler.len())),
                }
            }
            "D" => {
                match scheduler.dequeue() {
                    Some(task_id) => actual.push(format!("D:1:{}:{}", task_id, scheduler.len())),
                    None => actual.push(format!("D:0:0:{}", scheduler.len())),
                }
            }
            "N" => {
                match scheduler.next() {
                    Some(task_id) => actual.push(format!("N:1:{}:{}", task_id, scheduler.len())),
                    None => actual.push(format!("N:0:0:{}", scheduler.len())),
                }
            }
            other => panic!("unknown scheduler vector: {other}"),
        }
    }

    assert_eq!(actual, expected);
}
