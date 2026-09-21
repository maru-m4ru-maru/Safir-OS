use safiros_kernel::Scheduler;
use std::collections::VecDeque;

fn next_random(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1442695040888963407);
    *state
}

fn check_capacity<const N: usize>() {
    for case_id in 0..512u64 {
        let mut state = case_id.wrapping_add(1);
        let mut scheduler = Scheduler::<N>::new();
        let mut model = VecDeque::<u64>::new();

        for _ in 0..128 {
            match next_random(&mut state) % 3 {
                0 => {
                    let task_id = next_random(&mut state);
                    let expected = if model.len() < N {
                        model.push_back(task_id);
                        true
                    } else {
                        false
                    };

                    assert_eq!(scheduler.enqueue(task_id), expected);
                }
                1 => {
                    let expected = model.pop_front();
                    assert_eq!(scheduler.dequeue(), expected);
                }
                _ => {
                    let expected = match model.pop_front() {
                        Some(task_id) => {
                            model.push_back(task_id);
                            Some(task_id)
                        }
                        None => None,
                    };
                    assert_eq!(scheduler.next(), expected);
                }
            }

            assert_eq!(scheduler.len(), model.len());
            assert_eq!(scheduler.free(), N - model.len());
            assert_eq!(scheduler.is_empty(), model.is_empty());
            assert_eq!(scheduler.is_full(), model.len() == N);

            let snapshot = model.iter().copied().collect::<Vec<_>>();
            let mut actual = Vec::with_capacity(scheduler.len());
            while let Some(task_id) = scheduler.dequeue() {
                actual.push(task_id);
            }

            assert_eq!(actual, snapshot);

            for task_id in snapshot {
                assert!(scheduler.enqueue(task_id));
            }
        }
    }
}

#[test]
fn scheduler_property_model_check() {
    check_capacity::<1>();
    check_capacity::<3>();
    check_capacity::<7>();
    check_capacity::<16>();
}
