include "ring_buffer.dfy"

module RingBufferTrace {
  import RingBufferSpec

  method Main(args: seq<string>) {
    var q: seq<nat> := [];
    var i: nat := 1;

    while i < |args|
      invariant RingBufferSpec.Valid(q)
      decreases |args| - i
    {
      if args[i] == "P0" {
        var nextQ, ok := RingBufferSpec.Push(q, 0);
        q := nextQ;
        print "P0:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P10" {
        var nextQ, ok := RingBufferSpec.Push(q, 10);
        q := nextQ;
        print "P10:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P20" {
        var nextQ, ok := RingBufferSpec.Push(q, 20);
        q := nextQ;
        print "P20:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P30" {
        var nextQ, ok := RingBufferSpec.Push(q, 30);
        q := nextQ;
        print "P30:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P40" {
        var nextQ, ok := RingBufferSpec.Push(q, 40);
        q := nextQ;
        print "P40:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P50" {
        var nextQ, ok := RingBufferSpec.Push(q, 50);
        q := nextQ;
        print "P50:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P60" {
        var nextQ, ok := RingBufferSpec.Push(q, 60);
        q := nextQ;
        print "P60:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P70" {
        var nextQ, ok := RingBufferSpec.Push(q, 70);
        q := nextQ;
        print "P70:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P80" {
        var nextQ, ok := RingBufferSpec.Push(q, 80);
        q := nextQ;
        print "P80:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P90" {
        var nextQ, ok := RingBufferSpec.Push(q, 90);
        q := nextQ;
        print "P90:", ok as int, ":", |q|, "\n";
      } else if args[i] == "P255" {
        var nextQ, ok := RingBufferSpec.Push(q, 255);
        q := nextQ;
        print "P255:", ok as int, ":", |q|, "\n";
      } else if args[i] == "O" {
        var nextQ, value, ok := RingBufferSpec.Pop(q);
        q := nextQ;
        print "O:", ok as int, ":", value, ":", |q|, "\n";
      } else if args[i] == "K" {
        var value, ok := RingBufferSpec.Peek(q);
        print "K:", ok as int, ":", value, ":", |q|, "\n";
      } else {
        print "UNKNOWN\n";
      }

      i := i + 1;
    }
  }
}
