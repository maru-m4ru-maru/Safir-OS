module RingBufferSpec {

predicate Valid(q: seq<nat>)
{
  |q| <= 8
}

method Push(q: seq<nat>, value: nat)
  returns (newQ: seq<nat>, ok: bool)
  requires Valid(q)
  ensures Valid(newQ)
  ensures ok <==> |q| < 8
  ensures !ok ==> newQ == q
  ensures ok ==> newQ == q + [value]
{
  if |q| == 8 {
    newQ := q;
    ok := false;
  } else {
    newQ := q + [value];
    ok := true;
  }
}

method Pop(q: seq<nat>)
  returns (newQ: seq<nat>, value: nat, ok: bool)
  requires Valid(q)
  ensures Valid(newQ)
  ensures ok <==> |q| > 0
  ensures !ok ==> newQ == q
  ensures !ok ==> value == 0
  ensures ok ==> newQ == q[1..]
  ensures ok ==> value == q[0]
{
  if |q| == 0 {
    newQ := q;
    value := 0;
    ok := false;
  } else {
    newQ := q[1..];
    value := q[0];
    ok := true;
  }
}

method Peek(q: seq<nat>)
  returns (value: nat, ok: bool)
  requires Valid(q)
  ensures ok <==> |q| > 0
  ensures !ok ==> value == 0
  ensures ok ==> value == q[0]
{
  if |q| == 0 {
    value := 0;
    ok := false;
  } else {
    value := q[0];
    ok := true;
  }
}

}
