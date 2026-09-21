module SchedulerSpec {

predicate Valid(q: seq<nat>)
{
  |q| <= 8
}

method Enqueue(q: seq<nat>, taskId: nat)
  returns (newQ: seq<nat>, ok: bool)
  requires Valid(q)
  ensures Valid(newQ)
  ensures ok <==> |q| < 8
  ensures !ok ==> newQ == q
  ensures ok ==> newQ == q + [taskId]
{
  if |q| == 8 {
    newQ := q;
    ok := false;
  } else {
    newQ := q + [taskId];
    ok := true;
  }
}

method Dequeue(q: seq<nat>)
  returns (newQ: seq<nat>, taskId: nat, ok: bool)
  requires Valid(q)
  ensures Valid(newQ)
  ensures ok <==> |q| > 0
  ensures !ok ==> newQ == q
  ensures !ok ==> taskId == 0
  ensures ok ==> newQ == q[1..]
  ensures ok ==> taskId == q[0]
{
  if |q| == 0 {
    newQ := q;
    taskId := 0;
    ok := false;
  } else {
    newQ := q[1..];
    taskId := q[0];
    ok := true;
  }
}

method Next(q: seq<nat>)
  returns (newQ: seq<nat>, taskId: nat, ok: bool)
  requires Valid(q)
  ensures Valid(newQ)
  ensures ok <==> |q| > 0
  ensures !ok ==> newQ == q
  ensures !ok ==> taskId == 0
  ensures ok ==> |newQ| == |q|
  ensures ok ==> taskId == q[0]
  ensures ok ==> newQ == q[1..] + [q[0]]
{
  if |q| == 0 {
    newQ := q;
    taskId := 0;
    ok := false;
  } else {
    taskId := q[0];
    newQ := q[1..] + [q[0]];
    ok := true;
  }
}

}
