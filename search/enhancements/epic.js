'use strict';

let _ = require('lodash');
let sample = require('./../../utils/shuffle').sample;
let simulationPolicies = require('./simulation-policies');

function getPositionInEpisode(game) {
  let cardsInTrick = game.trick.reduce((count, card) => card !== null ? count + 1 : count, 0);

  if (cardsInTrick === 0 && game.lastTrick) {
    return game.lastTrick.length;
  }

  return cardsInTrick;
}

function getNextPositionInEpisode(game) {
  return game.trick.reduce((count, card) => card !== null ? count + 1 : count, 0) + 1;
}

function getPlayerBefore(player, numberOfPlayers) {
  return (player === 1) ? numberOfPlayers : player - 1;
}

function getEpisodeSequence(game, position, player) {
  let sequence = [];
  let trick = game.trick;
  let numberOfPlayers = game.trick.length;

  if (position === game.trick.length) {
    trick = game.lastTrick;
  }

  while(sequence.length < position) {
    sequence.push(trick[player - 1]);
    player = getPlayerBefore(player, numberOfPlayers);
  }

  return sequence.reverse();
}

function randomMoveSimulation(possibleMoves, rng) {
  return sample(possibleMoves, rng);
}

function selectWithSimulationPolicy(simulationPolicy, possibleMoves, rng, episodeMap, game) {
  if (possibleMoves.length === 1) {
    return possibleMoves[0];
  }

  let position = getNextPositionInEpisode(game);

  if (position === 0) {
    return randomMoveSimulation(possibleMoves, rng);
  }

  let beforeSequence = getEpisodeSequence(game, position - 1, getPlayerBefore(game.nextPlayer, game.trick.length));

  let possibleSequences = possibleMoves.map(move => {
    let sequence = beforeSequence.slice(0);
    sequence.push(move);
    return sequence.join('');
  });

  let possibleSequencesStats = possibleSequences.map(sequence => episodeMap[position].get(sequence));

  let unexploredSequenceMoves = possibleMoves.filter((move, moveIndex) => !possibleSequencesStats[moveIndex]);

  if (unexploredSequenceMoves.length > 0) {
    return randomMoveSimulation(unexploredSequenceMoves, rng);
  }

  let selectedSequenceIndex = simulationPolicy(possibleSequencesStats, rng);

  let selectedMove = possibleMoves[selectedSequenceIndex];

  if (!selectedMove) {
    throw new Error('nGram Gibbs distribution failed!');
  }

  return selectedMove;
}


function simulateWithEpisodes(simulationPolicy) {

  return function (deterministicGame, expandedNode) {

    let possibleMoves = deterministicGame.getPossibleMoves();
    let move;
    let simulatedMoves = [];

    while (!_.isEmpty(possibleMoves)) {
      move = selectWithSimulationPolicy(simulationPolicy, possibleMoves, this.rng, this.episodeMap, deterministicGame);
      let player = deterministicGame.nextPlayer;
      deterministicGame.performMove(move);

      let position = getPositionInEpisode(deterministicGame);
      let episodeSequence = getEpisodeSequence(deterministicGame, position, deterministicGame.nextPlayer);

      if (position > 0) {
        simulatedMoves.push({ player: player, episodeSequence: episodeSequence.join(''), position: position });
      }

      possibleMoves = deterministicGame.getPossibleMoves();
    }

    let getReward = _.memoize(expandedNode.getReward.bind(null), (game, player) => player);

    simulatedMoves.forEach(simulatedMove => {
      let reward = getReward(deterministicGame, simulatedMove.player);
      updateEpisodeStats(this.episodeMap, simulatedMove.position, simulatedMove.episodeSequence, reward);
    });

    return deterministicGame;
  }

}

function initializeEpisodeVariables(searchAlgorithmInstance) {
  let playerCount = searchAlgorithmInstance.game.getPlayerCount();

  searchAlgorithmInstance.episodeMap = _.range(playerCount).reduce((episodeMap, playerIndex) => {
    episodeMap[playerIndex + 1] = new Map();
    return episodeMap;
  }, {});
}

function updateEpisodeStats(episodeMap, position, episodeSequence, reward) {
  let episodeStats = episodeMap[position].get(episodeSequence);

  if (!episodeStats) {
    episodeStats = { reward: 0, count: 0 };
    episodeMap[position].set(episodeSequence, episodeStats);
  }

  episodeStats.reward += reward;
  episodeStats.count += 1;
}

let EPICBackpropagateMixin = (superclass) => class extends superclass {
  backPropagate(finishedGame) {
    let node = this;
    let getReward = _.memoize(node.getReward.bind(node), (game, player) => player);
    while (node != null) {
      let reward = getReward(finishedGame, node.player, this);
      node.visits += 1;
      node.wins += reward;

      let position = getPositionInEpisode(node.game);
      let episodeSequence = getEpisodeSequence(node.game, position, node.player);

      if (position && node !== null) {

        episodeSequence = episodeSequence.join('');

        updateEpisodeStats(this.mcts.episodeMap, position, episodeSequence, reward);
      }

      node = node.parent;
    }
  }
};

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance, options) {
    let NodeClass = searchAlgorithmInstance.getNodeClass();
    let EPICNodeClass = class extends EPICBackpropagateMixin(NodeClass) {};

    let simulationPolicyName = _.get(options, 'policy', 'ucb1');

    let getSimulationPolicyFunction = simulationPolicies[simulationPolicyName];
    let simulationPolicy = getSimulationPolicyFunction(options);

    initializeEpisodeVariables(searchAlgorithmInstance);

    searchAlgorithmInstance.simulate = simulateWithEpisodes(simulationPolicy);
    searchAlgorithmInstance.setNodeClass(EPICNodeClass);
  }
};
