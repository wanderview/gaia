'use strict';

var contacts = window.contacts || {};
contacts.List = (function() {
  var _,
      groupsList,
      favoriteGroup,
      loaded = false,
      cancel,
      contactsListView,
      fastScroll,
      scrollable,
      settingsView,
      noContacts,
      imgLoader,
      orderByLastName = null,
      contactsPhoto = [],
      photoTemplate,
      headers = {},
      contactsCache = {},
      imagesLoaded = false,
      contactsLoadFinished = false,
      cachedContacts = [],
      loadedContacts = {},
      viewHeight,
      renderTimer = null,
      toRender = [],
      monitor;

  // Key on the async Storage
  var ORDER_KEY = 'order.lastname';

  // Possible values for the configuration field 'defaultContactsOrder'
  // config.json file (see bug 841693)
  var ORDER_BY_FAMILY_NAME = 'familyName';
  var ORDER_BY_GIVEN_NAME = 'givenName';

  var NOP_FUNCTION = function() {};

  var onscreen = function(el) {
    // If the contact has already been rendered there is no need to do extra
    // work here.
    if (el.dataset.rendered)
      return;

    toRender.push(el);

    if (renderTimer)
      return;

    renderTimer = setTimeout(function() {
      renderTimer = null;
      monitor.pauseMonitoringMutations();
      while (toRender.length) {
        var row = toRender.shift();
        renderLoadedContact(row);
      }
      monitor.resumeMonitoringMutations();
    }, 0);
  };

  var offscreen = function(el) {
    // Nothing special is done here for now. It could be good to release images
    // or other memory expensive stuffs here.
  };

  var renderLoadedContact = function(el) {
    if (el.dataset.rendered)
      return;
    var contact = loadedContacts[el.dataset.uuid];
    if (!contact)
      return;
    renderContact(el, contact);
    delete loadedContacts[el.dataset.uuid];
  }

  var init = function load(element) {
    _ = navigator.mozL10n.get;

    cancel = document.getElementById('cancel-search'),
    contactsListView = document.getElementById('view-contacts-list'),
    fastScroll = document.querySelector('nav[data-type="scrollbar"]'),
    scrollable = document.querySelector('#groups-container');
    settingsView = document.querySelector('#view-settings .view-body-inner');
    noContacts = document.querySelector('#no-contacts');

    groupsList = document.getElementById('groups-list');
    groupsList.addEventListener('click', onClickHandler);

    initHeaders();
    favoriteGroup = document.getElementById('group-favorites').parentNode;
    var selector = 'header:not(.hide)';
    FixedHeader.init('#groups-container', '#fixed-container', selector);

    imgLoader = new ImageLoader('#groups-container', 'li');

    initOrder();

    monitor = monitorChildWithTagVisibility(scrollable, 600, 300, 4, 'li',
                                            onscreen, offscreen);
  };

  //
  // Implement interface required by search.js
  //
  var searchSource = {
    getNodes: function() {
      var domNodes = contactsListView.querySelectorAll('section>ol>li');
      return Array.prototype.slice.call(domNodes);
    },

    getFirstNode: function() {
      return contactsListView.querySelector('section>ol>li');
    },

    getNextNode: function(contact) {
      var out = contact.nextElementSibling;
      var nextParent = contact.parentNode.parentNode.nextElementSibling;
      while (!out && nextParent) {
        out = nextParent.querySelector('ol > li:first-child');
        nextParent = nextParent.nextElementSibling;
      }
      return out;
    },

    clone: function(node) {
      renderLoadedContact(node);
      return node.cloneNode();
    },

    getNodeForId: function(id) {
      return contactsListView.querySelector('[data-uuid="' + id + '"]');
    },

    getSearchText: function(node) {
      return node.dataset.search;
    },

    click: onClickHandler
  };

  var initSearch = function initSearch(callback) {
    contacts.Search.init(searchSource, true);

    if (callback) {
      callback();
    }
  };

  var initAlphaScroll = function initAlphaScroll() {
    var overlay = document.querySelector('nav[data-type="scrollbar"] p');
    var jumper = document.querySelector('nav[data-type="scrollbar"] ol');

    var params = {
      overlay: overlay,
      jumper: jumper,
      groupSelector: '#group-',
      scrollToCb: scrollToCb
    };

    utils.alphaScroll.init(params);
  };

  var scrollToCb = function scrollCb(domTarget, group) {
    if (domTarget.offsetTop > 0)
      scrollable.scrollTop = domTarget.offsetTop;
  };

  var load = function load(contacts, forceReset) {
    var onError = function() {
      console.log('ERROR Retrieving contacts');
    };

    if (loaded || forceReset) {
      resetDom();
    }

    initOrder(function onInitOrder() {
      getContactsByGroup(onError, contacts);
    });
  };

  function getFbUid(devContact) {
    var out;

    if (Array.isArray(devContact.category)) {
      var idx = devContact.category.indexOf('facebook');
      if (idx !== -1) {
        out = devContact.category[idx + 2];
      }
    }

    return out;
  }

  var initOrder = function initOrder(callback) {
    if (orderByLastName === null) {
      if (document.cookie) {
        var cookie = JSON.parse(document.cookie);
        orderByLastName = cookie.order;
        if (callback)
          callback();
      } else {
        var req = utils.config.load('/contacts/config.json');
        req.onload = function configReady(configData) {
          orderByLastName = (configData.defaultContactsOrder ===
                    ORDER_BY_FAMILY_NAME ? true : false);
          document.cookie = JSON.stringify({order: orderByLastName});
          if (callback)
            callback();
        };

        req.onerror = function configError() {
          window.console.error('Error while reading configuration file');
          orderByLastName = false;
          document.cookie = JSON.stringify({order: false});
          if (callback) {
            callback();
          }
        };
      }
    } else {
      if (callback)
        callback();
    }
  };

  var renderGroupHeader = function renderGroupHeader(group, letter) {
    var letteredSection = document.createElement('section');
    letteredSection.id = 'section-group-' + group;
    var title = document.createElement('header');
    title.id = 'group-' + group;
    title.className = 'hide';

    var letterAbbr = document.createElement('abbr');
    letterAbbr.setAttribute('title', 'Contacts listed ' + group);
    letterAbbr.textContent = letter;
    title.appendChild(letterAbbr);

    var contactsContainer = document.createElement('ol');
    contactsContainer.id = 'contacts-list-' + group;
    contactsContainer.dataset.group = group;
    letteredSection.appendChild(title);
    letteredSection.appendChild(contactsContainer);
    letteredSection.className = '';
    groupsList.appendChild(letteredSection);

    headers[group] = contactsContainer;
  };

  var renderFullContact = function renderFullContact(contact, fbContacts) {
    var contactContainer = renderContact(null, contact);
    var name = contactContainer.children[0];

    // Label the contact concerning social networks
    if (contact.category) {
      var marks = buildSocialMarks(contact.category);
      if (marks.length > 0) {
        var meta;
        if (!contact.org || contact.org.length === 0 ||
          contact.org[0].length === 0) {
            addOrgMarkup(contactContainer);
            meta = contactContainer.children[1];
            contactContainer.appendChild(meta);
            marks[0].classList.add('notorg');
        }
        var metaFragment = document.createDocumentFragment();
        marks.forEach(function(mark) {
          metaFragment.appendChild(mark);
        });
        meta = contactContainer.children[1];
        var org = meta.querySelector('span');
        meta.insertBefore(metaFragment, org);
      }
    }

    //Render photo if there is one
    if (contact.photo && contact.photo.length > 0) {
      renderPhoto(contact, contactContainer);
    }

    return contactContainer;
  };

  // This method returns the very essential information needed
  // for rendering the contacts list
  // Images, Facebook data and searcheable info will be lazy loaded
  var renderContact = function renderContact(contactContainer, contact, fbContacts) {
    contact = refillContactData(contact);
    if (!contactContainer) {
      contactContainer = createPlaceholder(contact);
    }
    var fbUid = getFbUid(contact);
    if (fbUid) {
      contactContainer.dataset.fbUid = fbUid;
    }
    contactContainer.className = 'contact-item';
    var timestampDate = contact.updated || contact.published || new Date();
    contactContainer.dataset.updated = timestampDate.getTime();
    // contactInner is a link with 3 p elements:
    // name, socaial marks and org
    var nameElement = getHighlightedName(contact);
    contactContainer.appendChild(nameElement);
    contactsCache[contact.id] = {
      contact: contact,
      container: contactContainer
    };
    renderOrg(contact, contactContainer, true);

    // Facebook data, favorites and images will be lazy loaded
    if (contact.category || contact.photo) {
      contactsPhoto.push(contact.id);
    }
    contactContainer.dataset.rendered = true;
    return contactContainer;
  };

  var createPlaceholder = function createPlaceholder(contact) {
    var ph = document.createElement('li');
    ph.dataset.uuid = contact.id;
    ph.dataset.search = getSearchString(contact);
    ph.dataset.order = getStringToBeOrdered(contact);
    return ph;
  };

  var getSearchString = function getSearchString(contact) {
    var searchInfo = [];
    var searchable = ['givenName', 'familyName', 'org'];
    searchable.forEach(function(field) {
      if (contact[field] && contact[field][0]) {
        var value = String(contact[field][0]).trim();
        if (value.length > 0) {
          searchInfo.push(value);
        }
      }
    });
    if (contact.tel && contact.tel.length) {
      for (var i = contact.tel.length - 1; i >= 0; i--) {
        var current = contact.tel[i];
        searchInfo.push(current.value);
      }
    }
    var escapedValue = Normalizer.escapeHTML(searchInfo.join(' '), true);
    return Normalizer.toAscii(escapedValue);
  };

  function getHighlightedName(contact, ele) {
    if (!ele) {
      ele = document.createElement('p');
    }
    var givenName = (contact.givenName && contact.givenName[0]) || '';
    var familyName = (contact.familyName && contact.familyName[0]) || '';

    function createStrongTag(content) {
      var fs = document.createElement('strong');
      fs.textContent = content;
      return fs;
    }

    if (orderByLastName) {
      ele.appendChild(document.createTextNode(givenName + ' '));
      ele.appendChild(createStrongTag(familyName));
    } else {
      ele.appendChild(createStrongTag(givenName));
      ele.appendChild(document.createTextNode(' ' + familyName));
    }
    return ele;
  }

  function buildSocialMarks(category) {
    var marks = [];
    if (category.indexOf('facebook') !== -1) {
      marks.push(markAsFb(createSocialMark()));
    }

    if (category.indexOf('twitter') !== -1) {
      marks.push(markAsTw(createSocialMark()));
    }

    return marks;
  }

  function createSocialMark() {
    var span = document.createElement('span');
    span.classList.add('icon-social');

    return span;
  }

  function markAsFb(ele) {
    ele.classList.add('icon-fb');

    return ele;
  }

  function markAsTw(ele) {
    ele.classList.add('icon-tw');

    return ele;
  }

  var renderedChunks = 0;
  var CHUNK_SIZE = 20;
  var NUM_VISIBLE_CONTACTS = 6;
  function loadChunk(chunk) {
    var isFirstChunk = (renderedChunks === 0);
    var nodes = [];
    for (var i = 0; i < chunk.length; i++) {
      nodes.push(appendToList(chunk[i]));
    }

    if (isFirstChunk) {
      // Performance testing
      PerformanceTestingHelper.dispatch('above-the-fold-ready');
    }
    renderedChunks++;
    contacts.Search.appendNodes(nodes);
  }

  //Adds each contact to its group container
  function appendToList(contact) {
    var ph = createPlaceholder(contact);

    var group = getGroupName(contact);
    var list = headers[group];

    // If above the fold for list, render immediately
    if (list.children.length < (NUM_VISIBLE_CONTACTS-1)) {
      renderContact(ph, contact);

    // Otherwise save contact to render later
    } else {
      loadedContacts[contact.id] = contact;
    }

    list.appendChild(ph);
    if (list.children.length === 1) {
      showGroupByList(list);
    }

    return ph;
  }

  // Methods executed after rendering the list
  // by first time
  var onListRendered = function onListRendered() {
    window.addEventListener('finishLazyLoading', function finishLazyLoading() {
      if (imagesLoaded) {
        imagesLoaded = false;
        window.removeEventListener('finishLazyLoading', finishLazyLoading);
        contactsCache = {};
      }
    });
    FixedHeader.refresh();

    PerformanceTestingHelper.dispatch('startup-path-done');
    fb.init(function contacts_init() {
      if (fb.isEnabled) {
        Contacts.loadFacebook(NOP_FUNCTION);
      }
      lazyLoadImages();
      loaded = true;
    });
  };

  var isFavorite = function isFavorite(contact) {
    return contact.category && contact.category.indexOf('favorite') != -1;
  };

  var lazyLoadImages = function lazyLoadImages() {
    if (!contactsPhoto || !Array.isArray(contactsPhoto)) {
      return;
    }
    var favs = false;
    for (var i = 0; i < contactsPhoto.length; i++) {
      var id = contactsPhoto[i];
      var current = contactsCache[id];
      if (current) {
        var contact = current.contact;
        var link = current.container;
        renderPhoto(contact, link);
        if (isFavorite(contact)) {
          addToFavoriteList(link.cloneNode(true));
        }
      }
    }
    contactsPhoto = [];
    LazyLoader.load(['/contacts/js/fb_resolver.js'], function() {
      imgLoader.setResolver(fb.resolver);
      imgLoader.reload();
    });

    imagesLoaded = true;
    dispatchCustomEvent('finishLazyLoading');
  };

  var dispatchCustomEvent = function dispatchCustomEvent(eventName) {
    var event = new CustomEvent(eventName);
    window.dispatchEvent(event);
  };

  var renderPhoto = function renderPhoto(contact, link) {
    if (!contact.photo || !contact.photo.length) {
      return;
    }
    var photo = contact.photo;
    if (link.children[0].tagName == 'ASIDE') {
      var img = link.children[0].children[0];
      try {
        img.dataset.src = window.URL.createObjectURL(contact.photo[0]);
      } catch (err) {
        img.dataset.src = '';
      }
      return;
    }
    if (!photoTemplate) {
      photoTemplate = document.createElement('aside');
      photoTemplate.className = 'pack-end';
      var img = document.createElement('img');
      photoTemplate.appendChild(img);
    }

    var figure = photoTemplate.cloneNode(true);
    var img = figure.children[0];
    try {
      img.dataset.src = window.URL.createObjectURL(contact.photo[0]);
    } catch (err) {
      img.dataset.src = '';
    }

    link.insertBefore(figure, link.children[0]);
    return;
  };

  var renderOrg = function renderOrg(contact, link, add) {
    if (!contact.org || !contact.org.length ||
        contact.org[0] === '' || contact.org[0] === contact.givenName) {
      return;
    }
    if (add) {
      addOrgMarkup(link, contact.org[0]);
      return;
    }
    var org = link.lastElementChild.querySelector('span.org');
    org.textContent = contact.org[0];
  };

  function renderFbData(contact, link) {
    var meta;
    var elements = link.getElementsByTagName('p');
    if (elements.length == 1) {
      meta = addOrgMarkup(link);
    } else {
      meta = elements[1];
    }
    var mark = markAsFb(createSocialMark());
    var org = meta.querySelector('span.org');
    meta.insertBefore(mark, org);
    if (!contact.org || !contact.org.length) {
      mark.classList.add('notorg');
    } else {
      renderOrg(contact, link);
    }
  }


  var addOrgMarkup = function addOrgMarkup(link, content) {
    var span = document.createElement('span');
    span.className = 'org';
    if (content) {
      span.textContent = content;
    }
    var meta = document.createElement('p');
    meta.appendChild(span);
    link.appendChild(meta);
    return meta;
  };

  var toggleNoContactsScreen = function cl_toggleNoContacs(show) {
    if (show && ActivityHandler.currentlyHandling) {
      var actName = ActivityHandler.activityName;
      if (actName == 'pick' || actName == 'update') {
        showNoContactsAlert();
        return;
      }
    }
    if (show && !ActivityHandler.currentlyHandling) {
      noContacts.classList.remove('hide');
      return;
    }
    noContacts.classList.add('hide');
  };

  var showNoContactsAlert = function showNoContactsAlert() {
    var msg = _('noContactsActivity');
    var noObject = {
      title: _('ok'),
      isDanger: false,
      callback: function onNoClicked() {
        ConfirmDialog.hide();
        ActivityHandler.postCancel();
      }
    };

    ConfirmDialog.show(null, msg, noObject);
  };

  function addToFavoriteList(favorite) {
    var container = headers['favorites'];
    container.appendChild(favorite);
    if (container.children.length === 1) {
      showGroupByList(container);
    }
  }

  var getContactsByGroup = function gCtByGroup(errorCb, contacts) {
    if (!Contacts.asyncScriptsLoaded) {
      // delay loading if they're not there yet
      window.addEventListener('asyncScriptsLoaded', function listener() {
        window.removeEventListener('asyncScriptsLoaded', listener);

        getContactsByGroup(errorCb, contacts);
      });
      return;
    }
    renderedChunks = 0;
    if (contacts) {
      if (!contacts.length) {
        toggleNoContactsScreen(true);
        return;
      }
      toggleNoContactsScreen(false);
      loadChunk(contacts);
      onListRendered();
      dispatchCustomEvent('listRendered');
      contactsLoadFinished = true;
      return;
    }
    getAllContacts(errorCb, loadChunk);
  };

  var getContactById = function(contactID, successCb, errorCb) {
    var options = {
      filterBy: ['id'],
      filterOp: 'equals',
      filterValue: contactID
    };
    var request = navigator.mozContacts.find(options);

    request.onsuccess = function findCallback(e) {
      var result = e.target.result[0];

      if (fb.isFbContact(result)) {
        // Fb data for the contact has to be obtained
        var fbContact = new fb.Contact(result);
        var fbReq = fbContact.getData();
        fbReq.onsuccess = function() {
          successCb(result, fbReq.result);
        };
        fbReq.onerror = function() {
          successCb(result);
        };
      } else {
          successCb(result);
      }

    }; // request.onsuccess

    if (typeof errorCb === 'function') {
      request.onerror = errorCb;
    }
  };

  var getAllContacts = function cl_getAllContacts(errorCb, successCb) {
    initOrder(function onInitOrder() {
      var sortBy = (orderByLastName === true ? 'familyName' : 'givenName');
      var options = {
        sortBy: sortBy,
        sortOrder: 'ascending'
      };

      var cursor = navigator.mozContacts.getAll(options);
      var successCb = successCb || loadChunk;
      var num = 0;
      var chunk = [];
      cursor.onsuccess = function onsuccess(evt) {
        var contact = evt.target.result;
        if (contact) {
          chunk.push(contact);
          if (num && (num % CHUNK_SIZE == 0)) {
            successCb(chunk);
            chunk = [];
          }
          num++;
          cursor.continue();
        } else {
          if (chunk.length)
            successCb(chunk);
          onListRendered();
          var showNoContacs = (num === 0);
          toggleNoContactsScreen(showNoContacs);
          dispatchCustomEvent('listRendered');
          contactsLoadFinished = true;
        }
      };
      cursor.onerror = errorCb;
    });
  };

  /*
    Two contacts are returned because the enrichedContact is readonly
    and if the Contact is edited we need to prevent saving
    FB data on the mozContacts DB.
  */
  var addToList = function addToList(contact, enrichedContact) {
    var theContact = contact;

    if (enrichedContact) {
      theContact = enrichedContact;
    }

    var group = getGroupName(theContact);

    var list = headers[group];

    addToGroup(theContact, list);

    // If is favorite add as well to the favorite group
    if (isFavorite(theContact)) {
      list = headers['favorites'];
      addToGroup(theContact, list);
    }
    toggleNoContactsScreen(false);
    FixedHeader.refresh();
    imgLoader.reload();
  };

  var hasName = function hasName(contact) {
    return (Array.isArray(contact.givenName) && contact.givenName[0] &&
              contact.givenName[0].trim()) ||
            (Array.isArray(contact.familyName) && contact.familyName[0] &&
              contact.familyName[0].trim());
  };

  // Fills the contact data to display if no givenName and familyName
  var refillContactData = function refillContactData(contact) {
    if (!hasName(contact)) {
      contact.givenName = [];
      if (contact.org && contact.org.length > 0) {
        contact.givenName.push(contact.org[0]);
      } else if (contact.tel && contact.tel.length > 0) {
        contact.givenName.push(contact.tel[0].value);
      } else if (contact.email && contact.email.length > 0) {
        contact.givenName.push(contact.email[0].value);
      } else {
        contact.givenName.push(_('noName'));
      }
    }

    return contact;
  };

  var addToGroup = function addToGroup(contact, list) {
    var newLi;
    var cName = getStringToBeOrdered(contact);

    var liElems = list.getElementsByTagName('li');
    var len = liElems.length;
    for (var i = 0; i < len; i++) {
      var liElem = liElems[i];
      var name = liElem.dataset.order;
      if (name.localeCompare(cName) >= 0) {
        newLi = renderFullContact(contact);
        list.insertBefore(newLi, liElem);
        break;
      }
    }

    if (!newLi) {
      newLi = renderFullContact(contact);
      list.appendChild(newLi);
    }

    if (list.children.length === 1) {
      showGroupByList(list);
    }

    // Mark as loaded to avoid data duplication by the resolver
    newLi.dataset.status = 'loaded';

    return list.children.length;
  };

  var hideGroup = function hideGroup(group) {
    var groupTitle = headers[group].parentNode.children[0];
    groupTitle.classList.add('hide');
    FixedHeader.refresh();
  };

  var showGroup = function showGroup(group) {
    var current = headers[group];
    showGroupByList(current);
  }

  var showGroupByList = function showGroupByList(current) {
    var groupTitle = current.parentNode.children[0];
    groupTitle.classList.remove('hide');
    FixedHeader.refresh();
  };

  var remove = function remove(id) {
    // Could be more than one item if it's in favorites
    var items = groupsList.querySelectorAll('li[data-uuid=\"' + id + '\"]');
    // We have a node list, not an array, and we want to walk it
    Array.prototype.forEach.call(items, function removeItem(item) {
      var ol = item.parentNode;
      ol.removeChild(item);
      if (ol.children.length < 1) {
        hideGroup(ol.dataset.group);
      }
    });
    var selector = 'section header:not(.hide)';
    var visibleElements = groupsList.querySelectorAll(selector);
    var showNoContacts = visibleElements.length === 0;
    toggleNoContactsScreen(showNoContacts);
  };

  var getStringToBeOrdered = function getStringToBeOrdered(contact) {
    var ret = [];

    var familyName, givenName;

    familyName = Array.isArray(contact.familyName) &&
                                    typeof contact.familyName[0] === 'string' ?
      contact.familyName[0].trim() : '';
    givenName = Array.isArray(contact.givenName) &&
                                    typeof contact.givenName[0] === 'string' ?
      contact.givenName[0].trim() : '';

    var first = givenName, second = familyName;
    if (orderByLastName) {
      first = familyName;
      second = givenName;
    }

    ret.push(first);
    ret.push(second);

    if (first != '' || second != '')
      return Normalizer.toAscii(ret.join('')).trim();
    ret.push(contact.org);
    ret.push(contact.tel && contact.tel.length > 0 ?
      contact.tel[0].value.trim() : '');
    ret.push(contact.email && contact.email.length > 0 ?
      contact.email[0].value.trim() : '');
    ret.push('#');

    return Normalizer.toAscii(ret.join('')).trim();
  };

  var getGroupName = function getGroupName(contact) {
    var ret = getStringToBeOrdered(contact);
    ret = ret.charAt(0).toUpperCase();

    var code = ret.charCodeAt(0);
    if (code < 65 || code > 90) {
      ret = 'und';
    }
    return ret;
  };

  // Perform contact refresh by id
  var refresh = function refresh(id, callback, op) {
    remove(id);
    if (typeof(id) == 'string') {
      getContactById(id, function(contact, fbData) {
        var enrichedContact = null;
        if (fb.isFbContact(contact)) {
          var fbContact = new fb.Contact(contact);
          enrichedContact = fbContact.merge(fbData);
        }
        addToList(contact, enrichedContact);
        if (callback) {
          callback(id);
        }
      });
    } else {
      var contact = id;
      remove(contact.id);
      // Add without looking for extras, just what we have as contact
      addToList(contact);
      if (callback) {
        callback(contact.id);
      }
    }
  };

  var callbacks = [];
  var handleClick = function handleClick(callback) {
    callbacks.push(callback);
  };

  var clearClickHandlers = function clearClickHandlers() {
    callbacks = [];
  };

  function onClickHandler(evt) {
    var target = evt.target;
    var dataset = target.dataset || {};
    var parentDataset = target.parentNode ?
                          (target.parentNode.dataset || {}) : {};
    var uuid = dataset.uuid || parentDataset.uuid;
    if (uuid) {
      callbacks.forEach(function(callback) {
        callback(uuid);
      });
    }
    evt.preventDefault();
  }

  // Reset the content of the list to 0
  var resetDom = function resetDom() {
    contactsPhoto = [];
    utils.dom.removeChildNodes(groupsList);
    loaded = false;

    initHeaders();
  };

  // Initialize group headers at the beginning or after a dom reset
  var initHeaders = function initHeaders() {
    // Populating contacts by groups
    headers = {};
    renderGroupHeader('favorites', '');
    for (var i = 65; i <= 90; i++) {
      var letter = String.fromCharCode(i);
      renderGroupHeader(letter, letter);
    }
    renderGroupHeader('und', '#');
  };

  var setOrderByLastName = function setOrderByLastName(value) {
    orderByLastName = value;
  };

  return {
    'init': init,
    'load': load,
    'refresh': refresh,
    'getContactById': getContactById,
    'getAllContacts': getAllContacts,
    'handleClick': handleClick,
    'initAlphaScroll': initAlphaScroll,
    'initSearch': initSearch,
    'remove': remove,
    'loaded': loaded,
    'clearClickHandlers': clearClickHandlers,
    'setOrderByLastName': setOrderByLastName,
    'renderPhoto': renderPhoto,
    'renderFbData': renderFbData,
    'getHighlightedName': getHighlightedName,
    get chunkSize() {
      return CHUNK_SIZE;
    }
  };
})();
