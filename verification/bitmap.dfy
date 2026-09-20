module BitmapSpec {

predicate ValidState(usedSet: set<nat>)
{
  |usedSet| <= 128 &&
  forall i: nat :: i in usedSet ==> i < 128
}

method AllocateSpecific(usedSet: set<nat>, index: nat)
  returns (newSet: set<nat>, ok: bool)
  requires ValidState(usedSet)
  ensures ValidState(newSet)
  ensures ok <==> index < 128 && index !in usedSet && |usedSet| < 128
  ensures !ok ==> newSet == usedSet
  ensures ok ==> newSet == usedSet + {index}
  ensures ok ==> |newSet| == |usedSet| + 1
{
  if index >= 128 || index in usedSet || |usedSet| == 128 {
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
  ensures ok <==> index < 128 && index in usedSet
  ensures !ok ==> newSet == usedSet
  ensures ok ==> newSet == usedSet - {index}
  ensures ok ==> |newSet| + 1 == |usedSet|
{
  if index >= 128 || index !in usedSet {
    newSet := usedSet;
    ok := false;
  } else {
    newSet := usedSet - {index};
    ok := true;
  }
}

lemma AllocationIsUnique(usedSet: set<nat>, index: nat)
  requires ValidState(usedSet)
  requires index < 128
  ensures index in usedSet ==> (usedSet + {index}) == usedSet
  ensures index !in usedSet ==> |usedSet + {index}| == |usedSet| + 1
{
}

method AllocateThenFree(usedSet: set<nat>, index: nat)
  returns (restored: set<nat>)
  requires ValidState(usedSet)
  requires |usedSet| < 128
  requires index < 128
  requires index !in usedSet
  ensures restored == usedSet
{
  var changed, ok := AllocateSpecific(usedSet, index);
  assert ok;
  var back, freed := FreeSpecific(changed, index);
  assert freed;
  restored := back;
}

}
