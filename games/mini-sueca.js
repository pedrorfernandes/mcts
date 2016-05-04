'use strict';

var _ = require('lodash');

var Sueca = require('./sueca.js');

var discardedCards = [
  ["A♠","7♠","J♠","6♠","5♠","4♠","3♠"],
  ["A♥","7♥","J♥","6♥","5♥","4♥","3♥"],
  ["A♦","7♦","J♦","6♦","5♦","4♦","3♦"],
  ["A♣","7♣","J♣","6♣","5♣","4♣","3♣"]
];

class MiniSueca extends Sueca {
  constructor(options) {

    // advance initial state to a sueca end game
    if (_.isEqual(options.wonCards, [[], [], [], []]) ) {
      options.wonCards = discardedCards;

      // round = 11 - initialCardNumber
      options.round = 8
    }

    super(options);
  }
}

module.exports = MiniSueca;
