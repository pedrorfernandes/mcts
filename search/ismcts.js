/*jslint nomen: true */
/*jslint indent: 2 */
'use strict';

var _ = require('lodash');
var randomGenerator = require('seedrandom');
var shuffle = require('./shuffle').shuffle;
var sample = require('./shuffle').sample;
var Node = require('./node').Node;

class ISMCTSNode extends Node {
  expand(deterministicGame) {
    var children = this.getChildNodes();
    var untriedMoves = this.getUntriedMoves(deterministicGame);

    if (untriedMoves.length === 0) {
      return this;
    }

    var move = sample(untriedMoves, this.mcts.rng);
    var moveIndex = this.possibleMoves.indexOf(move);

    if(moveIndex === -1) {
      throw new Error('Get Possible Moves and Randomize game are not coherent')
    }

    var expanded = new ISMCTSNode({
      game: this.game,
      parent: this,
      move: move,
      depth: this.depth + 1,
      mcts: this.mcts
    });

    children[moveIndex] = expanded;

    deterministicGame.performMove(move);

    return expanded;
  }

  getReward(deterministicGame) {
    var winner = deterministicGame.getWinner();

    var playerForThisNode = this.parent ? this.parent.game.currentPlayer : this.game.currentPlayer;

    if (Array.isArray(winner) && _.contains(winner, playerForThisNode)) {
      return 1;
    }
    else if (playerForThisNode === winner) {
      return 1;
    }
    return 0;
  }

  backPropagate(finishedGame) {
    var node = this;
    while (node != null) {
      node.visits += 1;
      node.wins += node.getReward(finishedGame);
      node = node.parent;
    }
  }

  bestChild(explorationValue, deterministicGame) {
    var legalMoves = deterministicGame.getPossibleMoves();
    var legalChildren = this.getChildNodes().filter(function(node) {
      return node && legalMoves.indexOf(node.move) > -1;
    });

    // easier to update availability here instead of backprop
    legalChildren.forEach(function(node) {
      node.avails += 1;
    });

    var shuffled = shuffle(legalChildren, this.mcts.rng);
    return _.max(shuffled, nodeValue.bind(null, explorationValue));
  }

  getMostVisitedChild() {
    return _.max(this.children, 'visits');
  }

  determinize() {
    var clone = new ISMCTSNode(this);
    clone.game = clone.game.randomize(this.mcts.rng, this.mcts.player);
    return clone.game;
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
  var possibleMoves = deterministicGame.getPossibleMoves();
  while(!_.isEmpty(possibleMoves)) {
    var move = sample(possibleMoves, this.rng);
    deterministicGame.performMove(move);
    possibleMoves = deterministicGame.getPossibleMoves();
  }
  return deterministicGame;
};

var nodeValue = function(explorationValue, node) {
  return getUCB1(explorationValue, node);
};

var EXPLORATION_VALUE = Math.sqrt(2) / 2;
var NO_EXPLORATION = 0;
var getUCB1 = function (explorationValue, node) {
  if (explorationValue !== 0) {
    return (node.wins / node.visits)
      + explorationValue * Math.sqrt(Math.log(node.avails) / node.visits);
  }
  else {
    return (node.wins / node.visits);
  }
};

function ISMCTS(game, iterations, player, seed) {
  this.game = game;
  this.iterations = iterations || 1000;
  this.player = typeof player == 'undefined' ? 0 : player;
  this.rng = seed ? randomGenerator(seed, {state: true}) : randomGenerator(null, {state: true});
}

ISMCTS.prototype.selectMove = function () {
  this.rootNode = new ISMCTSNode({
    game: this.game,
    depth: 0,
    mcts: this
  });

  for(var i = 0; i < this.iterations; i ++) {
    var node = this.rootNode;
    var deterministicGame = node.determinize();
    node = select(node, deterministicGame);
    node = node.expand(deterministicGame);
    var finishedGame = this.simulate(deterministicGame);
    node.backPropagate(finishedGame);
  }

  return this.rootNode.getMostVisitedChild().move;
};

exports.ISMCTS = ISMCTS;
