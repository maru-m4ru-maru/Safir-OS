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
      var next: nat := 0;
      if args[i] == "W" {
        next := 1;
      } else if args[i] == "R" {
        next := 0;
      } else if args[i] == "B" {
        next := 2;
      } else if args[i] == "F" {
        next := 3;
      } else {
        print "UNKNOWN
";
        i := i + 1;
        continue;
      }

      var result, ok := TaskSpec.Transition(state, next);
      state := result;
      print args[i], ":", if ok then "1" else "0", ":", state, "
";
      i := i + 1;
    }
  }
}
