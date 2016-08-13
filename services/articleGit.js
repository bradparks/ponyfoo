'use strict';

const fs = require('fs');
const but = require('but');
const path = require('path');
const mkdirp = require('mkdirp');
const contra = require('contra');
const moment = require('moment');
const winston = require('winston');
const simpleGit = require('simple-git');
const env = require('../lib/env');
const htmlService = require('../services/html');
const emojiService = require('../services/emoji');
const articleService = require('../services/article');
const settingService = require('../services/setting');
const Article = require('../models/Article');
const webroot = env('GIT_ARTICLES_WEB');
const enabled = env('GIT_ARTICLES_SYNC');
const authority = env('AUTHORITY');
const repository = path.join(process.cwd(), 'sync');
const git = simpleGit(repository);
const rsyncroot = /^\d{4}\/\d{2}-\d{2}--[a-z0-9-]+$/i;

function isEnabled (next, done) {
  settingService.getKey('ARTICLE_GIT', got);
  function got (err, enabledSetting) {
    if (err) {
      done(err); return;
    }
    if (!enabled || !enabledSetting) {
      winston.debug('Article git synchronization is disabled.');
      done(null);
      return;
    }
    next();
  }
}

function getGitSlug (article, oldSlug) {
  const date = moment.utc(article.created).format('YYYY/MM-DD--');
  const slug = oldSlug || article.slug;
  const gitSlug = date + slug;
  return gitSlug;
}

function getGitDirectory (article, oldSlug) {
  const gitSlug = getGitSlug(article, oldSlug);
  return path.join(repository, gitSlug);
}

function updateSyncRoot (article, done) {
  if (!enabled) {
    winston.debug('Article git synchronization is disabled.');
    done(null);
    return;
  }
  const gitDirectory = getGitDirectory(article);
  const gitPath = file => path.join(gitDirectory, file);
  const files = {
    [gitPath('metadata.json')]: JSON.stringify({
      id: article._id,
      author: article.author._id || article.author,
      title: article.titleMarkdown,
      slug: article.slug,
      tags: article.tags,
      heroImage: article.heroImage || null
    }, null, 2),
    [gitPath('summary.markdown')]: article.summary,
    [gitPath('teaser.markdown')]: article.teaser,
    [gitPath('editor-notes.markdown')]: article.editorNote,
    [gitPath('introduction.markdown')]: article.introduction,
    [gitPath('body.markdown')]: article.body,
    [gitPath('readme.markdown')]: htmlService.downgradeEmojiImages(htmlService.absolutize([
      tag(`🚨 ${tag('Autogenerated!', 'strong')} See ${link(
        tag('contributing.markdown', 'code'),
        `${webroot}contributing.markdown`
      )} for details. See also: ${link(
        'web version',
        `${authority}/articles/${article.slug}`
      )}.`, 'sub'),
      link(
        tag(article.heroImage ? `<img src='${article.heroImage}' alt='${article.title}' />` : ''),
        `${authority}/articles/${article.slug}`
      ),
      tag(article.titleHtml, 'h1'),
      tag(article.tags.map(tagText => tag(tagText, 'kbd')).join(' '), 'p'),
      tag(article.summaryHtml, 'blockquote'),
      tag(article.teaserHtml),
      tag(article.editorNoteHtml),
      tag(article.introductionHtml),
      tag(article.bodyHtml)
    ].join('\n\n')))
  };
  const filenames = Object.keys(files);

  contra.series([
    next => mkdirp(gitDirectory, next),
    next => contra.concurrent(filenames.map(filename =>
      next => write(filename, files[filename], next)
    ), next)
  ], err => done(err, filenames));

  function tag (html, tagName) {
    tagName = tagName || 'div';
    return `<${tagName}>${html || ''}</${tagName}>`;
  }

  function link (html, href) {
    return `<a href='${href}'>${html}</a>`;
  }

  function write (filename, data, done) {
    fs.writeFile(filename, trimRight(data) + '\n', 'utf8', done);
  }
}

