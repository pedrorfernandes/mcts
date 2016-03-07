'use strict';

var _ = require('lodash');
var Node = require('./node').Node;

function Minimax(game, player, depth) {
  this.game = game;
  this.player = typeof player == 'undefined' ? 0 : player;
  this.depth = depth;
}

Node.prototype.getChildNodes = function() {
  var self = this;
  if (!this.children) {
    this.possibleMoves = this.game.getPossibleMoves(this.currentPlayer);
    this.children = this.possibleMoves.map(function(move) {
      return new Node({
        game: self.game,
        parent: self,
        move: move,
        depth: self.depth + 1,
        mcts: self.mcts
      });
    });
  }
  return this.children;
};

Node.prototype.getHeuristicValue = function() {
  return this.game.getGameValue();
};

Node.prototype.isRandomEvent = function() {
  // deck possibilities at start of the game
  return this.depth === 0;
};

Node.prototype.getProbability = function() {
  return this.parent.childProbability;
};

Node.prototype.isAdversaryMove = function() {
  return this.game.getTeam(this.game.currentPlayer) !== this.game.getTeam(this.mcts.player);
};

Node.prototype.getRandomEventChildNodes = function() {
  var self = this;
  var nextDepth = self.depth + 1;
  this.children = this.game.getAllPossibleStates().map(function(state) {
    return new Node({
      game: state,
      depth: nextDepth,
      parent: self,
      mcts: self.mcts
    });
  });
  this.childProbability = 1.0 / this.children.length;
  return this.children;
};

Minimax.prototype.minimax = function (node, depth, alpha, beta) {
  var self = this;

  if (node.isTerminal() || depth === 0) {
    node.value = node.getHeuristicValue();
    return node.value;
  }

  var children = node.getChildNodes();
  var childIndex;
    
  if (node.isAdversaryMove()) {
    node.value = +Infinity;
    for(childIndex = 0; childIndex < children.length; childIndex++) {
      node.value = Math.min(node.value, self.minimax(children[childIndex], depth - 1, alpha, beta));
      beta = Math.min(beta, node.value);
      if (beta <= alpha) {
        break;
      }
    }
  }

  else {
    node.value = -Infinity;
    for(childIndex = 0; childIndex < children.length; childIndex++) {
      node.value = Math.max(node.value, self.minimax(children[childIndex], depth - 1, alpha, beta));
      alpha = Math.max(alpha, node.value);
      if (beta <= alpha) {
        break;
      }
    }
  }
  
  return node.value;
};

function getMostVotedNode (moveVotes) {
  return _.reduce(moveVotes, function(result, value, move) {
    if (value > result.value) {
      return { move: move, value: value };
    }
    return result;
  }, {value: 0});
}

Minimax.prototype.selectMove = function () {
  var self = this;
  this.rootNode = new Node({
    game: this.game,
    depth: 0,
    mcts: this
  });

  var moveVotes = {};
  var children = this.rootNode.getRandomEventChildNodes();

  for(var childIndex = 0; childIndex < children.length; childIndex++) {
    var child = children[childIndex];
    var bestValue = self.minimax(child, self.depth - 1, -Infinity, +Infinity);

    child.children.forEach(function(c) {
      if (c.value === bestValue) {
        if (!moveVotes[c.move]) {
          moveVotes[c.move] = 0;
        }
        moveVotes[c.move] += 1;
      }
    });
  }

  return getMostVotedNode(moveVotes).move;
};

exports.Minimax = Minimax;
