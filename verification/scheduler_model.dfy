include "scheduler.dfy"

module SchedulerTrace {
  import SchedulerSpec

  method Main(args: seq<string>) {
    var q: seq<nat> := [];
    var i: nat := 1;

    while i < |args|
      invariant SchedulerSpec.Valid(q)
      decreases |args| - i
    {
      if args[i] == "E1" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 1);
        q := nextQ;
        print "E1:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E2" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 2);
        q := nextQ;
        print "E2:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E3" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 3);
        q := nextQ;
        print "E3:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E4" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 4);
        q := nextQ;
        print "E4:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E5" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 5);
        q := nextQ;
        print "E5:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E6" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 6);
        q := nextQ;
        print "E6:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E7" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 7);
        q := nextQ;
        print "E7:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E8" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 8);
        q := nextQ;
        print "E8:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "E9" {
        var nextQ, ok := SchedulerSpec.Enqueue(q, 9);
        q := nextQ;
        print "E9:", if ok then "1" else "0", ":", |q|, "\n";
      } else if args[i] == "D" {
        var nextQ, taskId, ok := SchedulerSpec.Dequeue(q);
        q := nextQ;
        print "D:", if ok then "1" else "0", ":", taskId, ":", |q|, "\n";
      } else if args[i] == "N" {
        var nextQ, taskId, ok := SchedulerSpec.Next(q);
        q := nextQ;
        print "N:", if ok then "1" else "0", ":", taskId, ":", |q|, "\n";
      } else {
        print "UNKNOWN\n";
      }

      i := i + 1;
    }
  }
}
