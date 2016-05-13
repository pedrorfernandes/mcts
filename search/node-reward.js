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

module.exports = {
  'positive-win-or-loss': getPositiveWinOrLoss,
  'win-or-loss': getWinOrLoss,
  'scores-difference': getScoresDifference
};
