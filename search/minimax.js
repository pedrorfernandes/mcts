'use strict';

var _ = require('lodash');
var Node = require('./node').Node;

class MinimaxNode extends Node {

  getChildNodes() {
    var self = this;
    if (!this.children) {
      this.possibleMoves = this.game.getPossibleMoves(this.currentPlayer);
      this.children = this.possibleMoves.map(function(move) {
        return new MinimaxNode({
          game: self.game,
          parent: self,
          move: move,
          depth: self.depth + 1,
          mcts: self.mcts
        });
      });
    }
    return this.children;
  }

  getHeuristicValue() {
    return this.game.getGameValue();
  }

  isAdversaryMove() {
    return this.game.getTeam(this.game.currentPlayer) !== this.game.getTeam(this.mcts.player);
  }

  getRandomEventChildNodes() {
    var self = this;
    var nextDepth = self.depth + 1;
    this.children = this.game.getAllPossibleStates().map(function(state) {
      return new MinimaxNode({
        game: state,
        depth: nextDepth,
        // parent: self,
        mcts: self.mcts
      });
    });
    return this.children;
  }
}

function Minimax(game, player, depth) {
  this.game = game;
  this.player = typeof player == 'undefined' ? 0 : player;
  this.depth = depth;
}

function minimax(node, depth, alpha, beta) {
  if (node.isTerminal() || depth === 0) {
    node.value = node.getHeuristicValue();
    return node.value;
  }

  var children = node.getChildNodes();
  var childIndex;
    
  if (node.isAdversaryMove()) {
    node.value = +Infinity;
    for(childIndex = 0; childIndex < children.length; childIndex++) {
      node.value = Math.min(node.value, minimax(children[childIndex], depth - 1, alpha, beta));
      beta = Math.min(beta, node.value);
      if (beta <= alpha) {
        break;
      }
    }
  }

  else {
    node.value = -Infinity;
    for(childIndex = 0; childIndex < children.length; childIndex++) {
      node.value = Math.max(node.value, minimax(children[childIndex], depth - 1, alpha, beta));
      alpha = Math.max(alpha, node.value);
      if (beta <= alpha) {
        break;
      }
    }
  }
  
  return node.value;
}

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
  this.rootNode = new MinimaxNode({
    game: this.game,
    depth: 0,
    mcts: this
  });

  var moveVotes = {};
  var children = this.rootNode.getRandomEventChildNodes();
  for(var childIndex = 0; childIndex < children.length; childIndex++) {
    var child = children[childIndex];
    var bestValue = minimax(child, self.depth - 1, -Infinity, +Infinity);

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
