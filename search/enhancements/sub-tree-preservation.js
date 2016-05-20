'use strict';

let _ = require('lodash');

function getChild(node, move) {
  if (!node || !node.possibleMoves || !node.children) {
    return null;
  }
  return node.children[node.possibleMoves.indexOf(move)];
}

function getInitialRootNode(rootNode) {
  return function () {
    console.log(`Sub tree optimization applied, saved ${rootNode.visits} visits!`);
    return rootNode;
  }
}

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance, options) {
    let previousRootNode = _.get(options, 'previousSearchAlgorithm.rootNode', null);
    let moveHistorySincePreviousSearch = options.moveHistorySincePreviousSearch || [];

    let node = previousRootNode;
    while(moveHistorySincePreviousSearch.length > 0) {
      node = getChild(node, moveHistorySincePreviousSearch.shift());
    }

    if (node) {
      node.player = searchAlgorithmInstance.player;
      searchAlgorithmInstance.getInitialRootNode = getInitialRootNode(node);
    }
  }
};
