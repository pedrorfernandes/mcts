'use strict';

var _ = require('lodash');
var Node = require('./node').Node;

function Expectiminimax(game, player, depth) {
  this.game = game;
  this.player = typeof player == 'undefined' ? 0 : player;
  this.depth = depth;
}

Node.prototype.getHeuristicValue = function() {
  return 0;
};

Node.prototype.isRandomEvent = function() {
  return this.depth === 0;
};

Node.prototype.getProbability = function() {
  return this.parent.probability;
};

Node.prototype.isAdversaryMove = function() {
  return false;
};

Node.prototype.getRandomEventChildNodes = function() {
  var self = this;
  var nextDepth = self.depth + 1;
  this.children = this.game.getAllPossibleStates().map(function(state) {
    return new Node({
      game: state,
      depth: nextDepth,
      parent: self
    });
  });
  this.probability = 1.0 / this.children.length;
  return this.children;
};

Expectiminimax.prototype.expectiminimax = function (node, depth) {
  if (node.isTerminal() || depth === 0) {
    node.alpha = node.getHeuristicValue();
    return node.alpha;
  }

  var childNodes;

  if (node.isRandomEvent()) {
    node.alpha = 0;
    node.getRandomEventChildNodes().forEach(function(child) {
      node.alpha = node.alpha + (child.getProbability() * this.expectiminimax(child, depth - 1));
    }, this);
  }
    
  else if (node.isAdversaryMove()) {
    node.alpha = +Infinity;
    node.getChildNodes().forEach(function(child) {
      node.alpha = Math.min(node.alpha, this.expectiminimax(child, depth - 1));
    }, this);
  }
    
  else {
    node.alpha = -Infinity;
    node.getChildNodes().forEach(function(child) {
      node.alpha = Math.max(node.alpha, this.expectiminimax(child, depth - 1));
    }, this);
  }
  
  return node.alpha;
};

Expectiminimax.prototype.selectMove = function () {
  var rootNode = new Node({
    game: this.game,
    depth: 0,
    mcts: this
  });

  var bestValue = this.expectiminimax(rootNode, this.depth);
  return _.find(rootNode.getChildNodes(), function(child) {
    return child.alpha === bestValue;
  });
};

exports.Expectiminimax = Expectiminimax;