function pushToGit (options, done) {
  isEnabled(function () {
    const article = options.article;
    const oldSlug = options.oldSlug;
    const tasks = [
      next => git.pull(next),
      next => updateSyncRoot(article, next),
      removeOldSources,
      commitNewSources
    ];
    contra.series(tasks, done);

    function removeOldSources (next) {
      if (oldSlug === article.slug) {
        next(); return;
      }
      const gitSlug = getGitSlug(article, oldSlug);
      git.rm(`${gitSlug}*`, next);
    }

    function commitNewSources (next) {
      const gitSlug = getGitSlug(article);
      const emoji = emojiService.randomFun();
      const commitMessage = `[sync] Updating “${article.slug}” article. ${emoji}`;

      contra.series([
        next => git.add(gitSlug, next),
        next => git.commit(commitMessage, next),
        next => git.push(next)
      ], next);
    }
  }, done);
}

function removeFromGit (article, done) {
  isEnabled(function () {
    const gitSlug = getGitSlug(article);
    const commitMessage = `[sync] Removing “${article.slug}” article. ${emojiService.randomFun()}`;
    contra.series([
      next => git.pull(next),
      next => git.rm(`${gitSlug}*`, next),
      next => git.commit(commitMessage, next),
      next => git.push(next)
    ], done);
  }, done);
}

function pullFromGit (event, done) {
  const end = done || log;

  isEnabled(function () {
    const removals = intoChangeDirectories(event.payload.commits
      .reduce((all, commit) => all.concat(commit.removed), [])
      .filter(file => path.basename(file) === 'metadata.json')
    );
    const modifications = intoChangeDirectories(event.payload.commits
      .reduce((all, commit) => all.concat(commit.modified), [])
    );

    if (removals.length === 0 && modifications.length === 0) {
      end(null); return;
    }

    contra.series([
      next => contra.each.series(removals, removeArticle, next),
      next => git.pull(next),
      next => contra.each.series(modifications, updateArticle, next)
    ], end);

    function intoChangeDirectories (list) {
      return list
        .map(file => path.dirname(file))
        .filter(dir => rsyncroot.test(dir))
        .map(dir => path.join(repository, dir));
    }

    function removeArticle (dir, next) {
      const metadata = path.join(dir, 'metadata.json');
      contra.waterfall([
        next => fs.readFile(metadata, 'utf8', next),
        (metadata, next) => next(null, JSON.parse(metadata)),
        (metadata, next) => Article.findOne({
          _id: metadata.id,
          author: metadata.author
        }, next),
        (article, next) => {
          articleService.remove(article, next);
        }
      ], next);
    }

    function updateArticle (dir, next) {
      const readFile = file => next => fs.readFile(path.join(dir, file), 'utf8', next);

      contra.concurrent({
        metadata: readFile('metadata.json'),
        summary: readFile('summary.markdown'),
        teaser: readFile('teaser.markdown'),
        editorNote: readFile('editor-notes.markdown'),
        introduction: readFile('introduction.markdown'),
        body: readFile('body.markdown')
      }, mergeFiles);

      function mergeFiles (err, data) {
        if (err) {
          next(err); return;
        }
        const metadata = JSON.parse(data.metadata);
        const query = {
          _id: metadata.id,
          author: metadata.author
        };

        Article.findOne(query).exec(found);

        function found (err, article) {
          if (err) {
            next(err); return;
          }
          if (!article) {
            next(new Error('Article couldn\'t be found!')); return;
          }
          const fromGit = {
            status: article.status,
            titleMarkdown: metadata.title,
            slug: metadata.slug,
            tags: metadata.tags,
            heroImage: metadata.heroImage || '',
            summary: trimRight(data.summary),
            teaser: trimRight(data.teaser),
            editorNote: trimRight(data.editorNote),
            introduction: trimRight(data.introduction),
            body: trimRight(data.body)
          };
          const sign = articleService.computeSignature(fromGit);
          if (sign === article.sign) {
            next(null); return;
          }
          article.titleMarkdown = fromGit.titleMarkdown;
          article.slug = fromGit.slug;
          article.summary = fromGit.summary;
          article.teaser = fromGit.teaser;
          article.editorNote = fromGit.editorNote;
          article.introduction = fromGit.introduction;
          article.body = fromGit.body;
          article.tags = fromGit.tags;
          article.heroImage = fromGit.heroImage;
          article.save(but(next));
        }
      }
    }
  }, end);
}

function log (err) {
  if (err) {
    winston.warn('Error pulling commit information from git', err.stack || err);
  }
}

function trimRight (text) {
  const rtrailingnewline = /\n+$/;
  return (text || '').replace(rtrailingnewline, '');
}

module.exports = {
  updateSyncRoot,
  pushToGit,
  removeFromGit,
  pullFromGit
};
