module PhysicalMemorySpec {

predicate ValidSet(s: set<nat>)
{
  forall i: nat :: i in s ==> i < 64
}

predicate ValidState(allocated: set<nat>, reserved: set<nat>)
{
  ValidSet(allocated) &&
  ValidSet(reserved) &&
  forall i: nat :: i in reserved ==> i in allocated
}

method AllocateFirst(allocated: set<nat>, reserved: set<nat>)
  returns (newAllocated: set<nat>, newReserved: set<nat>, index: nat, ok: bool)
  requires ValidState(allocated, reserved)
  ensures ValidState(newAllocated, newReserved)
  ensures ok ==> index < 64
  ensures ok ==> index !in allocated
  ensures ok ==> index !in reserved
  ensures ok ==> newAllocated == allocated + {index}
  ensures ok ==> newReserved == reserved
  ensures ok ==> forall j: nat :: j < index ==> j in allocated || j in reserved
  ensures !ok ==> newAllocated == allocated
  ensures !ok ==> newReserved == reserved
{
  if |allocated| == 64 {
    newAllocated := allocated;
    newReserved := reserved;
    index := 0;
    ok := false;
    return;
  }

  var i: nat := 0;

  while i < 64
    invariant i <= 64
    invariant ValidState(allocated, reserved)
    invariant |allocated| < 64
    invariant forall j: nat :: j < i ==> j in allocated || j in reserved
    decreases 64 - i
  {
    if i !in allocated && i !in reserved {
      assert i < 64;
      newAllocated := allocated + {i};
      newReserved := reserved;
      index := i;
      ok := true;
      return;
    }

    i := i + 1;
  }

  newAllocated := allocated;
  newReserved := reserved;
  index := 0;
  ok := false;
}

method ReserveSpecific(allocated: set<nat>, reserved: set<nat>, index: nat)
  returns (newAllocated: set<nat>, newReserved: set<nat>)
  requires ValidState(allocated, reserved)
  ensures ValidState(newAllocated, newReserved)
  ensures index >= 64 ==> newAllocated == allocated
  ensures index >= 64 ==> newReserved == reserved
  ensures index < 64 ==> newAllocated == allocated + {index}
  ensures index < 64 ==> newReserved == reserved + {index}
{
  if index >= 64 {
    newAllocated := allocated;
    newReserved := reserved;
  } else {
    newAllocated := allocated + {index};
    newReserved := reserved + {index};
  }
}

method Deallocate(allocated: set<nat>, reserved: set<nat>, index: nat)
  returns (newAllocated: set<nat>, ok: bool)
  requires ValidState(allocated, reserved)
  ensures ValidState(newAllocated, reserved)
  ensures ok <==> index < 64 && index in allocated && index !in reserved
  ensures !ok ==> newAllocated == allocated
  ensures ok ==> newAllocated == allocated - {index}
{
  if index >= 64 || index !in allocated || index in reserved {
    newAllocated := allocated;
    ok := false;
  } else {
    newAllocated := allocated - {index};
    ok := true;
  }
}

}