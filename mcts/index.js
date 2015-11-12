/*jslint nomen: true */
/*jslint indent: 2 */
'use strict';

var _ = require('lodash');

function Node(options) {
  this.game = _.extend(new options.game.constructor(), _.cloneDeep(options.game));
  this.mcts = options.mcts;
  this.parent = options.parent || null;
  this.move = typeof options.move != 'undefined' ? options.move : null;
  this.wins = 0;
  this.visits = 0;
  this.children = null;
  this.depth = options.depth || 0;
  this.possibleMoves = null;

  if (this.move !== null) {
    this.game.performMove(this.move);
  }
}

function isNotExpanded(node) {
  return node === null;
}

Node.prototype.isExpandable = function() {
  return !this.isTerminal() && _.some(this.getChildNodes(), isNotExpanded);
};

Node.prototype.isTerminal = function() {
  return this.game.getWinner() != null || _.isEmpty(this.getChildNodes());
};

Node.prototype.expand = function() {
  var children = this.getChildNodes();

  var possibleMovesIndexArray = this.possibleMoves.map(function(value, index) {
    return index;
  });

  var moveIndex = _(possibleMovesIndexArray)
    .filter(function(index) {
      return isNotExpanded(children[index]);
    })
    .sample();

  var expanded = new Node({
    game: this.game,
    parent: this,
    move: this.possibleMoves[moveIndex],
    depth: this.depth + 1,
    mcts: this.mcts,
    expanded: true
  });

  children[moveIndex] = expanded;

  return expanded;
};

function treePolicy(node) {
  while(!node.isTerminal()) {
    if (node.isExpandable()) {
      return node.expand();
    }
    else {
      node = node.bestChild(EXPLORATION_VALUE);
    }
  }
  return node;
}

Node.prototype.getReward = function() {
  if (this.mcts.player === this.game.getWinner()) {
    return 1;
  }
  return 0;
};

Node.prototype.pickChild = function() {
  var move = _.sample(this.game.getPossibleMoves());

  return new Node({
    game: this.game,
    parent: this,
    move: move,
    depth: this.depth + 1,
    mcts: this.mcts
  });
};

function defaultPolicy(node) {
  while(!node.isTerminal()) {
    node = node.pickChild();
  }
  return node.getReward();
}

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
    this.possibleMoves = this.game.getPossibleMoves();
    this.children = _.fill(new Array(this.possibleMoves.length), null);
  }
  return this.children;
};

Node.prototype.bestChild = function(explorationValue) {
  return _(this.getChildNodes())
    .shuffle()
    .max(nodeValue.bind(null, explorationValue));
};

var nodeValue = function(explorationValue, node) {
  if (node.parent.game.getCurrentPlayer() === node.mcts.player) {
    return getUCB1(explorationValue, node);
  }
  return - node.visits;
};

var EXPLORATION_VALUE = 0.70710678118;
var NO_EXPLORATION = 0;
var getUCB1 = function (explorationValue, node) {
  if (explorationValue !== 0) {
    return (node.wins / node.visits)
      + explorationValue * Math.sqrt(2 * Math.log(node.parent.visits) / node.visits);
  }
  else {
    return (node.wins / node.visits);
  }
};

function MCTS(game, iterations, player) {
  this.game = game;
  this.iterations = iterations || 1000;
  this.player = player || 0;
}

MCTS.prototype.selectMove = function () {
  this.rootNode = new Node({
    game: this.game,
    depth: 0,
    mcts: this
  });

  for(var i = 0; i < this.iterations; i ++) {
    var selectedNode = treePolicy(this.rootNode);
    var reward = defaultPolicy(selectedNode);
    selectedNode.backPropagate(reward);
  }

  return this.rootNode.bestChild(NO_EXPLORATION).move;
};

exports.MCTS = MCTS;
