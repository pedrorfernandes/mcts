'use strict';

let _ = require('lodash');
let Minimax = require('../minimax');

function countMovesLeft(game) {
  if (game.deck) {
    return _.flatten(game.hands).length + game.deck.length;
  }
  return _.flatten(game.hands).length;
}

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance, options) {
    let game = searchAlgorithmInstance.game;
    let maxMovesLeft = options.maxMovesLeft || 14;

    if (countMovesLeft(game) <= maxMovesLeft) {
      console.log('Switching to minimax');
      let minimax = new Minimax(searchAlgorithmInstance.game, searchAlgorithmInstance.player, options);
      searchAlgorithmInstance.selectMove = minimax.selectMove.bind(minimax);
    }
  }
};
