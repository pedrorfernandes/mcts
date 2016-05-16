'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
let shuffle = require('./../utils/shuffle').shuffle;
let sample = require('./../utils/shuffle').sample;
let Node = require('./node').Node;
let nodeReward = require('./node-reward');
let fs = require('fs');
const enhancementsConfig = require(__dirname + '/../config.js').enhancements;

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

    let expanded = new this.mcts.NodeClass({
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

function select(node, deterministicGame, explorationConstant) {
  while(!node.isTerminal() && _.isEmpty(node.getUntriedMoves(deterministicGame)) ) {
    node = node.bestChild(explorationConstant, deterministicGame);
    deterministicGame.performMove(node.move);
  }
  return node;
}

ISMCTS.prototype.simulate = function(deterministicGame, expandedNode) {
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

let NO_EXPLORATION = 0;
let getUCB1 = function (explorationValue, node) {
  if (explorationValue !== 0) {
    return (node.wins / node.visits) + explorationValue * Math.sqrt(Math.log(node.avails) / node.visits);
  } else {
    return (node.wins / node.visits);
  }
};

function ISMCTS(game, player, options)  {
  this.game = game;
  this.iterations = options.iterations || 1000;
  this.player = typeof player == 'undefined' ? 0 : player;
  this.rng = options.rng ? options.rng : randomGenerator(null, { state: true });

  this.explorationConstant = _.get(options, 'explorationConstant', (Math.sqrt(2) / 2) );
  let rewardFnName = _.get(options, 'enhancements.reward', 'positive-win-or-loss');
  let simulationEnhancement = _.get(options, 'enhancements.simulation', null);

  Node.prototype.getReward = nodeReward[rewardFnName];
  this.NodeClass = ISMCTSNode;

  if (simulationEnhancement) {
    let modulePath = enhancementsConfig.simulation[simulationEnhancement].module;
    let enhancementModule = require(modulePath);
    enhancementModule.decorateSearchAlgorithm(this);
  }
}

ISMCTS.prototype.getNodeClass = function() {
  return this.NodeClass;
};

ISMCTS.prototype.setNodeClass = function(NodeClass) {
  this.NodeClass = NodeClass;
};

ISMCTS.prototype.selectMove = function () {
  this.rootNode = new this.NodeClass({
    game: this.game,
    player: this.game.nextPlayer,
    depth: 0,
    mcts: this
  });

  for(let i = 0; i < this.iterations; i ++) {
    let node = this.rootNode;
    let deterministicGame = node.determinize();
    node = select(node, deterministicGame, this.explorationConstant);
    node = node.expand(deterministicGame);
    let finishedGame = this.simulate(deterministicGame, node);
    node.backPropagate(finishedGame);
  }

  return this.rootNode.getMostVisitedChild().move;
};

module.exports = ISMCTS;
