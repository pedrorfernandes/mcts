'use strict';

let _ = require('lodash');

let TreeNodeUnificationMixin = (superclass) => class extends superclass {

  createChildNode(move, childIndex, overrides) {
    let options = _.defaults(overrides, {
      game: this.game,
      player: this.game.nextPlayer,
      parent: this,
      move: move,
      mcts: this.mcts
    });

    let moveHash = move + this.game.toUniqueStateHash();
    let child;

    if (this.mcts.gameStatesHashMap.has(moveHash)) {
      child = this.mcts.gameStatesHashMap.get(moveHash);
    } else {
      child = new this.constructor(options);
      this.mcts.gameStatesHashMap.set(moveHash, child);
    }

    this.children[childIndex] = child;

    return child;
  }

};

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance) {
    let NodeClass = searchAlgorithmInstance.getNodeClass();
    let NodeClassWithMixin = class extends TreeNodeUnificationMixin(NodeClass) {};

    searchAlgorithmInstance.setNodeClass(NodeClassWithMixin);
    searchAlgorithmInstance.gameStatesHashMap = new Map();
  }
};
