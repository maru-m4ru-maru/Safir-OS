use safiros_kernel::RingBuffer;
use std::collections::VecDeque;

fn next_random(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1442695040888963407);
    *state
}

fn check_capacity<const N: usize>() {
    for case_id in 0..1024u64 {
        let mut state = case_id.wrapping_add(1);
        let mut buffer = RingBuffer::<N>::new();
        let mut model = VecDeque::<u8>::new();

        for _ in 0..128 {
            match next_random(&mut state) % 3 {
                0 => {
                    let value = (next_random(&mut state) >> 32) as u8;
                    let expected = if model.len() < N {
                        model.push_back(value);
                        true
                    } else {
                        false
                    };

                    assert_eq!(buffer.push(value), expected);
                }
                1 => {
                    let expected = model.pop_front();
                    assert_eq!(buffer.pop(), expected);
                }
                _ => {
                    assert_eq!(buffer.peek(), model.front().copied());
                }
            }

            assert_eq!(buffer.len(), model.len());
            assert_eq!(buffer.free(), N - model.len());
            assert_eq!(buffer.is_empty(), model.is_empty());
            assert_eq!(buffer.is_full(), model.len() == N);

            let snapshot = model.iter().copied().collect::<Vec<_>>();
            let mut actual = Vec::with_capacity(buffer.len());
            while let Some(value) = buffer.pop() {
                actual.push(value);
            }

            assert_eq!(actual, snapshot);
            for value in snapshot {
                assert!(buffer.push(value));
            }
        }
    }
}

#[test]
fn ring_buffer_property_model_check() {
    check_capacity::<1>();
    check_capacity::<3>();
    check_capacity::<7>();
    check_capacity::<16>();
}
