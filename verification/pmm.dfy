module PhysicalMemorySpec {

predicate ValidSet(s: set<nat>)
{
  forall i: nat :: i in s ==> i < 64
}

predicate ValidState(usedSet: set<nat>, reserved: set<nat>)
{
  ValidSet(usedSet) &&
  ValidSet(reserved) &&
  forall i: nat :: i in reserved ==> i in usedSet
}

method AllocateFirst(usedSet: set<nat>, reserved: set<nat>)
  returns (newAllocated: set<nat>, newReserved: set<nat>, index: nat, ok: bool)
  requires ValidState(usedSet, reserved)
  ensures ValidState(newAllocated, newReserved)
  ensures ok ==> index < 64
  ensures ok ==> index !in usedSet
  ensures ok ==> index !in reserved
  ensures ok ==> newAllocated == usedSet + {index}
  ensures ok ==> newReserved == reserved
  ensures ok ==> forall j: nat :: j < index ==> j in usedSet || j in reserved
  ensures !ok ==> newAllocated == usedSet
  ensures !ok ==> newReserved == reserved
{
  if |usedSet| == 64 {
    newAllocated := usedSet;
    newReserved := reserved;
    index := 0;
    ok := false;
    return;
  }

  var i: nat := 0;

  while i < 64
    invariant i <= 64
    invariant ValidState(usedSet, reserved)
    invariant forall j: nat :: j < i ==> j in usedSet || j in reserved
    decreases 64 - i
  {
    if i !in usedSet && i !in reserved {
      assert i < 64;
      newAllocated := usedSet + {i};
      newReserved := reserved;
      index := i;
      ok := true;
      return;
    }

    i := i + 1;
  }

  newAllocated := usedSet;
  newReserved := reserved;
  index := 0;
  ok := false;
}

method ReserveSpecific(usedSet: set<nat>, reserved: set<nat>, index: nat)
  returns (newAllocated: set<nat>, newReserved: set<nat>)
  requires ValidState(usedSet, reserved)
  ensures ValidState(newAllocated, newReserved)
  ensures index >= 64 ==> newAllocated == usedSet
  ensures index >= 64 ==> newReserved == reserved
  ensures index < 64 ==> newAllocated == usedSet + {index}
  ensures index < 64 ==> newReserved == reserved + {index}
{
  if index >= 64 {
    newAllocated := usedSet;
    newReserved := reserved;
  } else {
    newAllocated := usedSet + {index};
    newReserved := reserved + {index};
  }
}

method Deallocate(usedSet: set<nat>, reserved: set<nat>, index: nat)
  returns (newAllocated: set<nat>, ok: bool)
  requires ValidState(usedSet, reserved)
  ensures ValidState(newAllocated, reserved)
  ensures ok <==> index < 64 && index in usedSet && index !in reserved
  ensures !ok ==> newAllocated == usedSet
  ensures ok ==> newAllocated == usedSet - {index}
{
  if index >= 64 || index !in usedSet || index in reserved {
    newAllocated := usedSet;
    ok := false;
  } else {
    newAllocated := usedSet - {index};
    ok := true;
  }
}

}