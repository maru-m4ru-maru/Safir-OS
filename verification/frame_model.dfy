include "frame_allocator.dfy"

module FrameTrace {
  import FrameAllocatorSpec

  method Main(args: seq<string>) {
    var usedSet: set<nat> := {};
    var base: nat := 512;
    var i := 1;

    while i < |args|
      invariant FrameAllocatorSpec.ValidState(usedSet)
      decreases |args| - i
    {
      if args[i] == "A" {
        var next, index, ok := FrameAllocatorSpec.AllocateFirst(usedSet);
        if ok {
          usedSet := next;
          print "A:", base + index, ":", |usedSet|, "\n";
        } else {
          print "A:FAIL:", |usedSet|, "\n";
        }
      } else if args[i] == "S3" {
        var next, ok := FrameAllocatorSpec.AllocateSpecific(usedSet, 3);
        if ok {
          usedSet := next;
          print "S3:1:", |usedSet|, "\n";
        } else {
          print "S3:0:", |usedSet|, "\n";
        }
      } else if args[i] == "S63" {
        var next, ok := FrameAllocatorSpec.AllocateSpecific(usedSet, 63);
        if ok {
          usedSet := next;
          print "S63:1:", |usedSet|, "\n";
        } else {
          print "S63:0:", |usedSet|, "\n";
        }
      } else if args[i] == "S64" {
        var next, ok := FrameAllocatorSpec.AllocateSpecific(usedSet, 64);
        if ok {
          usedSet := next;
          print "S64:1:", |usedSet|, "\n";
        } else {
          print "S64:0:", |usedSet|, "\n";
        }
      } else if args[i] == "D0" {
        var next, ok := FrameAllocatorSpec.FreeSpecific(usedSet, 0);
        if ok {
          usedSet := next;
          print "D0:1:", |usedSet|, "\n";
        } else {
          print "D0:0:", |usedSet|, "\n";
        }
      } else if args[i] == "D3" {
        var next, ok := FrameAllocatorSpec.FreeSpecific(usedSet, 3);
        if ok {
          usedSet := next;
          print "D3:1:", |usedSet|, "\n";
        } else {
          print "D3:0:", |usedSet|, "\n";
        }
      } else if args[i] == "D63" {
        var next, ok := FrameAllocatorSpec.FreeSpecific(usedSet, 63);
        if ok {
          usedSet := next;
          print "D63:1:", |usedSet|, "\n";
        } else {
          print "D63:0:", |usedSet|, "\n";
        }
      } else if args[i] == "D64" {
        var next, ok := FrameAllocatorSpec.FreeSpecific(usedSet, 64);
        if ok {
          usedSet := next;
          print "D64:1:", |usedSet|, "\n";
        } else {
          print "D64:0:", |usedSet|, "\n";
        }
      } else {
        print "UNKNOWN\n";
      }

      i := i + 1;
    }
  }
}
