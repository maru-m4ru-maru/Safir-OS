use safiros_kernel::{CpuContext, Task, TaskState};

fn task_in_state(state: TaskState) -> Task {
    let mut task = Task::new(1, CpuContext::new(0x70000, 0x11000));

    match state {
        TaskState::Ready => {}
        TaskState::Running => {
            assert!(task.transition(TaskState::Running));
        }
        TaskState::Blocked => {
            assert!(task.transition(TaskState::Running));
            assert!(task.transition(TaskState::Blocked));
        }
        TaskState::Finished => {
            assert!(task.transition(TaskState::Running));
            assert!(task.transition(TaskState::Finished));
        }
    }

    assert_eq!(task.state(), state);
    task
}

#[test]
fn task_state_transitions_cover_all_pairs() {
    let states = [
        TaskState::Ready,
        TaskState::Running,
        TaskState::Blocked,
        TaskState::Finished,
    ];

    for current in states {
        for next in states {
            let expected = matches!(
                (current, next),
                (TaskState::Ready, TaskState::Running)
                    | (TaskState::Running, TaskState::Ready)
                    | (TaskState::Running, TaskState::Blocked)
                    | (TaskState::Blocked, TaskState::Ready)
                    | (TaskState::Running, TaskState::Finished)
            );

            let mut task = task_in_state(current);
            assert_eq!(task.transition(next), expected);
            assert_eq!(
                task.state(),
                if expected { next } else { current }
            );
        }
    }
}

#[test]
fn valid_and_invalid_contexts_are_enforced() {
    let valid = CpuContext::new(0x70000, 0x11000);
    assert!(valid.is_valid());

    for invalid in [
        CpuContext { rsp: 0, ..valid },
        CpuContext { rip: 0, ..valid },
        CpuContext { rflags: valid.rflags & !2, ..valid },
    ] {
        assert!(!invalid.is_valid());
    }
}

#[test]
fn task_identity_and_context_remain_stable() {
    let mut task = Task::new(42, CpuContext::new(0x70000, 0x11000));
    let replacement = CpuContext::new(0x71000, 0x12000);

    assert_eq!(task.id(), 42);
    assert_eq!(task.state(), TaskState::Ready);
    assert!(task.set_context(replacement));
    assert_eq!(task.id(), 42);
    assert_eq!(task.context(), replacement);
}
