include "pmm.dfy"

module PhysicalMemoryTrace {
  import PhysicalMemorySpec

  method Main(args: seq<string>) {
    var usedSet: set<nat> := {};
    var reserved: set<nat> := {};
    var i: nat := 0;

    while i < 4
      invariant PhysicalMemorySpec.ValidState(usedSet, reserved)
      decreases 4 - i
    {
      usedSet := usedSet + {i};
      reserved := reserved + {i};
      i := i + 1;
    }

    i := 16;
    while i < 64
      invariant PhysicalMemorySpec.ValidState(usedSet, reserved)
      decreases 64 - i
    {
      usedSet := usedSet + {i};
      reserved := reserved + {i};
      i := i + 1;
    }

    i := 1;

    while i < |args|
      invariant PhysicalMemorySpec.ValidState(usedSet, reserved)
      decreases |args| - i
    {
      if args[i] == "A" {
        var nextAllocated, nextReserved, index, ok :=
          PhysicalMemorySpec.AllocateFirst(usedSet, reserved);
        if ok {
          usedSet := nextAllocated;
          reserved := nextReserved;
          print "A:", index, ":", |usedSet|, ":", 64 - |usedSet|, "\n";
        } else {
          print "A:FAIL:", |usedSet|, ":", 64 - |usedSet|, "\n";
        }
      } else if args[i] == "R5" {
        var nextAllocated, nextReserved :=
          PhysicalMemorySpec.ReserveSpecific(usedSet, reserved, 5);
        usedSet := nextAllocated;
        reserved := nextReserved;
        print "R5:", |usedSet|, ":", 64 - |usedSet|, "\n";
      } else if args[i] == "R6" {
        var nextAllocated, nextReserved :=
          PhysicalMemorySpec.ReserveSpecific(usedSet, reserved, 6);
        usedSet := nextAllocated;
        reserved := nextReserved;
        print "R6:", |usedSet|, ":", 64 - |usedSet|, "\n";
      } else if args[i] == "D4" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(usedSet, reserved, 4);
        if ok {
          usedSet := nextAllocated;
          print "D4:1:", |usedSet|, ":", 64 - |usedSet|, "\n";
        } else {
          print "D4:0:", |usedSet|, ":", 64 - |usedSet|, "\n";
        }
      } else if args[i] == "D5" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(usedSet, reserved, 5);
        if ok {
          usedSet := nextAllocated;
          print "D5:1:", |usedSet|, ":", 64 - |usedSet|, "\n";
        } else {
          print "D5:0:", |usedSet|, ":", 64 - |usedSet|, "\n";
        }
      } else if args[i] == "D6" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(usedSet, reserved, 6);
        if ok {
          usedSet := nextAllocated;
          print "D6:1:", |usedSet|, ":", 64 - |usedSet|, "\n";
        } else {
          print "D6:0:", |usedSet|, ":", 64 - |usedSet|, "\n";
        }
      } else if args[i] == "D63" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(usedSet, reserved, 63);
        if ok {
          usedSet := nextAllocated;
          print "D63:1:", |usedSet|, ":", 64 - |usedSet|, "\n";
        } else {
          print "D63:0:", |usedSet|, ":", 64 - |usedSet|, "\n";
        }
      } else {
        print "UNKNOWN\n";
      }

      i := i + 1;
    }
  }
}
