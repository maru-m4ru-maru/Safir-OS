use safiros_kernel::{InterruptContext, Scheduler};

#[test]
fn interrupt_frame_properties_hold() {
    let valid = InterruptContext::new(0x11000, 0x18, 0x202);
    assert!(valid.is_valid());

    let invalids = [
        InterruptContext::new(0, 0x18, 0x202),
        InterruptContext::new(0x11000, 0x10, 0x202),
        InterruptContext::new(0x11000, 0x18, 0x2),
    ];

    for context in invalids {
        assert!(!context.is_valid());
    }

    assert_eq!(core::mem::size_of::<InterruptContext>(), 144);
}

#[test]
fn two_task_preemption_rotates_forever() {
    let mut scheduler = Scheduler::<2>::new();
    assert!(scheduler.enqueue(1));
    assert!(scheduler.enqueue(2));

    assert_eq!(scheduler.next(), Some(1));

    for expected in [2, 1, 2, 1, 2, 1, 2, 1, 2, 1] {
        assert_eq!(scheduler.next(), Some(expected));
    }
}
