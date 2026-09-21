use safiros_kernel::{CpuContext, Task, TaskState};

#[test]
fn differential_task_state_trace() {
    let operations = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../verification/task_vectors.txt"),
    )
    .expect("task vectors");

    let expected = std::fs::read_to_string(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../build/task_expected.txt"),
    )
    .expect("Dafny task trace");

    let expected: Vec<&str> = expected.lines().filter(|line| !line.is_empty()).collect();

    let mut task = Task::new(1, CpuContext::new(0x70000, 0x11000));
    let mut actual = Vec::new();

    for op in operations.lines().filter(|line| !line.is_empty()) {
        let next = match op {
            "W" => TaskState::Running,
            "R" => TaskState::Ready,
            "B" => TaskState::Blocked,
            "F" => TaskState::Finished,
            other => panic!("unknown task vector: {other}"),
        };

        let ok = task.transition(next);
        let state = match task.state() {
            TaskState::Ready => 0,
            TaskState::Running => 1,
            TaskState::Blocked => 2,
            TaskState::Finished => 3,
        };

        actual.push(format!("{op}:{0}:{state}", ok as u8));
    }

    assert_eq!(actual, expected);
}
