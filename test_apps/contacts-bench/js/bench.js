'use strict';

window.addEventListener('load', main);

function main() {
  var out = document.querySelector('#output');
  var delay = 15000;
  out.textContent = 'Waiting ' + delay + ' ms before loading contacts.';
  setTimeout(bench.bind(null, out), delay);
}

function bench(out) {
  out.textContent = 'Loading contacts.  Please wait...';
  var contacts = [];
  var start = Date.now();
  var cursor = navigator.mozContacts.getAll({});
  cursor.onsuccess = function onsuccess(evt) {
    var contact = evt.target.result;
    if (!contact)
      return report(out, start, Date.now(), contacts);

    contacts.push(contact);
    cursor.continue();
  };
  cursor.onerror = reportError.bind(null, out);
}

function report(out, start, end, contacts) {
  out.textContent = 'Loaded ' + contacts.length + ' contacts taking ' +
                    JSON.stringify(contacts).length + ' bytes in ' +
                    (end - start) + ' ms.';
}

function reportError(out) {
  out.textContent = 'Received an error while loading.';
}
