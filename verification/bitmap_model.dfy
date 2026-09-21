include "bitmap.dfy"

module BitmapTrace {
  import BitmapSpec

  method Main(args: seq<string>) {
    var usedSet: set<nat> := {};
    var i := 1;

    while i < |args|
      invariant ValidState(usedSet)
      decreases |args| - i
    {
      if args[i] == "S0" {
        var next, ok := BitmapSpec.AllocateSpecific(usedSet, 0);
        if ok {
          usedSet := next;
          print "S0:1:", |usedSet|, "\n";
        } else {
          print "S0:0:", |usedSet|, "\n";
        }
      } else if args[i] == "S63" {
        var next, ok := BitmapSpec.AllocateSpecific(usedSet, 63);
        if ok {
          usedSet := next;
          print "S63:1:", |usedSet|, "\n";
        } else {
          print "S63:0:", |usedSet|, "\n";
        }
      } else if args[i] == "F0" {
        var next, ok := BitmapSpec.FreeSpecific(usedSet, 0);
        if ok {
          usedSet := next;
          print "F0:1:", |usedSet|, "\n";
        } else {
          print "F0:0:", |usedSet|, "\n";
        }
      } else if args[i] == "F63" {
        var next, ok := BitmapSpec.FreeSpecific(usedSet, 63);
        if ok {
          usedSet := next;
          print "F63:1:", |usedSet|, "\n";
        } else {
          print "F63:0:", |usedSet|, "\n";
        }
      } else {
        print "UNKNOWN\n";
      }

      i := i + 1;
    }
  }
}
