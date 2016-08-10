'use strict';

const contra = require('contra');
const User = require('../models/User');
const Article = require('../models/Article');
const gravatarService = require('./gravatar');

function findContributors (done) {
  contra.waterfall([findUsers, countArticles], done);
}

function findUsers (done) {
  User
    .find({})
    .sort('created')
    .lean()
    .exec(done);
}

function countArticles (users, done) {
  contra.map(users, hydrateWithArticleCount, done);

  function hydrateWithArticleCount (user, next) {
    Article
      .count({ author: user._id, status: 'published' })
      .exec(counted);

    function counted (err, count) {
      if (err) {
        next(err); return;
      }
      next(null, {
        user: user,
        articleCount: count
      });
    }
  }
}

function getModel (email, password, bypass) {
  return {
    email: email,
    password: password,
    bypassEncryption: bypass,
    displayName: email.split('@')[0]
  };
}

function getProfile (contributor, options) {
  const rstrip = /^\s*<p>\s*|\s*<\/p>\s*$/ig;
  const user = contributor.user;
  const profile = {
    avatar: getAvatar(user),
    displayName: user.displayName,
    slug: user.slug,
    role: humanReadableRole(user.roles, contributor.articleCount !== 0),
    twitter: user.twitter,
    website: user.website
  };
  if (options.withBio) {
    profile.bioHtml = user.bioHtml.replace(rstrip, '');
  }
  return profile;
}

function getAvatar (user) {
  if (user.avatar) {
    return user.avatar;
  }
  if (user.email) {
    return gravatarService.format(user.email) + '&s=24';
  }
  return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mm&f=y&s=24';
}

function humanReadableRole (roles, hasPublishedArticles) {
  const terms = [];
  if (roles.indexOf('articles') !== -1 && hasPublishedArticles) {
    terms.push('Contributing Author');
  }
  if (roles.indexOf('moderator') !== -1) {
    terms.push('Contributing Editor');
  }
  if (roles.indexOf('moderator') !== -1) {
    terms.push('Moderator');
  }
  if (roles.indexOf('weeklies') !== -1) {
    terms.push('Pony Foo Weekly');
  }
  if (roles.indexOf('owner') !== -1) {
    return 'Founder';
  }
  if (terms.length) {
    return concatenate();
  }
  return 'Collaborator';
  function concatenate () {
    const firstTerm = terms.shift();
    return terms.reduce(termReducer, firstTerm);
  }
}

function termReducer (all, term, i, terms) {
  const len = terms.length;
  const separator = len > 1 ? ', ' : ' ';
  const joiner = len === i + 1 ? 'and ' : '';
  return all + separator + joiner + term;
}

function create (bypass) {
  return function creation (email, password, done) {
    const model = getModel(email, password, bypass);
    const user = new User(model);

    user.save(function saved (err) {
      done(err, user);
    });
  };
}

function findById (id, done) {
  User.findOne({ _id: id }, done);
}

function findOne (query, done) {
  User.findOne(query, done);
}

function setPassword (userId, password, done) {
  User.findOne({ _id: userId }, function found (err, user) {
    if(err || !user){
      return done(err, false);
    }

    user.password = password;
    user.save(done);
  });
}

function hasRole (user, roles) {
  return roles.some(userHasRole);
  function userHasRole (role) {
    return user.roles.indexOf(role) !== -1;
  }
}

function isActive (contributor) {
  const roles = contributor.user.roles;
  const singleRole = roles.length === 1;
  const articleUser = singleRole && roles[0] === 'articles';
  if (articleUser && contributor.articleCount === 0) {
    return false;
  }
  return true;
}

function canEditArticle (options) {
  if (!options.userId || !options.userRoles) {
    return false;
  }
  if (options.articleStatus === 'deleted') {
    return false;
  }
  return ( // owners. editors. authors working on drafts.
    options.userRoles.indexOf('owner') !== -1 ||
    options.userRoles.indexOf('editor') !== -1 || (
      options.userRoles.indexOf('articles') !== -1 &&
      options.authorId.equals(options.userId) &&
      options.articleStatus === 'draft'
    )
  );
}

module.exports = {
  findById,
  findOne,
  findContributors,
  create: create(false),
  createUsingEncryptedPassword: create(true),
  setPassword,
  getProfile,
  getAvatar,
  hasRole,
  isActive,
  canEditArticle
};
