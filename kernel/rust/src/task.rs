#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TaskState {
    Ready = 0,
    Running = 1,
    Blocked = 2,
    Finished = 3,
}

impl TaskState {
    pub const fn is_runnable(self) -> bool {
        matches!(self, Self::Ready | Self::Running)
    }

    pub const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Ready, Self::Running)
                | (Self::Running, Self::Ready)
                | (Self::Running, Self::Blocked)
                | (Self::Blocked, Self::Ready)
                | (Self::Running, Self::Finished)
        )
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CpuContext {
    pub r15: u64,
    pub r14: u64,
    pub r13: u64,
    pub r12: u64,
    pub rbx: u64,
    pub rbp: u64,
    pub rsp: u64,
    pub rip: u64,
    pub rflags: u64,
}

impl CpuContext {
    pub const fn new(rsp: u64, rip: u64) -> Self {
        Self {
            r15: 0,
            r14: 0,
            r13: 0,
            r12: 0,
            rbx: 0,
            rbp: 0,
            rsp,
            rip,
            rflags: 0x202,
        }
    }

    pub const fn is_valid(self) -> bool {
        self.rip != 0 && self.rsp != 0 && (self.rflags & 0x2) != 0
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Task {
    id: u64,
    state: TaskState,
    context: CpuContext,
}

impl Task {
    pub const fn new(id: u64, context: CpuContext) -> Self {
        Self {
            id,
            state: TaskState::Ready,
            context,
        }
    }

    pub const fn id(self) -> u64 {
        self.id
    }

    pub const fn state(self) -> TaskState {
        self.state
    }

    pub const fn context(self) -> CpuContext {
        self.context
    }

    pub fn transition(&mut self, next: TaskState) -> bool {
        if !self.state.can_transition_to(next) {
            return false;
        }

        self.state = next;
        true
    }

    pub fn set_context(&mut self, context: CpuContext) -> bool {
        if !context.is_valid() {
            return false;
        }

        self.context = context;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::{CpuContext, Task, TaskState};

    #[test]
    fn new_task_is_ready() {
        let context = CpuContext::new(0x70000, 0x11000);
        let task = Task::new(1, context);

        assert_eq!(task.id(), 1);
        assert_eq!(task.state(), TaskState::Ready);
        assert_eq!(task.context(), context);
        assert!(context.is_valid());
    }

    #[test]
    fn valid_context_requires_rip_rsp_and_rflags_bit() {
        assert!(CpuContext::new(1, 1).is_valid());
        assert!(!CpuContext::new(0, 1).is_valid());
        assert!(!CpuContext::new(1, 0).is_valid());

        let invalid_flags = CpuContext {
            rflags: 0,
            ..CpuContext::new(1, 1)
        };
        assert!(!invalid_flags.is_valid());
    }

    #[test]
    fn legal_task_transitions_are_enforced() {
        let mut task = Task::new(1, CpuContext::new(1, 1));

        assert!(task.transition(TaskState::Running));
        assert_eq!(task.state(), TaskState::Running);

        assert!(task.transition(TaskState::Blocked));
        assert_eq!(task.state(), TaskState::Blocked);

        assert!(!task.transition(TaskState::Finished));
        assert_eq!(task.state(), TaskState::Blocked);

        assert!(task.transition(TaskState::Ready));
        assert!(task.transition(TaskState::Running));
        assert!(task.transition(TaskState::Finished));
        assert_eq!(task.state(), TaskState::Finished);
    }

    #[test]
    fn finished_task_cannot_transition() {
        let mut task = Task::new(1, CpuContext::new(1, 1));
        assert!(task.transition(TaskState::Running));
        assert!(task.transition(TaskState::Finished));

        assert!(!task.transition(TaskState::Ready));
        assert!(!task.transition(TaskState::Running));
        assert!(!task.transition(TaskState::Blocked));
        assert_eq!(task.state(), TaskState::Finished);
    }

    #[test]
    fn invalid_context_is_rejected() {
        let mut task = Task::new(1, CpuContext::new(1, 1));
        let before = task.context();

        let invalid = CpuContext {
            rip: 0,
            ..before
        };

        assert!(!task.set_context(invalid));
        assert_eq!(task.context(), before);
    }

    #[test]
    fn runnable_states_are_ready_and_running() {
        assert!(TaskState::Ready.is_runnable());
        assert!(TaskState::Running.is_runnable());
        assert!(!TaskState::Blocked.is_runnable());
        assert!(!TaskState::Finished.is_runnable());
    }
}
