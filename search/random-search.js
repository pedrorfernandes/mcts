'use strict';

var randomGenerator = require('seedrandom');
var sample = require('./../utils/shuffle').sample;

class RandomSearch {

  constructor(game, player, configs) {
    this.game = game;
    this.player = typeof player == 'undefined' ? 0 : player;
    if (configs.rng) {
      this.rng = configs.rng;
    } else {
      this.rng = randomGenerator(null, { state: true });
    }
  }

  selectMove() {
    return sample(this.game.getPossibleMoves(), this.rng);
  }
}

module.exports = RandomSearch;
