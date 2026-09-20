module BitmapSpec {

predicate ValidState(allocated: set<nat>)
{
  |allocated| <= 128 &&
  forall i: nat :: i in allocated ==> i < 128
}

method AllocateSpecific(allocated: set<nat>, index: nat)
  returns (newAllocated: set<nat>, ok: bool)
  requires ValidState(allocated)
  ensures ValidState(newAllocated)
  ensures ok <==> index < 128 && index !in allocated && |allocated| < 128
  ensures !ok ==> newAllocated == allocated
  ensures ok ==> newAllocated == allocated + {index}
  ensures ok ==> |newAllocated| == |allocated| + 1
{
  if index >= 128 || index in allocated || |allocated| == 128 {
    newAllocated := allocated;
    ok := false;
  } else {
    newAllocated := allocated + {index};
    ok := true;
  }
}

method FreeSpecific(allocated: set<nat>, index: nat)
  returns (newAllocated: set<nat>, ok: bool)
  requires ValidState(allocated)
  ensures ValidState(newAllocated)
  ensures ok <==> index < 128 && index in allocated
  ensures !ok ==> newAllocated == allocated
  ensures ok ==> newAllocated == allocated - {index}
  ensures ok ==> |newAllocated| + 1 == |allocated|
{
  if index >= 128 || index !in allocated {
    newAllocated := allocated;
    ok := false;
  } else {
    newAllocated := allocated - {index};
    ok := true;
  }
}

lemma AllocationIsUnique(allocated: set<nat>, index: nat)
  requires ValidState(allocated)
  requires index < 128
  ensures index in allocated ==> (allocated + {index}) == allocated
  ensures index !in allocated ==> |allocated + {index}| == |allocated| + 1
{
}

method AllocateThenFree(allocated: set<nat>, index: nat)
  returns (restored: set<nat>)
  requires ValidState(allocated)
  requires |allocated| < 128
  requires index < 128
  requires index !in allocated
  ensures restored == allocated
{
  var changed, ok := AllocateSpecific(allocated, index);
  assert ok;
  var back, freed := FreeSpecific(changed, index);
  assert freed;
  restored := back;
}

}
