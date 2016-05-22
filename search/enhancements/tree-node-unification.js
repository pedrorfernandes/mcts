'use strict';

let _ = require('lodash');

function setGameInHashMap(hashMap, game, move, childNode) {
  let gameHash = game.toUniqueStateHash();

  let moveToChildNodesMap = hashMap.get(gameHash);

  if (!moveToChildNodesMap) {
    moveToChildNodesMap = new Map();
    hashMap.set(gameHash, moveToChildNodesMap);
  }

  moveToChildNodesMap.set(move, childNode);
}

function addStatsFrom(nodeFrom) {
  return function (nodeTo) {
    nodeTo.avails += nodeFrom.avails;
    nodeTo.wins += nodeFrom.wins;
    nodeTo.visits += nodeFrom.visits;
  }
}

function backpropagate(node, statsUpdateFunction) {
  while (node != null) {
    statsUpdateFunction(node);
    if (node.parents.length > 1) {
      node.parents.forEach(parent => backpropagate(parent, statsUpdateFunction));
      return;
    }
    node = node.parents[0];
  }
}

function setNewParent(childIndex, childNode, newParentNode) {
  if (!childNode) {
    return;
  }

  newParentNode.children[childIndex] = childNode;
  backpropagate(newParentNode, addStatsFrom(childNode));
  childNode.parents.push(newParentNode);
}

let TreeNodeUnificationMixin = (superclass) => class extends superclass {

  constructor(options) {
    super(options);
    this.parents = [this.parent];
    this.parent = null;
  }

  createChildNode(move, childIndex, overrides) {
    let options = _.defaults(overrides, {
      game: this.game,
      player: this.game.nextPlayer,
      parent: this,
      move: move,
      mcts: this.mcts
    });

    let child = new this.constructor(options);

    setGameInHashMap(this.mcts.gamesHashMap, this.game, move, child);

    this.children[childIndex] = child;

    return child;
  }

  backPropagate(finishedGame) {
    let node = this;
    let getReward = _.memoize(node.getReward.bind(node), (game, player) => player);
    while (node != null) {
      node.visits += 1;
      node.wins += getReward(finishedGame, node.player, this);
      if (node.parents.length > 1) {
        node.parents.forEach(parent => parent.backPropagate(finishedGame));
        return;
      }
      node = node.parents[0];
    }
  };

  getChildNodes() {
    if (!this.children) {
      this.possibleMoves = this.game.getPossibleMoves();
      this.children = _.fill(new Array(this.possibleMoves.length), null);

      let gameHash = this.game.toUniqueStateHash();

      if (this.mcts.gamesHashMap.has(gameHash)) {
        let moveToChildNodesMap = this.mcts.gamesHashMap.get(gameHash);

        let unifyChildIfExists = (move, moveIndex) => setNewParent(moveIndex, moveToChildNodesMap.get(move), this);

        this.possibleMoves.forEach(unifyChildIfExists);
      }
    }
    return this.children;
  }

};

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance) {
    let NodeClass = searchAlgorithmInstance.getNodeClass();
    let NodeClassWithMixin = class extends TreeNodeUnificationMixin(NodeClass) {};

    searchAlgorithmInstance.setNodeClass(NodeClassWithMixin);
    searchAlgorithmInstance.gamesHashMap = new Map();
  }
};
