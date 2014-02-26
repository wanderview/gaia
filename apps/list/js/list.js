var template = document.getElementById("template");
var itemHeight = template.clientHeight;
// The template should not be rendered, so take it out of the document.
document.body.removeChild(template);
// Remove its "id" attribute now so that that attribute doesn't get cloned
// into all the items.
template.removeAttribute("id");

// Make sure we can scroll the required distance.
scrolledChild.style.height = itemHeight*numItems + "px";

// Indexed by item number, the item elements currently in the DOM.
var itemsInDOM = [];

// Init our lastScrollPos to be slightly off from starting position to
// force initial render.
var lastScrollPos = getScrollPos() - 1;

// 6 px/ms max velocity * 16 ms/frame = 96 px/frame
// 480 px/screen / 96 px/frame = 5 frames/screen
// So we only need to do work every 5th frame.  If we could get the max velocity
// pref we could calculate this.
var MAX_SKIPPED_FRAMES = 4;

// Make sure we do work on the first time through.
var skippedFrames = MAX_SKIPPED_FRAMES;

function generateItems(displayPortMarginMultiplier) {
  // As described above we only need to do work every N frames.
  // TODO: It would be nice to spread work across all these frames instead
  //       of bursting every Nth frame.  Have to weigh complexity costs there.
  if (skippedFrames < MAX_SKIPPED_FRAMES) {
    skippedFrames += 1;
    requestAnimationFrame(generateItems.bind(null, displayPortMarginMultiplier));
  }
  skippedFrames = 0;

  var scrollPos = getScrollPos();

  // If we stopped scrolling then go back to passive mode and wait for a new
  // scroll to start.
  if (scrollPos === lastScrollPos) {
    skippedFrames = MAX_SKIPPED_FRAMES;
    enableEventHandlers();
    return;
  }

  var scrollPortHeight = getScrollPortHeight();
  // Determine which items we *need* to have in the DOM. displayPortMargin
  // is somewhat arbitrary. If there is fast async scrolling, increase
  // displayPortMarginMultiplier to make sure more items can be prerendered. If
  // populateItem triggers slow async activity (e.g. image loading or
  // database queries to fill in an item), increase displayPortMarginMultiplier
  // to reduce the likelihood of the user seeing incomplete items.
  var displayPortMargin = displayPortMarginMultiplier*scrollPortHeight;
  var startIndex = Math.max(0,
    Math.floor((scrollPos - displayPortMargin)/itemHeight));
  var endIndex = Math.min(numItems,
    Math.ceil((scrollPos + scrollPortHeight + displayPortMargin)/itemHeight));

  // indices of items which are eligible for recycling
  var recyclableItems = [];
  for (var i in itemsInDOM) {
    if (i < startIndex || i >= endIndex) {
      recyclableItems.push(i);
    }
  }
  recyclableItems.sort();

  var toAppend = [];
  for (var i = startIndex; i < endIndex; ++i) {
    if (itemsInDOM[i]) {
      continue;
    }
    var item;
    if (recyclableItems.length > 0) {
      var recycleIndex;
      // Delete the item furthest from the direction we're scrolling toward
      if (scrollPos >= lastScrollPos) {
        recycleIndex = recyclableItems.shift();
      } else {
        recycleIndex = recyclableItems.pop();
      }
      item = itemsInDOM[recycleIndex];
      delete itemsInDOM[recycleIndex];

      // NOTE: We must detach and reattach the node even though we are
      //       essentially just repositioning it.  This avoid pathological
      //       layerization behavior where each item gets assigned its own
      //       layer.
      scrolledChild.removeChild(item);
    } else {
      item = template.cloneNode(true);
    }
    populateItem(item, i);
    item.style.top = i*itemHeight + "px";
    itemsInDOM[i] = item;
    toAppend.push(item);
  }

  if (toAppend.length === 1) {
    scrolledChild.appendChild(toAppend.shift());
  } else if (toAppend.length) {
    var frag = document.createDocumentFragment();
    while (toAppend.length) {
      frag.appendChild(toAppend.shift());
    }
    scrolledChild.appendChild(frag);
  }

  lastScrollPos = scrollPos;

  // Continue checking every animation frame until we see that we have stopped
  // scrolling.
  requestAnimationFrame(generateItems.bind(null, displayPortMarginMultiplier));
}

function enableEventHandlers() {
  scrollEventNode.addEventListener("scroll", fixupItems);
  scrollEventNode.addEventListener("resize", fixupItems);
}

function disableEventHandlers() {
  scrollEventNode.removeEventListener("scroll", fixupItems);
  scrollEventNode.removeEventListener("resize", fixupItems);
}

function fixupItems() {
  requestAnimationFrame(generateItems.bind(null, 1));

  // Disable events as we will monitor scroll position manually every frame
  disableEventHandlers();
}

fixupItems();
