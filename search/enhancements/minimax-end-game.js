'use strict';

let _ = require('lodash');
let Minimax = require('../minimax');

function factorial(num) {
  let value = 1;
  for (var i = 2; i <= num; i++) {
    value = value * i;
  }
  return value;
}

function combinationsOf(n, r) {
  return factorial(n) / ( factorial(r) * factorial(n - r) );
}

function countPossibleCombinations(game) {
  let countUnknownCards = (count, card) => (card === null) ? count + 1 : count;

  let totalUnknownCards = _.flatten(game.hands).reduce(countUnknownCards, 0);

  return game.hands.reduce((acc, hand) => {
    let playerUnknownCards = hand.reduce(countUnknownCards, 0);
    return {
      combinations: acc.combinations * combinationsOf(acc.totalUnknownCards, playerUnknownCards),
      totalUnknownCards: acc.totalUnknownCards - playerUnknownCards
    }
  }, { combinations: 1, totalUnknownCards: totalUnknownCards });
}

function countMovesLeft(game) {
  if (game.deck) {
    return _.flatten(game.hands).length + game.deck.length;
  }
  return _.flatten(game.hands).length;
}

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance, options) {
    let game = searchAlgorithmInstance.game;
    let maxMovesLeft = options.maxMovesLeft || 13;

    if (!options.enhancements) {
      // this speeds up a lot when processing thousands of similar minimax's
      options.enhancements = [ { type: 'node-expansion', name: 'unification'} ];
    }

    if (countMovesLeft(game) <= maxMovesLeft) {
      console.log('Switching to minimax');
      let minimax = new Minimax(searchAlgorithmInstance.game, searchAlgorithmInstance.player, options);
      searchAlgorithmInstance.selectMove = minimax.selectMove.bind(minimax);
    }
  }
};
