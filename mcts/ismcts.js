/*jslint nomen: true */
/*jslint indent: 2 */
'use strict';

var _ = require('lodash');
var randomGenerator = require('seedrandom');
var shuffle = require('./shuffle');

var sample = function(array, rng) {
  return array[Math.floor(rng() * array.length)];
};

function Node(options) {
  this.game = new options.game.constructor(options.game);
  this.mcts = options.mcts;
  this.parent = options.parent || null;
  this.move = typeof options.move != 'undefined' ? options.move : null;
  this.wins = 0;
  this.visits = 0;
  this.children = null;
  this.depth = options.depth || 0;
  this.possibleMoves = null;
  this.avails = 1;

  if (this.move !== null) {
    this.game.performMove(this.move);
  }
}

function isExpanded(node) {
  return node !== null;
}

function getMove(node) {
  return node.move;
}

Node.prototype.getUntriedMoves = function(deterministicGame) {
  var triedMoves = this.getChildNodes().filter(isExpanded).map(getMove);
  var legalMoves = deterministicGame.getPossibleMoves();
  return _.difference(legalMoves, triedMoves);
};

Node.prototype.isTerminal = function() {
  return _.isEmpty(this.getChildNodes());
};

Node.prototype.expand = function(deterministicGame) {
  var children = this.getChildNodes();
  var untriedMoves = this.getUntriedMoves(deterministicGame);

  if (untriedMoves.length === 0) {
    return this;
  }

  var move = sample(untriedMoves, this.mcts.rng);
  var moveIndex = this.possibleMoves.indexOf(move);

  var expanded = new Node({
    game: this.game,
    parent: this,
    move: move,
    depth: this.depth + 1,
    mcts: this.mcts
  });

  children[moveIndex] = expanded;

  deterministicGame.performMove(move);

  return expanded;
};

function select(node, deterministicGame) {
  while(!node.isTerminal() && _.isEmpty(node.getUntriedMoves(deterministicGame)) ) {
    node = node.bestChild(EXPLORATION_VALUE, deterministicGame);
    deterministicGame.performMove(node.move);
  }
  return node;
}

ISMCTS.prototype.getReward = function(deterministicGame) {
  var winner = deterministicGame.getWinner();

  if (Array.isArray(winner) && _.contains(winner, this.player)) {
    return 1;
  }
  else if (this.player === winner) {
    return 1;
  }
  return 0;
};

ISMCTS.prototype.simulate = function(deterministicGame) {
  var possibleMoves = deterministicGame.getPossibleMoves();
  while(!_.isEmpty(possibleMoves)) {
    var move = sample(possibleMoves, this.rng);
    deterministicGame.performMove(move);
    possibleMoves = deterministicGame.getPossibleMoves();
  }
  return this.getReward(deterministicGame);
};

Node.prototype.backPropagate = function(reward) {
  var node = this;
  while (node != null) {
    node.visits += 1;
    node.wins += reward;
    node = node.parent;
  }
};

Node.prototype.getChildNodes = function() {
  if (!this.children) {
    this.possibleMoves = this.game.getPossibleMoves(this.mcts.player);
    this.children = _.fill(new Array(this.possibleMoves.length), null);
  }
  return this.children;
};

Node.prototype.bestChild = function(explorationValue, deterministicGame) {
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
};

Node.prototype.getMostVisitedChild = function() {
  return _.max(this.children, 'visits');
};

var nodeValue = function(explorationValue, node) {
  return getUCB1(explorationValue, node);
};

var EXPLORATION_VALUE = Math.sqrt(2);
var NO_EXPLORATION = 0;
var getUCB1 = function (explorationValue, node) {
  if (explorationValue !== 0) {
    return (node.wins / node.visits)
      + explorationValue * Math.sqrt(2 * Math.log(node.avails) / node.visits);
  }
  else {
    return (node.wins / node.visits);
  }
};

Node.prototype.determinize = function() {
  var clone = new Node(this);
  clone.game = clone.game.randomize(this.mcts.rng, this.mcts.player);
  return clone.game;
};

function ISMCTS(game, iterations, player, seed) {
  this.game = game;
  this.iterations = iterations || 1000;
  this.player = typeof player == 'undefined' ? 0 : player;
  this.rng = seed ? randomGenerator(seed) : randomGenerator();
}

ISMCTS.prototype.selectMove = function () {
  this.rootNode = new Node({
    game: this.game,
    depth: 0,
    mcts: this
  });

  for(var i = 0; i < this.iterations; i ++) {
    var node = this.rootNode;
    var deterministicGame = node.determinize();
    node = select(node, deterministicGame);
    node = node.expand(deterministicGame);
    var reward = this.simulate(deterministicGame);
    node.backPropagate(reward);
  }

  return this.rootNode.getMostVisitedChild().move;
};

exports.ISMCTS = ISMCTS;
