//Avoiding lint checking the DOM file renaming it to .html
requireApp('communications/contacts/test/unit/mock_details_dom.js.html');

require('/shared/js/lazy_loader.js');
require('/shared/js/text_normalizer.js');

requireApp('communications/contacts/js/contacts_details.js');
requireApp('communications/contacts/js/utilities/templates.js');
requireApp('communications/contacts/js/utilities/dom.js');
requireApp('communications/contacts/test/unit/mock_contacts.js');
requireApp('communications/contacts/test/unit/mock_contact_all_fields.js');
requireApp('communications/contacts/test/unit/mock_fb.js');
requireApp('communications/contacts/test/unit/mock_extfb.js');

var subject,
    cntr,
    realL10n,
    realOnLine,
    dom,
    contact,
    contactDetails,
    listContainer,
    star,
    detailsName,
    orgTitle,
    birthdayTemplate,
    phonesTemplate,
    emailsTemplate,
    addressesTemplate,
    socialTemplate,
    isFbContact,
    editContactButton,
    cover,
    favoriteMessage,
    detailsInner,
    TAG_OPTIONS,
    dom,
    fb,
    Contacts,
    realContacts,
    realFb,
    mozL10n,
    mockContact,
    fbButtons,
    linkButtons;
var SCALE_RATIO = 1;

