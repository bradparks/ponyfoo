'use strict';

var glob = require('glob');
var path = require('path');
var escapeRegExp = require('escape-regexp');
var env = require('../lib/env');
var rhash = /(.*)\.[a-f0-9]{8}\.(.*)$/;
var hashmap = {};
var base = '.bin/public';
var pattern = base + '/{{img,css,js}/**/*,service-worker.*.js}';
var production = env('BUILD_ENV') === 'production';
if (production) {
  hashmap = glob.sync(pattern, { nodir: true }).reduce(toMap, {});
}

function toMap (hashmap, item) {
  var normal = item.replace(new RegExp(path.sep, 'g'), '/');
  var relative = normal.replace(base, '');
  var hashed = relative.replace(rhash, '$1.$2');
  hashmap[hashed] = relative;
  return hashmap;
}

function unroll (relative) {
  return hashmap[relative] || relative;
}

function unrollAll (input) {
  return Object.keys(hashmap).reduce(replacer, input);
  function replacer (input, unhashed) {
    var hashed = hashmap[unhashed];
    var regexp = new RegExp(escapeRegExp(unhashed), 'g');
    return input.replace(regexp, hashed);
  }
}

function identity (value) {
  return value;
}

module.exports = {
  unroll: production ? unroll : identity,
  unrollAll: production ? unrollAll : identity
};
