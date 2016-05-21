'use strict';

let _ = require('lodash');
let Node = require('./node').Node;
let SearchAlgorithm = require('./search-algorithm');

class MinimaxNode extends Node {

  getChildNodes() {
    let self = this;
    if (!this.children) {
      this.children = [];
      this.possibleMoves = this.game.getPossibleMoves();
      this.possibleMoves.forEach((move, childIndex) => {
        this.createChildNode(move, childIndex, { depth: self.depth + 1 });
      });
    }
    return this.children;
  }

  getHeuristicValue() {
    return this.game.getGameValue();
  }

  isAdversaryMove() {
    return this.game.getTeam(this.game.nextPlayer) !== this.game.getTeam(this.mcts.player);
  }

  getRandomEventChildNodes() {
    let self = this;
    let nextDepth = self.depth + 1;
    this.children = [];
    this.game.getAllPossibleStates().forEach((state, childIndex) => {
      this.createChildNode(null, childIndex, {
        depth: nextDepth,
        game: state,
        parent: null
      });
    });
    return this.children;
  }
}

class Minimax extends SearchAlgorithm {

  constructor(game, player, configs) {
    super(game, player, configs);
    this.game = game;
    this.player = typeof player == 'undefined' ? 0 : player;
    this.depth = configs.depth;
  }

  getBasicNodeClass() {
    return MinimaxNode;
  }

  getInitialRootNode() {
    return new this.NodeClass({
      game: this.game,
      player: this.game.nextPlayer,
      depth: 0,
      mcts: this
    });
  }

  selectMove() {
    let self = this;
    this.rootNode = this.getInitialRootNode();

    let moveVotes = {};
    let children = this.rootNode.getRandomEventChildNodes();
    console.log(children.length);
    for(let childIndex = 0; childIndex < children.length; childIndex++) {
      let child = children[childIndex];
      let bestValue = this.minimax(child, self.depth - 1, -Infinity, +Infinity);

      child.children.forEach(function(c) {
        if (c.value === bestValue) {
          if (!moveVotes[c.move]) {
            moveVotes[c.move] = 0;
          }
          moveVotes[c.move] += 1;
        }
      });
    }

    return this.getMostVotedNode(moveVotes).move;
  }

  minimax(node, depth, alpha, beta) {
    if (node.isTerminal() || depth === 0) {
      node.value = node.getHeuristicValue();
      return node.value;
    }

    let children = node.getChildNodes();
    let childIndex;

    if (node.isAdversaryMove()) {
      node.value = +Infinity;
      for(childIndex = 0; childIndex < children.length; childIndex++) {
        node.value = Math.min(node.value, this.minimax(children[childIndex], depth - 1, alpha, beta));
        beta = Math.min(beta, node.value);
        if (beta <= alpha) {
          break;
        }
      }
    }

    else {
      node.value = -Infinity;
      for(childIndex = 0; childIndex < children.length; childIndex++) {
        node.value = Math.max(node.value, this.minimax(children[childIndex], depth - 1, alpha, beta));
        alpha = Math.max(alpha, node.value);
        if (beta <= alpha) {
          break;
        }
      }
    }

    return node.value;
  }

  getMostVotedNode (moveVotes) {
    return _.reduce(moveVotes, function(result, value, move) {
      if (value > result.value) {
        return { move: move, value: value };
      }
      return result;
    }, {value: 0});
  }
}

module.exports = Minimax;
