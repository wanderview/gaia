'use strict';

var Cache = function(id) {
  this.id = id;
  this.data = [];
};

Cache.prototype = {
  get: function cache_get(start, size) {
    return this.data.slice(start, size);
  },

  set: function cache_set(start, data) {
    throw new Error('NOT_IMPLEMENTED'); 
  },

  restore: function cache_restore(callback) {
    asyncStorage.getItem(this.id, function(data) {
      this.data = JSON.parse(data || "[]");
      callback(this.data);
    }.bind(this));
  },

  save: function cache_save() {
    asyncStorage.setItem(this.id, JSON.stringify(this.data));
  },

  reset: function cache_reset() {
    this.data = [];
    this.save();
  }
};

