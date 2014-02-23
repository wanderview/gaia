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

function generateItems(displayPortMarginMultiplier) {
  var scrollPos = getScrollPos();
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
  // Put the items that are furthest away from the displayport at the end of
  // the array.
  function distanceFromDisplayPort(i) {
    return i < startIndex ? startIndex - 1 - i : i - endIndex;
  }
  recyclableItems.sort(function (a,b) {
    return distanceFromDisplayPort(a) - distanceFromDisplayPort(b);
  });

  for (var i = startIndex; i < endIndex; ++i) {
    if (itemsInDOM[i]) {
      continue;
    }
    var item;
    if (recyclableItems.length > 0) {
      var recycleIndex = recyclableItems.pop();
      item = itemsInDOM[recycleIndex];
      delete itemsInDOM[recycleIndex];
    } else {
      item = template.cloneNode(true);
      document.body.appendChild(item);
    }
    populateItem(item, i);
    item.style.top = i*itemHeight + "px";
    itemsInDOM[i] = item;
  }
}

function fixupItems() {
  // Synchronously generate all the items that are immediately or nearly visible
  generateItems(1);
  // Asynchronously generate the other items for the displayport
  setTimeout(function() {
    generateItems(4);
  }, 0);
}

fixupItems();
scrollEventNode.addEventListener("scroll", fixupItems);
scrollEventNode.addEventListener("resize", fixupItems);
