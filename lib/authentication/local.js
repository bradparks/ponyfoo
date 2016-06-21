'use strict';

var contra = require('contra');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var User = require('../../models/User');
var elogin = 'Invalid login credentials';

function loginHandler (email, password, done) {
  contra.waterfall([
    function lookupUser (next) {
      User.findOne({ email: email }, next);
    },
    function validateUser (user, next) {
      if (!user) {
        User.findOne({ slug: email }, next);
      } else {
        next(null, user);
      }
    },
    function validateUser (user, next) {
      if (!user || !user.password) {
        next(elogin); return;
      }
      user.validatePassword(password, function validatedPassword (err, valid) {
        next(err, user, valid);
      });
    },
    function validateCredentials (user, valid, next) {
      if (!valid) {
        next(elogin); return;
      }
      next(null, user.toObject());
    }
  ], function evaluateResult (err, user) {
    if (err === elogin) {
      done(null, false, elogin); return;
    }
    done(err, user);
  });
}

function localSetup () {
  passport.use(new LocalStrategy({ usernameField: 'email' }, loginHandler));
}

module.exports = localSetup;
