module TaskSpec {

predicate ValidState(state: nat)
{
  state < 4
}

predicate ValidContext(rsp: nat, rip: nat, rflags: nat)
{
  rsp != 0 &&
  rip != 0 &&
  rflags % 4 >= 2
}

predicate CanTransition(current: nat, next: nat)
{
  (current == 0 && next == 1) ||
  (current == 1 && next == 0) ||
  (current == 1 && next == 2) ||
  (current == 2 && next == 0) ||
  (current == 1 && next == 3)
}

method Transition(current: nat, next: nat)
  returns (result: nat, ok: bool)
  requires ValidState(current)
  requires ValidState(next)
  ensures ValidState(result)
  ensures ok <==> CanTransition(current, next)
  ensures !ok ==> result == current
  ensures ok ==> result == next
{
  if CanTransition(current, next) {
    result := next;
    ok := true;
  } else {
    result := current;
    ok := false;
  }
}

method ContextIsValid(rsp: nat, rip: nat, rflags: nat)
  returns (ok: bool)
  ensures ok <==> ValidContext(rsp, rip, rflags)
{
  ok := ValidContext(rsp, rip, rflags);
}

}
