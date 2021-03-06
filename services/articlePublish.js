'use strict';

const but = require(`but`);
const contra = require(`contra`);
const Article = require(`../models/Article`);

function publish (model, done) {
  if (model.status !== `publish` || (model.publication && model.publication >= Date.now())) {
    done(null, false); return;
  }

  contra.waterfall([lookupPrevious, insertArticle, updatePrevious], published);

  function lookupPrevious (next) {
    Article.findOne({ status: `published` }).sort(`-publication`).exec(next);
  }

  function insertArticle (prev, next) {
    if (prev) {
      model.prev = prev._id;
    }
    model.publication = Date.now();
    model.status = `published`;
    model.comments = [];

    next(null, prev);
  }

  function updatePrevious (prev, next) {
    if (!prev) {
      next(); return;
    }
    prev.next = model._id;
    prev.save(but(next));
  }

  function published (err) {
    done(err, !err);
  }
}

module.exports = {
  publish: publish
};
