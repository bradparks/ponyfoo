'use strict';

var twemoji = require('twemoji');
var emojiOpts = {
  base: 'https://twemoji.maxcdn.com/2/',
  className: 'tj-emoji',
  size: 72
};
var funEmoji = [
  '🐺', '🐸', '🐯', '🐗', '🐴', '🦄', '🐑', '🐘', '🐼', '🐦', '🐣',
  '🐍', '🐢', '🐙', '🐠', '🐟', '🐬', '🐳', '🐋', '🐏', '🐇', '🐉', '🐐', '🐓', '🐲', '🐊',
  '🍩', '🍮', '🍯', '🍎', '🍏', '🍊', '🍋', '🍒', '🍇', '🍉', '🍓',
  '🍑', '🍈', '🍌', '🍐', '🍍', '🍠', '🍆', '🍅', '🌽',
  '⛵', '🚤', '🚣', '✈', '🚁', '🚂', '🚊', '🚉', '🚆', '🚄', '🚅',
  '🚈', '🚝', '🚙', '🚗', '🚛', '🚲', '🚜', '🚚', '🚗', '🚕',
  '🔥', '✨', '🌟', '💫', '💥', '🎉', '🎊', '🎨', '🌙', '⭐', '🔱', '⛅', '⚡',
  '👑', '🏆', '🔮', '🔬', '🔭', '🚀', '💎', '🎃', '👻', '🎅', '🎁',
  '🙇', '😍', '😘', '😻', '👒', '💼', '👜', '👝', '👛', '🎒', '🎓',
  '💛', '💙', '💜', '💚', '💗', '💓', '💕', '💖', '💝', '💞', '💘',
  '🍦', '🍨', '🍧', '🎂', '🍰', '🍪', '🍫', '🍬', '🍭',
  '🍕', '🍟', '🍝', '🍛', '🍤', '🍣', '🍥',
  '🍻', '🍸', '🍹', '🍷'
];
var mailEmoji = [
  '✉️️', '💌', '📥', '📤', '📬', '📩', '📮', '📪', '📫', '📬', '📭'
];

function random (list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomFun () {
  return random(funEmoji);
}

function randomMailEmoji () {
  return random(mailEmoji);
}

function compile (text) {
  return twemoji.parse(text, emojiOpts);
}

module.exports = {
  compile: compile,
  randomFun: randomFun,
  randomMailEmoji: randomMailEmoji
};
