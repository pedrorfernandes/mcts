'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
let shuffle = require('./../utils/shuffle').shuffle;
let sample = require('./../utils/shuffle').sample;
let Node = require('./node').Node;
let nodeReward = require('./node-reward');

class ISMCTSNode extends Node {
  expand(deterministicGame) {
    let children = this.getChildNodes();
    let untriedMoves = this.getUntriedMoves(deterministicGame);

    if (untriedMoves.length === 0) {
      return this;
    }

    let move = sample(untriedMoves, this.mcts.rng);
    let moveIndex = this.possibleMoves.indexOf(move);

    if(moveIndex === -1) {
      throw new Error('Get Possible Moves and Randomize game are not coherent')
    }

    let expanded = new ISMCTSNode({
      game: this.game,
      player: deterministicGame.nextPlayer,
      parent: this,
      move: move,
      depth: this.depth + 1,
      mcts: this.mcts
    });

    children[moveIndex] = expanded;

    deterministicGame.performMove(move);

    return expanded;
  }

  bestChild(explorationValue, deterministicGame) {
    let legalMoves = deterministicGame.getPossibleMoves();
    let legalChildren = this.getChildNodes().filter(function(node) {
      return node && legalMoves.indexOf(node.move) > -1;
    });

    // easier to update availability here instead of backprop
    legalChildren.forEach(node => node.avails += 1);

    let shuffled = shuffle(legalChildren, this.mcts.rng);
    return _.maxBy(shuffled, nodeValue.bind(null, explorationValue));
  }

  getMostVisitedChild() {
    return _.maxBy(this.children, 'visits');
  }
}

function select(node, deterministicGame) {
  while(!node.isTerminal() && _.isEmpty(node.getUntriedMoves(deterministicGame)) ) {
    node = node.bestChild(EXPLORATION_VALUE, deterministicGame);
    deterministicGame.performMove(node.move);
  }
  return node;
}

ISMCTS.prototype.simulate = function(deterministicGame) {
  let possibleMoves = deterministicGame.getPossibleMoves();
  let move;
  while(!_.isEmpty(possibleMoves)) {
    move = sample(possibleMoves, this.rng);
    deterministicGame.performMove(move);
    possibleMoves = deterministicGame.getPossibleMoves();
  }
  return deterministicGame;
};

let nodeValue = function(explorationValue, node) {
  return getUCB1(explorationValue, node);
};

let EXPLORATION_VALUE = 2 * Math.sqrt(2) / 2;
let NO_EXPLORATION = 0;
let getUCB1 = function (explorationValue, node) {
  if (explorationValue !== 0) {
    return (node.wins / node.visits)
      + explorationValue * Math.sqrt(Math.log(node.avails) / node.visits);
  }
  else {
    return (node.wins / node.visits);
  }
};

function ISMCTS(game, player, configs)  {
  this.game = game;
  this.iterations = configs.iterations || 1000;
  this.player = typeof player == 'undefined' ? 0 : player;
  this.rng = configs.rng ? configs.rng : randomGenerator(null, { state: true });

  let rewardFnName = _.get(configs, 'enhancements.reward', 'positive-win-or-loss');
  Node.prototype.getReward = nodeReward[rewardFnName];
}

ISMCTS.prototype.selectMove = function () {
  this.rootNode = new ISMCTSNode({
    game: this.game,
    player: this.game.nextPlayer,
    depth: 0,
    mcts: this
  });

  for(let i = 0; i < this.iterations; i ++) {
    let node = this.rootNode;
    let deterministicGame = node.determinize();
    node = select(node, deterministicGame);
    node = node.expand(deterministicGame);
    let finishedGame = this.simulate(deterministicGame);
    node.backPropagate(finishedGame);
  }

  return this.rootNode.getMostVisitedChild().move;
};

module.exports = ISMCTS;