suite('Render contact', function() {

  var isOnLine = true;
  function navigatorOnLine() {
    return isOnLine;
  }

  function setNavigatorOnLine(value) {
    isOnLine = value;
  }

  suiteSetup(function() {
    realOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    realL10n = navigator.mozL10n;
    navigator.mozL10n = {
      get: function get(key) {
        return key;
      },
      DateTimeFormat: function() {
        this.localeFormat = function(date, format) {
          return date;
        };
      }
    };

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: navigatorOnLine,
      set: setNavigatorOnLine
    });

    realContacts = window.Contacts;
    window.Contacts = MockContacts;
    realFb = window.fb;
    window.fb = Mockfb;
    window.Contacts.extServices = MockExtFb;
    dom = document.createElement('section');
    dom.id = 'view-contact-details';
    dom.innerHTML = MockDetailsDom;
    cntr = dom.querySelector('#details-list');
    subject = contacts.Details;
    subject.init(dom);
    contactDetails = dom.querySelector('#contact-detail');
    listContainer = dom.querySelector('#details-list');
    star = dom.querySelector('#favorite-star');
    detailsName = dom.querySelector('#contact-name-title');
    orgTitle = dom.querySelector('#org-title');
    birthdayTemplate = dom.querySelector('#birthday-template-\\#i\\#');
    phonesTemplate = dom.querySelector('#phone-details-template-\\#i\\#');
    emailsTemplate = dom.querySelector('#email-details-template-\\#i\\#');
    addressesTemplate = dom.querySelector('#address-details-template-\\#i\\#');
    socialTemplate = dom.querySelector('#social-template-\\#i\\#');
    editContactButton = dom.querySelector('#edit-contact-button');
    cover = dom.querySelector('#cover-img');
    detailsInner = dom.querySelector('#contact-detail-inner');
    favoriteMessage = dom.querySelector('#toggle-favorite').children[0];

    fbButtons = [
      '#profile_button',
      '#msg_button',
      '#wall_button'
    ];

    linkButtons = [
      '#link_button'
    ];
  });

  suiteTeardown(function() {
    window.Contacts = realContacts;
    window.fb = realFb;
    window.mozL10n = realL10n;
    if (realOnLine) {
      Object.defineProperty(navigator, 'onLine', realOnLine);
    }
  });

  setup(function() {
    mockContact = new MockContactAllFields();
    subject.setContact(mockContact);
    TAG_OPTIONS = Contacts.getTags();
    window.set;
  });

  teardown(function() {
    cntr.innerHTML = '';
  });

  suite('Render name', function() {
    test('with name', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(detailsName.textContent, mockContact.name[0]);
        done();
      });
    });

    test('without name', function(done) {
      var contactWoName = new MockContactAllFields();
      contactWoName.name = null;
      subject.setContact(contactWoName);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(detailsName.textContent, '');
        done();
      });
    });
  });

  suite('Render favorite', function() {
    test('with favorite contact', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(false, star.classList.contains('hide'));
        done();
      });
    });
    test('without favorite contact', function(done) {
      var contactWoFav = new MockContactAllFields();
      contactWoFav.category = [];
      subject.setContact(contactWoFav);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(true, star.classList.contains('hide'));
        done();
      });
    });
  });

  suite('Render org', function() {
    test('with org', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(mockContact.org[0], orgTitle.textContent);
        assert.equal(false, orgTitle.classList.contains('hide'));
        done();
      });
    });
    test('without org', function(done) {
      var contactWoOrg = new MockContactAllFields();
      contactWoOrg.org = [];
      subject.setContact(contactWoOrg);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal('', orgTitle.textContent);
        assert.equal(true, orgTitle.classList.contains('hide'));
        done();
      });
    });
  });

  suite('Render bday', function() {
    test('with bday', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, mockContact.bday);
        done();
      });
    });
    test('without bday', function(done) {
      var contactWoBday = new MockContactAllFields();
      contactWoBday.bday = null;
      subject.setContact(contactWoBday);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('birthday'));
        done();
      });
    });
  });

  suite('Render social', function() {
     teardown(function() {
      window.fb.setIsFbContact(false);
      window.fb.setIsFbLinked(false);
    });

    function assertFbButtons(buttons, mode, state) {
      buttons.forEach(function(buttonid) {
        var selector = buttonid;
        if (state) {
          selector += '[' + state + ']';
        }
        if (mode === 'present') {
          assert.isNotNull(cntr.querySelector(selector));
        }
        else {
          assert.isNull(cntr.querySelector(selector));
        }
      });
    }

    test('It is not a Facebook Contact', function(done) {
      window.fb.setIsEnabled(true);
      window.fb.setIsFbContact(false);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'social-template');
        assert.isFalse(cntr.querySelector('#link_button').
                      classList.contains('hide'));
        assert.isTrue(cntr.
                         querySelector('#profile_button').
                         classList.contains('hide'));
        done();
      });
    });

    test('It is a Facebook Contact', function(done) {
      window.fb.setIsFbContact(true);

      // The edit mode should be disabled
      subject.render(null, null, false, function() {
        assert.equal('FB', orgTitle.textContent);

        assert.isFalse(cntr.
                         querySelector('#profile_button').
                         classList.contains('hide')
        );

        assert.isFalse(cntr.
                         querySelector('#msg_button').
                         classList.contains('hide')
        );

        assert.isFalse(cntr.
                         querySelector('#wall_button').
                         classList.contains('hide')
        );

        window.fb.setIsFbContact(false);
        done();
      });
    });

    test('Facebook is not enabled', function(done) {
      window.fb.setIsEnabled(false);

      subject.render(null, TAG_OPTIONS, false, function() {
        var incSocial = cntr.innerHTML.indexOf('social-template');
        assert.isTrue(incSocial === -1);

        assertFbButtons(linkButtons, 'absent');

        window.fb.setIsEnabled(true);
        done();
      });
    });

    test('FB Contact. Device is offline', function(done) {
      navigator.onLine = false;
      window.fb.setIsFbContact(true);

      subject.render(null, TAG_OPTIONS, false, function() {
        assertFbButtons(fbButtons, 'present', 'disabled');
        done();
      });
    });

    test('FB Contact. Device is online', function(done) {
      navigator.onLine = true;
      window.fb.setIsFbContact(true);

      subject.render(null, TAG_OPTIONS, false, function() {
        assertFbButtons(fbButtons, 'present');
        assertFbButtons(fbButtons, 'absent', 'disabled');
        done();
      });
    });

    test('Not FB Contact. Device is offline', function(done) {
      navigator.onLine = false;
      window.fb.setIsFbContact(false);

      subject.render(null, TAG_OPTIONS, false, function() {
        assertFbButtons(linkButtons, 'present', 'disabled');
        done();
      });
    });

    test('Not FB Contact. Device is online', function(done) {
      navigator.onLine = true;
      window.fb.setIsFbContact(false);

      subject.render(null, TAG_OPTIONS, false, function() {
        assertFbButtons(linkButtons, 'present');
        assertFbButtons(linkButtons, 'absent', 'disabled');
        done();
      });
    });
  });

  suite('Render phones', function() {
    test('with 1 phone', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'phone-details-template-0');
        assert.include(cntr.innerHTML, mockContact.tel[0].value);
        assert.include(cntr.innerHTML, mockContact.tel[0].carrier);
        assert.include(cntr.innerHTML, mockContact.tel[0].type);
        done();
      });
    });

    test('with 1 phone and carrier undefined', function(done) {
      var contactNoCarrier = new MockContactAllFields();
      contactNoCarrier.tel = [
        {
          value: '+34678987123',
          type: ['Personal']
        }
      ];
      subject.setContact(contactNoCarrier);
      subject.render(null, TAG_OPTIONS, false, function() {
        var phoneButton = cntr.querySelector('#call-or-pick-0');
        assert.equal(phoneButton.querySelector('b').textContent,
                      contactNoCarrier.tel[0].value);
        var carrierContent = phoneButton.querySelector('em').textContent;
        assert.lengthOf(carrierContent, 0);
        done();
      });
    });

    test('with no phones', function(done) {
      var contactWoTel = new MockContactAllFields();
      contactWoTel.tel = [];
      subject.setContact(contactWoTel);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('phone-details-template'));
        done();
      });
    });

    test('with null phones', function(done) {
      var contactWoTel = new MockContactAllFields();
      contactWoTel.tel = null;
      subject.setContact(contactWoTel);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('phone-details-template'));
        done();
      });
    });

    test('with more than 1 phone', function(done) {
      var contactMultTel = new MockContactAllFields();
      contactMultTel.tel[1] = contactMultTel.tel[0];
      for (var elem in contactMultTel.tel[1]) {
        var currentElem = contactMultTel.tel[1][elem] + 'dup';
        contactMultTel.tel[1][elem] = currentElem;
      }
      subject.setContact(contactMultTel);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'phone-details-template-0');
        assert.include(cntr.innerHTML, 'phone-details-template-1');
        assert.include(cntr.innerHTML, contactMultTel.tel[0].value);
        assert.include(cntr.innerHTML, contactMultTel.tel[0].carrier);
        assert.include(cntr.innerHTML, contactMultTel.tel[0].type);
        assert.include(cntr.innerHTML, contactMultTel.tel[1].value);
        assert.include(cntr.innerHTML, contactMultTel.tel[1].carrier);
        assert.include(cntr.innerHTML, contactMultTel.tel[1].type);
        assert.equal(-1, cntr.innerHTML.indexOf('phone-details-template-2'));
        done();
      });
    });
  });

  suite('Render emails', function() {
    test('with 1 email', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'email-details-template-0');
        assert.include(cntr.innerHTML, mockContact.email[0].value);
        assert.include(cntr.innerHTML, mockContact.email[0].type);
        done();
      });
    });

    test('with no emails', function(done) {
      var contactWoEmail = new MockContactAllFields();
      contactWoEmail.email = [];
      subject.setContact(contactWoEmail);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('email-details-template'));
        done();
      });
    });

    test('with null emails', function(done) {
      var contactWoEmail = new MockContactAllFields();
      contactWoEmail.email = null;
      subject.setContact(contactWoEmail);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('email-details-template'));
        done();
      });
    });

    test('with more than 1 email', function(done) {
      var contactMultEmail = new MockContactAllFields();
      contactMultEmail.email[1] = contactMultEmail.email[0];
      for (var elem in contactMultEmail.email[1]) {
        var currentElem = contactMultEmail.email[1][elem] + 'dup';
        contactMultEmail.email[1][elem] = currentElem;
      }
      subject.setContact(contactMultEmail);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'email-details-template-0');
        assert.include(cntr.innerHTML, 'email-details-template-1');
        var email0 = contactMultEmail.email[0];
        var email1 = contactMultEmail.email[1];
        assert.include(cntr.innerHTML, email0.value);
        assert.include(cntr.innerHTML, email0.type);
        assert.include(cntr.innerHTML, email1.value);
        assert.include(cntr.innerHTML, email1.type);
        assert.equal(-1, cntr.innerHTML.indexOf('email-details-template-2'));
        done();
      });
    });
  });
  suite('Render addresses', function() {
    test('with 1 address', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'address-details-template-0');
        var address0 = mockContact.adr[0];
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.countryName, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.locality, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.postalCode, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.streetAddress, true));
        done();
      });
    });

    test('with no addresses', function(done) {
      var contactWoAddress = new MockContactAllFields();
      contactWoAddress.adr = [];
      subject.setContact(contactWoAddress);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('address-details-template'));
        done();
      });
    });

    test('with null addresses', function(done) {
      var contactWoAddress = new MockContactAllFields();
      contactWoAddress.adr = null;
      subject.setContact(contactWoAddress);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('address-details-template'));
        done();
      });
    });

    test('with more than 1 address', function(done) {
      var contactMultAddress = new MockContactAllFields();
      contactMultAddress.adr[1] = contactMultAddress.adr[0];
      for (var elem in contactMultAddress.adr[1]) {
        var currentElem = contactMultAddress.adr[1][elem] + 'dup';
        contactMultAddress.adr[1][elem] = currentElem;
      }
      subject.setContact(contactMultAddress);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'address-details-template-0');
        assert.include(cntr.innerHTML, 'address-details-template-1');
        var address0 = contactMultAddress.adr[0];
        var address1 = contactMultAddress.adr[1];
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.countryName, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.locality, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.postalCode, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address0.streetAddress, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address1.countryName, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address1.locality, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address1.postalCode, true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(address1.streetAddress, true));
        var toCheck = cntr.innerHTML;
        assert.equal(-1, toCheck.indexOf('address-details-template-2'));
        done();
      });
    });
  });
  suite('Render notes', function() {
    test('with 1 note', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'note-details-template-0');
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(mockContact.note[0], true));
        done();
      });
    });

    test('with no notes', function(done) {
      var contactWoNote = new MockContactAllFields();
      contactWoNote.note = [];
      subject.setContact(contactWoNote);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('note-details-template'));
        done();
      });
    });

    test('with null notes', function(done) {
      var contactWoNote = new MockContactAllFields();
      contactWoNote.note = null;
      subject.setContact(contactWoNote);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(-1, cntr.innerHTML.indexOf('note-details-template'));
        done();
      });
    });

    test('with more than 1 note', function(done) {
      var contactMultNote = new MockContactAllFields();
      contactMultNote.note[1] = contactMultNote.note[0];
      for (var elem in contactMultNote.note[1]) {
        var currentElem = contactMultNote.note[1][elem] + 'dup';
        contactMultNote.note[1][elem] = currentElem;
      }
      subject.setContact(contactMultNote);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.include(cntr.innerHTML, 'note-details-template-0');
        assert.include(cntr.innerHTML, 'note-details-template-1');
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(contactMultNote.note[0], true));
        assert.include(cntr.innerHTML,
                      Normalizer.escapeHTML(contactMultNote.note[1], true));
        assert.equal(-1, cntr.innerHTML.indexOf('note-details-template-2'));
        done();
      });
    });
  });
  suite('Render photo', function() {
    test('with photo', function(done) {
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.isTrue(contactDetails.classList.contains('up'));
        assert.include(dom.innerHTML, mockContact.photo[0]);
        done();
      });
    });
    test('without photo', function(done) {
      var contactWoPhoto = new MockContactAllFields();
      contactWoPhoto.photo = [];
      subject.setContact(contactWoPhoto);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(cover.style.backgroundImage, '');
        assert.equal(cover.style.overflow, 'auto');
        assert.equal(contactDetails.style.transform, '');
        assert.isTrue(contactDetails.classList.contains('no-photo'));
        assert.isFalse(contactDetails.classList.contains('up'));
        done();
      });
    });
    test('with null photo', function(done) {
      var contactWoPhoto = new MockContactAllFields();
      contactWoPhoto.photo = null;
      subject.setContact(contactWoPhoto);
      subject.render(null, TAG_OPTIONS, false, function() {
        assert.equal(cover.style.backgroundImage, '');
        assert.equal(cover.style.overflow, 'auto');
        assert.equal(contactDetails.style.transform, '');
        assert.isTrue(contactDetails.classList.contains('no-photo'));
        assert.isFalse(contactDetails.classList.contains('up'));
        done();
      });
    });
  });

});
