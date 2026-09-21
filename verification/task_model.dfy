include "task.dfy"

module TaskTrace {
  import TaskSpec

  method Main(args: seq<string>) {
    var state: nat := 0;
    var i: nat := 1;

    while i < |args|
      invariant TaskSpec.ValidState(state)
      decreases |args| - i
    {
      if args[i] == "W" {
        var nextState, ok := TaskSpec.Transition(state, 1);
        state := nextState;
        print "W:", if ok then "1" else "0", ":", state, "\n";
      } else if args[i] == "R" {
        var nextState, ok := TaskSpec.Transition(state, 0);
        state := nextState;
        print "R:", if ok then "1" else "0", ":", state, "\n";
      } else if args[i] == "B" {
        var nextState, ok := TaskSpec.Transition(state, 2);
        state := nextState;
        print "B:", if ok then "1" else "0", ":", state, "\n";
      } else if args[i] == "F" {
        var nextState, ok := TaskSpec.Transition(state, 3);
        state := nextState;
        print "F:", if ok then "1" else "0", ":", state, "\n";
      } else {
        print "UNKNOWN\n";
      }

      i := i + 1;
    }
  }
}
