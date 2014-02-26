// Expected to be provided by app code:
//  * DOM element with id="template" with fixed height
//  * numItems variable
//  * displayPortMarginMultiplier variable
//  * scrolledChild variable
//  * scrollEventNode variable
//  * prepareItemModel(index, callback) function
//  * cancelItem(index) function
//  * populateItem(element, index) function

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
var _itemsInDOM = [];
var _itemsBeingPrepared = [];
var _itemsAlreadyPrepared = [];

// Init our _lastScrollPos to be slightly off from starting position to
// force initial render.
var _lastScrollPos = getScrollPos() - 1;

// 6 px/ms max velocity * 16 ms/frame = 96 px/frame
// 480 px/screen / 96 px/frame = 5 frames/screen
// So we only need to do work every 5th frame.  If we could get the max velocity
// pref we could calculate this.
var MAX_SKIPPED_FRAMES = 4;

// Make sure we do work on the first time through.
var _skippedFrames = MAX_SKIPPED_FRAMES;

var _forceGenerateItems = false;

var _generateItemsScheduled = false;

var _eventHandlersEnabled = false;

function _itemPrepared(index, success) {
  if (!_itemsBeingPrepared[index]) {
    cancelItem(index);
    return;
  }
  delete _itemsBeingPrepared[index];
  if (success) {
    _itemsAlreadyPrepared[index] = true;
    _forceGenerateItems = true;
    _scheduleGenerateItems();
  }
}

function _scheduleGenerateItems() {
  if (_generateItemsScheduled) {
    return;
  }
  _generateItemsScheduled = true;
  // Disable events as we will monitor scroll position manually every frame
  _disableEventHandlers();
  requestAnimationFrame(_generateItems);
}

function _generateItems() {
  _generateItemsScheduled = false;

  // As described above we only need to do work every N frames.
  // TODO: It would be nice to spread work across all these frames instead
  //       of bursting every Nth frame.  Have to weigh complexity costs there.
  if (_skippedFrames < MAX_SKIPPED_FRAMES && !_forceGenerateItems) {
    _skippedFrames += 1;
    _scheduleGenerateItems();
  }
  _skippedFrames = 0;

  var scrollPos = getScrollPos();

  // If we stopped scrolling then go back to passive mode and wait for a new
  // scroll to start.
  if (scrollPos === _lastScrollPos && !_forceGenerateItems) {
    _skippedFrames = MAX_SKIPPED_FRAMES;
    _enableEventHandlers();
    return;
  }

  var scrollingForward = scrollPos >= _lastScrollPos;

  _forceGenerateItems = false;

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

  for (var i in _itemsBeingPrepared) {
    if (i < startIndex || i >= endIndex) {
      delete _itemsBeingPrepared[i];
    }
  }

  for (var i in _itemsAlreadyPrepared) {
    if (i < startIndex || i >= endIndex) {
      delete _itemsAlreadyPrepared[i];
      cancelItem[i];
    }
  }

  // indices of items which are eligible for recycling
  var recyclableItems = [];
  for (var i in _itemsInDOM) {
    if (i < startIndex || i >= endIndex) {
      recyclableItems.push(i);
    }
  }
  recyclableItems.sort();


  var toAppend = [];
  for (var i = startIndex; i < endIndex; ++i) {
    if (_itemsInDOM[i]) {
      continue;
    } else if (_itemsBeingPrepared[i]) {
      continue;
    } else if (!_itemsAlreadyPrepared[i]) {
      _itemsBeingPrepared[i] = true;
      prepareItemModel(i, _itemPrepared);
      continue;
    }

    delete _itemsAlreadyPrepared[i];
    var item;
    if (recyclableItems.length > 0) {
      var recycleIndex;
      // Delete the item furthest from the direction we're scrolling toward
      if (scrollingForward) {
        recycleIndex = recyclableItems.shift();
      } else {
        recycleIndex = recyclableItems.pop();
      }
      item = _itemsInDOM[recycleIndex];
      delete _itemsInDOM[recycleIndex];

      // NOTE: We must detach and reattach the node even though we are
      //       essentially just repositioning it.  This avoid pathological
      //       layerization behavior where each item gets assigned its own
      //       layer.
      scrolledChild.removeChild(item);
    } else {
      item = template.cloneNode(true);
    }
    if (!populateItem(item, i)) {
      // failed to populate, so discard node unfortunately
      continue;
    }
    item.style.top = i*itemHeight + "px";
    _itemsInDOM[i] = item;
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

  _lastScrollPos = scrollPos;

  // Continue checking every animation frame until we see that we have stopped
  // scrolling.
  _scheduleGenerateItems();
}

function _enableEventHandlers() {
  if (_eventHandlersEnabled) {
    return;
  }
  scrollEventNode.addEventListener("scroll", _scheduleGenerateItems);
  scrollEventNode.addEventListener("resize", _scheduleGenerateItems);
}

function _disableEventHandlers() {
  if (!_eventHandlersEnabled) {
    return;
  }
  scrollEventNode.removeEventListener("scroll", _scheduleGenerateItems);
  scrollEventNode.removeEventListener("resize", _scheduleGenerateItems);
}

_scheduleGenerateItems();
