include "pmm.dfy"

module PhysicalMemoryTrace {
  import PhysicalMemorySpec

  method Main(args: seq<string>) {
    var allocated: set<nat> := {};
    var reserved: set<nat> := {};
    var i: nat := 0;

    while i < 4
      invariant PhysicalMemorySpec.ValidState(allocated, reserved)
      decreases 4 - i
    {
      allocated := allocated + {i};
      reserved := reserved + {i};
      i := i + 1;
    }

    i := 16;
    while i < 64
      invariant PhysicalMemorySpec.ValidState(allocated, reserved)
      decreases 64 - i
    {
      allocated := allocated + {i};
      reserved := reserved + {i};
      i := i + 1;
    }

    i := 1;

    while i < |args|
      invariant PhysicalMemorySpec.ValidState(allocated, reserved)
      decreases |args| - i
    {
      if args[i] == "A" {
        var nextAllocated, nextReserved, index, ok :=
          PhysicalMemorySpec.AllocateFirst(allocated, reserved);
        if ok {
          allocated := nextAllocated;
          reserved := nextReserved;
          print "A:", index, ":", |allocated|, ":", 64 - |allocated|, "\n";
        } else {
          print "A:FAIL:", |allocated|, ":", 64 - |allocated|, "\n";
        }
      } else if args[i] == "R5" {
        var nextAllocated, nextReserved :=
          PhysicalMemorySpec.ReserveSpecific(allocated, reserved, 5);
        allocated := nextAllocated;
        reserved := nextReserved;
        print "R5:", |allocated|, ":", 64 - |allocated|, "\n";
      } else if args[i] == "R6" {
        var nextAllocated, nextReserved :=
          PhysicalMemorySpec.ReserveSpecific(allocated, reserved, 6);
        allocated := nextAllocated;
        reserved := nextReserved;
        print "R6:", |allocated|, ":", 64 - |allocated|, "\n";
      } else if args[i] == "D4" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(allocated, reserved, 4);
        if ok {
          allocated := nextAllocated;
          print "D4:1:", |allocated|, ":", 64 - |allocated|, "\n";
        } else {
          print "D4:0:", |allocated|, ":", 64 - |allocated|, "\n";
        }
      } else if args[i] == "D5" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(allocated, reserved, 5);
        if ok {
          allocated := nextAllocated;
          print "D5:1:", |allocated|, ":", 64 - |allocated|, "\n";
        } else {
          print "D5:0:", |allocated|, ":", 64 - |allocated|, "\n";
        }
      } else if args[i] == "D6" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(allocated, reserved, 6);
        if ok {
          allocated := nextAllocated;
          print "D6:1:", |allocated|, ":", 64 - |allocated|, "\n";
        } else {
          print "D6:0:", |allocated|, ":", 64 - |allocated|, "\n";
        }
      } else if args[i] == "D63" {
        var nextAllocated, ok :=
          PhysicalMemorySpec.Deallocate(allocated, reserved, 63);
        if ok {
          allocated := nextAllocated;
          print "D63:1:", |allocated|, ":", 64 - |allocated|, "\n";
        } else {
          print "D63:0:", |allocated|, ":", 64 - |allocated|, "\n";
        }
      } else {
        print "UNKNOWN\n";
      }

      i := i + 1;
    }
  }
}
