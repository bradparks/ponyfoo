'use strict';

var contra = require('contra');
var moment = require('moment');
var mongoose = require('mongoose');
var emailService = require('./email');
var userService = require('./user');
var env = require('../lib/env');
var UnverifiedUser = require('../models/UnverifiedUser');
var UserVerificationToken = require('../models/UserVerificationToken');
var User = require('../models/User');
var authority = env('AUTHORITY');
var ObjectId = mongoose.Types.ObjectId;

function createToken (user, done) {
  var token = new UserVerificationToken({
    targetId: user._id
  });
  token.save(function saved (err) {
    done(err, token);
  });
}

function getLink (token) {
  return '/account/verify-email/' + token._id;
}

function getExpiration (token) {
  return moment.utc(token.created).add(token.expires, 'seconds');
}

function sendEmail (user, token, done) {
  var link = getLink(token);
  var model = {
    to: user.email,
    subject: 'Account Email Verification',
    teaser: 'Action required to complete your account registration',
    validation: {
      link: link,
      expires: getExpiration(token).fromNow()
    },
    linkedData: {
      '@context': 'http://schema.org',
      '@type': 'EmailMessage',
      potentialAction: {
        '@type': 'ConfirmAction',
        name: 'Verify Email',
        handler: {
          '@type': 'HttpActionHandler',
          url: authority + link
        }
      },
      description: 'Verify Email – Pony Foo'
    }
  };
  emailService.send('verify-address', model);
  done();
}

function emitToken (user, done) {
  contra.waterfall([
    function creation (next) {
      createToken(user, next);
    },
    function notification (token, next) {
      sendEmail(user, token, next);
    }
  ], done);
}

function verifyToken (tokenId, done) {
  var result;

  contra.waterfall([
    function find (next) {
      UserVerificationToken.findOne({ _id: new ObjectId(tokenId) }, next);
    },
    function validateToken (token, next) {
      if (!token || token.used) {
        expired(next);
      } else {
        next(null, token);
      }
    },
    function validateExpiration (token, next) {
      var now = Date.now();
      var expiration = getExpiration(token).toDate();

      if (now > expiration) {
        expired(next);
      } else {
        next(null, token);
      }
    },
    function lookupUnverified (token, next) {
      UnverifiedUser.findOne({ _id: token.targetId }, function found (err, unverified) {
        next(err, token, unverified);
      });
    },
    function lookupVerified (token, unverified, next) {
      User.findOne({ email: unverified.email }, function found (err, user) {
        if (err) {
          next(err); return;
        }
        if (user) { // someone took the email address already.
          expired(next); return;
        }
        next(null, token, unverified);
      });
    },
    function useToken (token, unverified, next) {
      token.used = Date.now();
      token.save(function saved (err) {
        next(err, unverified);
      });
    },
    function createUser (unverified, next) {
      userService.createUsingEncryptedPassword(unverified.email, unverified.password, next);
    },
    function created (user, next) {
      next(null, {
        status: 'success',
        message: 'Thanks for validating your email address!',
        user: user
      });
    }
  ], function respond (err, user) {
    if(err === result) {
      return done(null, result);
    }
    done(err, user);
  });

  function expired (next) {
    result = {
      status: 'error',
      message: 'This validation token has expired'
    };
    next(result);
  }
}

module.exports = {
  emitToken: emitToken,
  verifyToken: verifyToken
};
