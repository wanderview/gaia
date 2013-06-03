/*====================================
  MonitorMultilevelChildVisibility
    monitors which dom nodes in a scrollable container are visible

    see examples directly below to get an idea of how to use

    generalized function and more info starts at line 83

====================================*/
'use strict';

function monitorMultilevelChildVisibility(
  container,
  scrollMargin,
  scrollDelta,
  tag,
  onscreenCallback,
  offscreenCallback
) {

  var BEFORE = -1, ON = 0, AFTER = 1;
  var liveList = container.getElementsByTagName(tag);
  var firstOnscreen;
  var lastOnscreen;
  var lastScrollTop = -1;

  onScroll();

  function position(child, screenTop, screenBottom) {
    var childTop = child.offsetTop;
    var childBottom = childTop + child.offsetHeight;
    if (childBottom < screenTop)
      return BEFORE;
    if (childTop > screenBottom)
      return AFTER;
    return ON;
  }

  function onScroll() {
    var scrollTop = container.scrollTop;
    if (lastScrollTop >= 0 && (Math.abs(scrollTop - lastScrollTop) < scrollDelta)) {
      return;
    }
    lastScrollTop = scrollTop;
    var l = liveList.length;
    var prevFirst = firstOnscreen || 0;
    var prevLast = lastOnscreen || 0;
    firstOnscreen = 0;
    lastOnscreen = 0;
    var prev = BEFORE;
    for (var i = 0; i < l ; i++) {
      var current = liveList[i];
      var screenTop = scrollTop - scrollMargin;
      var screenBottom = scrollTop + container.clientHeight + scrollMargin;
      var pos = position(current, screenTop, screenBottom);
      if (prev == BEFORE && pos == ON) {
        firstOnscreen = i;
      }

      if (prev == ON && pos == AFTER) {
        lastOnscreen = i;
      }

      var prev = pos;
    }

    if (prevFirst !== firstOnscreen || prevLast !== lastOnscreen) {
      var nextList = [firstOnscreen, lastOnscreen];
      var isFirst = (prevFirst === 0 && prevLast === 0);
      var initList = isFirst ? nextList : [prevFirst, prevLast];
      callCallbacks([prevFirst, prevLast], nextList);
    }

    if (firstOnscreen <= prevFirst || lastOnscreen >= prevLast) {
      return;
    }
  };

  container.addEventListener('scroll', onScroll);

  function callCallbacks(initList, nextList) {
    console.log("CHECKING " + initList + " TO " + nextList);
    var first = nextList[0];
    var last = nextList[1];
    var initFirst = initList[0];
    var initLast= initList[1];

    var i = Math.min(first, initFirst);
    var j = Math.max(last, initLast);

    for (; i <= j; i++) {
      if (i < first || i > last) {
        offscreenCallback(liveList[i]);
      } else if(i > initLast || i < initFirst) {
        onscreenCallback(liveList[i]);
      }
    };
  }

}
