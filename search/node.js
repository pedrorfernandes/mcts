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
      this.possibleMoves = this.game.getPossibleMoves(this.mcts.player);
      this.children = _.fill(new Array(this.possibleMoves.length), null);
    }
    return this.children;
  }
}

exports.Node = Node;
