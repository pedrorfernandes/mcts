'use strict';

let _ = require('lodash');
let sample = require('./../../utils/shuffle').sample;

// module configurable constants
let nGramMinimumCountThreshold;
let gibbsGreedyConstant;

function getMoveNGram(node, nGramLength) {
  let nGramMoveArray = [];
  for(let i = 0; i < nGramLength; i++) {
    if (node === null || node.move === null) {
      return null; // cant build nGram
    }
    nGramMoveArray.push(node.move);
    node = node.parent;
  }
  return nGramMoveArray.reverse();
}

function sumAll(sum, number) {
  return sum + number;
}

function toGibbsParcel(x) {
  return Math.exp(x / gibbsGreedyConstant)
}

function mapToGibbsDistribution(averages) {
  let sums = averages.map(toGibbsParcel);
  let sumAllParcels = sums.reduce(sumAll, 0);

  return sums.map(x => x / sumAllParcels);
}

function calculateNGramAverage(nGramStatistics) {
  if (!nGramStatistics) {
    throw new Error('nGramStatistics must be a valid object!')
  }

  return nGramStatistics.reward / nGramStatistics.count;
}

function selectRandomIndexWithOdds(odds, rng) {
  let cumulativeOdds = odds.reduce((cumulativeOdds, odd, index) => {
    let cumulativeOdd = index === 0 ? odd : odd + cumulativeOdds[index - 1];
    cumulativeOdds.push(cumulativeOdd);
    return cumulativeOdds;
  }, []);

  let randomNumber = rng();

  return _.findIndex(cumulativeOdds, odd => randomNumber <= odd);
}

function randomMoveSimulation(possibleMoves, rng) {
  return sample(possibleMoves, rng);
}

function nGramsGibbsDistributionSelection(possibleMoves, rng, moveHistory, nGramPlayerStatistics, nGramLength) {
  if (possibleMoves.length === 1) {
    return possibleMoves[0];
  }

  if (moveHistory.length !== nGramLength - 1) {
    return randomMoveSimulation(possibleMoves, rng);
  }

  let nGram = moveHistory.join('');

  let relevantNGrams = possibleMoves.map(move => nGram + move);

  let relevantNGramAverages = relevantNGrams.map(nGram => nGramPlayerStatistics.get(nGram));

  let unexploredNGramMoves = possibleMoves.filter((move, moveIndex) => {
    let nGramAverage = relevantNGramAverages[moveIndex];
    return !nGramAverage || nGramAverage.count <= nGramMinimumCountThreshold;
  });

  if (unexploredNGramMoves.length > 0) {
    return randomMoveSimulation(unexploredNGramMoves, rng);
  }

  if (relevantNGramAverages.length === 1) {
    let nGramIndex = relevantNGramAverages.indexOf(relevantNGramAverages[0]);
    return possibleMoves[nGramIndex];
  }

  let nGramAverages = relevantNGramAverages.map(calculateNGramAverage);

  let gibbsDistribution = mapToGibbsDistribution(nGramAverages);

  let selectedNGramIndex = selectRandomIndexWithOdds(gibbsDistribution, rng);

  let selectedMove = possibleMoves[selectedNGramIndex];

  if (!selectedMove) {
    throw new Error('nGram Gibbs distribution failed!');
  }

  return selectedMove;
}


function simulateWithNGrams(deterministicGame, expandedNode) {
  let possibleMoves = deterministicGame.getPossibleMoves();
  let move;
  let moveHistory = getMoveNGram(expandedNode, this.nGramLength) || [];
  while(!_.isEmpty(possibleMoves)) {
    moveHistory.shift();
    let playerNGramAverages = this.nGramAverages[deterministicGame.getNextPlayer()];
    move = nGramsGibbsDistributionSelection(possibleMoves, this.rng, moveHistory, playerNGramAverages, this.nGramLength);
    moveHistory.push(move);
    deterministicGame.performMove(move);
    possibleMoves = deterministicGame.getPossibleMoves();
  }
  return deterministicGame;
}

function initializeNGramVariables(searchAlgorithmInstance, nGramLength) {
  searchAlgorithmInstance.nGramLength = nGramLength;
  let playerCount = searchAlgorithmInstance.game.getPlayerCount();

  searchAlgorithmInstance.nGramAverages = _.range(playerCount).reduce((nGramAverages, playerIndex) => {
    nGramAverages[playerIndex + 1] = new Map();
    return nGramAverages;
  }, {});
}

let NASTBackpropagateMixin = (superclass) => class extends superclass {
  backPropagate(finishedGame) {
    let node = this;
    let getReward = _.memoize(node.getReward.bind(node), (game, player) => player);
    while (node != null) {
      let reward = getReward(finishedGame, node.player, this);
      node.visits += 1;
      node.wins += reward;

      let nGram = getMoveNGram(node, this.mcts.nGramLength);

      if (nGram && node !== null) {

        nGram = nGram.join('');

        let nGramAverage = this.mcts.nGramAverages[node.player].get(nGram);

        if (!nGramAverage) {
          nGramAverage = { reward: 0, count: 0 };
          this.mcts.nGramAverages[node.player].set(nGram, nGramAverage);
        }

        nGramAverage.reward += reward;
        nGramAverage.count += 1;
      }

      node = node.parent;
    }
  }
};

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance, options) {
    let NodeClass = searchAlgorithmInstance.getNodeClass();
    let NastNodeClass = class extends NASTBackpropagateMixin(NodeClass) {};

    let nGramLength = _.get(options, 'nGramLength', 2);
    // the lower the constant, the greedier the move simulation selection
    // τ ∈ {0.05, 0.1, 0.15, 0.2, 0.25, 0.5, 1, 1.5, 2, 4}
    gibbsGreedyConstant = _.get(options, 'gibbsGreedyConstant', 1.0);
    // For ε-greedy, ε ∈ {0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6} was tested and ε = 0.2 found to be best

    // minimum times an nGram was counted for it to be reliable measure
    nGramMinimumCountThreshold = _.get(options, 'nGramMinimumCountThreshold', 7);

    initializeNGramVariables(searchAlgorithmInstance, nGramLength);

    searchAlgorithmInstance.simulate = simulateWithNGrams;
    searchAlgorithmInstance.setNodeClass(NastNodeClass);
  }
};
