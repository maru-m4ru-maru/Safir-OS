module FrameAllocatorSpec {

predicate ValidState(usedSet: set<nat>)
{
  |usedSet| <= 64 &&
  forall i: nat :: i in usedSet ==> i < 64
}

method AllocateFirst(usedSet: set<nat>)
  returns (newSet: set<nat>, index: nat, ok: bool)
  requires ValidState(usedSet)
  ensures ValidState(newSet)
  ensures ok ==> index < 64 && index !in usedSet
  ensures ok ==> newSet == usedSet + {index}
  ensures ok ==> forall j: nat :: j < index ==> j in usedSet
  ensures !ok ==> newSet == usedSet
{
  if |usedSet| == 64 {
    newSet := usedSet;
    index := 0;
    ok := false;
    return;
  }

  var i: nat := 0;

  while i < 64
    invariant i <= 64
    invariant ValidState(usedSet)
    invariant |usedSet| < 64
    invariant forall j: nat :: j < i ==> j in usedSet
    decreases 64 - i
  {
    if i !in usedSet {
      assert i < 64;
      assert |usedSet + {i}| == |usedSet| + 1;
      newSet := usedSet + {i};
      index := i;
      ok := true;
      return;
    }

    i := i + 1;
  }

  newSet := usedSet;
  index := 0;
  ok := false;
}

method AllocateSpecific(usedSet: set<nat>, index: nat)
  returns (newSet: set<nat>, ok: bool)
  requires ValidState(usedSet)
  ensures ValidState(newSet)
  ensures ok <==> index < 64 && index !in usedSet && |usedSet| < 64
  ensures !ok ==> newSet == usedSet
  ensures ok ==> newSet == usedSet + {index}
{
  if index >= 64 || index in usedSet || |usedSet| == 64 {
    newSet := usedSet;
    ok := false;
  } else {
    newSet := usedSet + {index};
    ok := true;
  }
}

method FreeSpecific(usedSet: set<nat>, index: nat)
  returns (newSet: set<nat>, ok: bool)
  requires ValidState(usedSet)
  ensures ValidState(newSet)
  ensures ok <==> index < 64 && index in usedSet
  ensures !ok ==> newSet == usedSet
  ensures ok ==> newSet == usedSet - {index}
{
  if index >= 64 || index !in usedSet {
    newSet := usedSet;
    ok := false;
  } else {
    newSet := usedSet - {index};
    ok := true;
  }
}

}
