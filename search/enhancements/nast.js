'use strict';

let _ = require('lodash');
let sample = require('./../../utils/shuffle').sample;
let simulationPolicies = require('./simulation-policies');

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

function randomMoveSimulation(possibleMoves, rng) {
  return sample(possibleMoves, rng);
}

function selectWithSimulationPolicy(simulationPolicy, possibleMoves, rng, moveHistory, nGramPlayerStatistics, nGramLength) {
  if (possibleMoves.length === 1) {
    return possibleMoves[0];
  }

  if (moveHistory.length !== nGramLength - 1) {
    return randomMoveSimulation(possibleMoves, rng);
  }

  let nGram = moveHistory.join('');

  let relevantNGrams = possibleMoves.map(move => nGram + move);

  let relevantNGramStats = relevantNGrams.map(nGram => nGramPlayerStatistics.get(nGram));

  let unexploredNGramMoves = possibleMoves.filter((move, moveIndex) => !relevantNGramStats[moveIndex]);

  if (unexploredNGramMoves.length > 0) {
    return randomMoveSimulation(unexploredNGramMoves, rng);
  }

  if (relevantNGramStats.length === 1) {
    let nGramIndex = relevantNGramStats.indexOf(relevantNGramStats[0]);
    return possibleMoves[nGramIndex];
  }

  let selectedNGramIndex = simulationPolicy(relevantNGramStats, rng);

  let selectedMove = possibleMoves[selectedNGramIndex];

  if (!selectedMove) {
    throw new Error('nGram Gibbs distribution failed!');
  }

  return selectedMove;
}


function simulateWithNGrams(simulationPolicy) {

  return function (deterministicGame, expandedNode) {

    let possibleMoves = deterministicGame.getPossibleMoves();
    let move;
    let moveHistory = getMoveNGram(expandedNode, this.nGramLength) || [];
    while (!_.isEmpty(possibleMoves)) {
      moveHistory.shift();
      let playerNGramAverages = this.nGramAverages[deterministicGame.getNextPlayer()];
      move = selectWithSimulationPolicy(simulationPolicy, possibleMoves, this.rng, moveHistory, playerNGramAverages, this.nGramLength);
      moveHistory.push(move);
      deterministicGame.performMove(move);
      possibleMoves = deterministicGame.getPossibleMoves();
    }
    return deterministicGame;

  }

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
    let simulationPolicyName = _.get(options, 'policy', 'gibbs');

    let getSimulationPolicyFunction = simulationPolicies[simulationPolicyName];
    let simulationPolicy = getSimulationPolicyFunction(options);
    
    initializeNGramVariables(searchAlgorithmInstance, nGramLength);

    searchAlgorithmInstance.simulate = simulateWithNGrams(simulationPolicy);
    searchAlgorithmInstance.setNodeClass(NastNodeClass);
  }
};
