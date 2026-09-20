module SafirOS.BitmapSpec

const Capacity: nat := 128

predicate ValidState(allocated: set<nat>)
{
  forall i: nat :: i in allocated ==> i < Capacity
}

method AllocateSpecific(allocated: set<nat>, index: nat)
  returns (newAllocated: set<nat>, ok: bool)
  requires ValidState(allocated)
  ensures ValidState(newAllocated)
  ensures ok <==> index < Capacity && index !in allocated
  ensures !ok ==> newAllocated == allocated
  ensures ok ==> newAllocated == allocated + {index}
  ensures ok ==> |newAllocated| == |allocated| + 1
{
  if index >= Capacity || index in allocated {
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
  ensures ok <==> index < Capacity && index in allocated
  ensures !ok ==> newAllocated == allocated
  ensures ok ==> newAllocated == allocated - {index}
  ensures ok ==> |newAllocated| + 1 == |allocated|
{
  if index >= Capacity || index !in allocated {
    newAllocated := allocated;
    ok := false;
  } else {
    newAllocated := allocated - {index};
    ok := true;
  }
}

lemma AllocationIsUnique(allocated: set<nat>, index: nat)
  requires ValidState(allocated)
  requires index < Capacity
  ensures index in allocated ==> (allocated + {index}) == allocated
  ensures index !in allocated ==> |allocated + {index}| == |allocated| + 1
{
}

lemma FreeIsUnique(allocated: set<nat>, index: nat)
  requires ValidState(allocated)
  requires index < Capacity
  ensures index in allocated ==> |allocated - {index}| + 1 == |allocated|
  ensures index !in allocated ==> allocated - {index} == allocated
{
}

lemma CapacityInvariant(allocated: set<nat>)
  requires ValidState(allocated)
  ensures |allocated| <= Capacity
{
  if |allocated| > Capacity {
    var ghostAvailable := set i: nat | i < Capacity && i !in allocated;
    assert ghostAvailable == {};
  }
}

method AllocateThenFree(allocated: set<nat>, index: nat)
  returns (restored: set<nat>)
  requires ValidState(allocated)
  requires index < Capacity
  requires index !in allocated
  ensures restored == allocated
{
  var changed, ok := AllocateSpecific(allocated, index);
  assert ok;
  var back, freed := FreeSpecific(changed, index);
  assert freed;
  restored := back;
}
