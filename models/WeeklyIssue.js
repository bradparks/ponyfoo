'use strict';

var mongoose = require('mongoose');
var commentSchema = require('./schemas/comment');
var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;
var schema = new mongoose.Schema({
  author: { type: ObjectId, index: { unique: false }, require: true, ref: 'User' },
  created: { type: Date, index: { unique: false }, require: true, 'default': Date.now },
  updated: { type: Date, require: true, 'default': Date.now },
  slug: { type: String, index: { unique: true }, require: true },
  publication: Date,
  status: { type: String, index: { unique: false }, require: true },
  statusReach: String, // [undefined, 'scheduled', 'patrons', 'everyone']
  thanks: String,
  issue: { type: Number, index: { unique: true, sparse: true }, require: false },
  title: String,
  titleText: String,
  titleHtml: String,
  summary: String,
  summaryText: String,
  summaryHtml: String,
  contentHtml: String,
  sections: [Mixed],
  comments: [commentSchema],
  email: { type: Boolean, 'default': true },
  tweet: { type: Boolean, 'default': true },
  fb: { type: Boolean, 'default': true },
  echojs: { type: Boolean, 'default': true },
  hn: { type: Boolean, 'default': true },
  hnDiscuss: String
});

schema.virtual('computedPageTitle').get(computePageTitle);
schema.virtual('computedIssueNumber').get(computeIssueNumber);
schema.virtual('computedTitle').get(computeTitle);
schema.virtual('computedName').get(computeName);

var model = mongoose.model('WeeklyIssue', schema);

module.exports = model;

function computePageTitle () {
  var title = this.computedTitle;
  var postfix = ' \u2014 Pony Foo Weekly';
  var postfixed = title + postfix;
  if (title === this.computedIssueNumber) {
    return postfixed;
  }
  return postfixed + ' #' + this.slug;
}

function computeTitle () {
  if (this.titleText) {
    return this.titleText;
  }
  return this.computedName;
}

function computeName () {
  if (this.issue) {
    return this.computedIssueNumber;
  }
  return this.slug;
}

function computeIssueNumber () {
  return 'Issue #' + this.issue;
}
