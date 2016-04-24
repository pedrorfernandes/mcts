/*jslint nomen: true */
/*jslint indent: 2 */
'use strict';

var _ = require('lodash');

function isExpanded(node) {
  return node !== null;
}

function getMove(node) {
  return node.move;
}

class Node {
  constructor(options) {
    this.game = new options.game.constructor(options.game);
    this.mcts = options.mcts;
    this.parent = options.parent || null;
    this.move = typeof options.move != 'undefined' ? options.move : null;
    // player that applied node.move
    this.player = _.isNumber(options.player) ? options.player : this.game.currentPlayer;
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

  getUntriedMoves(deterministicGame) {
    var triedMoves = this.getChildNodes().filter(isExpanded).map(getMove);
    var legalMoves = deterministicGame.getPossibleMoves();
    return _.difference(legalMoves, triedMoves);
  }

  isTerminal() {
    return _.isEmpty(this.getChildNodes());
  }

  getChildNodes() {
    if (!this.children) {
      this.possibleMoves = this.game.getPossibleMoves();
      this.children = _.fill(new Array(this.possibleMoves.length), null);
    }
    return this.children;
  }

  getReward(game, player, initialNode) {
    var winner = game.getWinners();

    if (winner === null) {
      return 0.5;
    }

    if (Array.isArray(winner) && _.includes(winner, player)) {
      return 1;
    }
    else if (player === winner) {
      return 1;
    }
    return 0;
  };

  backPropagate(finishedGame) {
    let node = this;
    let getReward = _.memoize(node.getReward.bind(node), (game, player) => player);
    while (node != null) {
      node.visits += 1;
      node.wins += getReward(finishedGame, node.player, this);
      node = node.parent;
    }
  };

  determinize() {
    let cloneGame = new this.game.constructor(this.game);
    cloneGame = cloneGame.randomize(this.mcts.rng, this.mcts.player);
    return cloneGame;
  }
}

exports.Node = Node;
