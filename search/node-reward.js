'use strict';

let _ = require('lodash');

function getPositiveWinOrLoss(game, player, initialNode) {
  let winners = game.getWinners();
  let isWinner = _.includes(winners, player);

  if (game.isTie() && isWinner) {
    return 0.5;
  }

  if (isWinner) {
    return 1;
  }

  return 0;
}

function getWinOrLoss(game, player, initialNode) {
  let winners = game.getWinners();
  let isWinner = _.includes(winners, player);

  if (game.isTie() && isWinner) {
    return 0;
  }

  if (isWinner) {
    return 1;
  }

  return -1;
}

function getScoresDifference(game, player, initialNode) {
  return game.getWonGames(player);
}

function decorateSearchAlgorithmReward(rewardFunction) {

  return function(searchAlgorithmInstance, options) {
    let NodeClass = searchAlgorithmInstance.getNodeClass();
    let DecoratedNodeClass = class extends NodeClass {};

    DecoratedNodeClass.getReward = rewardFunction;
    searchAlgorithmInstance.setNodeClass(DecoratedNodeClass);
  }
}

module.exports = {
  getPositiveWinOrLoss:   getPositiveWinOrLoss,
  getWinOrLoss:           getWinOrLoss,
  getScoresDifference:    getScoresDifference,
  decorateWithPositiveWinOrLossReward: decorateSearchAlgorithmReward(getPositiveWinOrLoss),
  decorateWithWinOrLossReward:         decorateSearchAlgorithmReward(getWinOrLoss),
  decorateWithScoresDifferenceReward:  decorateSearchAlgorithmReward(getScoresDifference),
};
