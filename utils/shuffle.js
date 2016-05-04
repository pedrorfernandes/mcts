'use strict';

var randGen = require('seedrandom');

function shuffle(array, rng) {
  var currentIndex;
  var temporaryValue;
  var randomIndex;
  var rand;

  if (rng == null) rand = randGen();
  else             rand = rng;

  if (array.constructor !== Array) throw new Error('Input is not an array');
  currentIndex = array.length;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(rand() * (currentIndex --));

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array
}

function sample(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

module.exports = {
  shuffle: shuffle,
  sample: sample
};
