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

let isIndexIn = array => (element, index) => array.indexOf(index) > -1;

let toIndexIn = array => element => array.indexOf(element);
let notFound = index => index > -1;

let getIndexesIn = (few, all) => few.map(toIndexIn(all)).filter(notFound);

module.exports = {
  decorateSearchAlgorithm: function(searchAlgorithmInstance, options) {
    let previousRootNode = _.get(options, 'previousSearchAlgorithm.rootNode', null);
    let moveHistorySincePreviousSearch = options.moveHistorySincePreviousSearch || [];

    let node = previousRootNode;
    while(moveHistorySincePreviousSearch.length > 0) {
      node = getChild(node, moveHistorySincePreviousSearch.shift());
    }

    if (node && node.children && node.possibleMoves) {
      node.player = searchAlgorithmInstance.player;
      node.move = null;
      node.parent = null;
      node.game = searchAlgorithmInstance.game;

      let actualPossibleMoves = searchAlgorithmInstance.game.getPossibleMoves();
      let validMoveIndexes = getIndexesIn(actualPossibleMoves, node.possibleMoves);

      if (validMoveIndexes.length !== node.possibleMoves.length) {
        node.possibleMoves = node.possibleMoves.filter(isIndexIn(validMoveIndexes));
        node.children = node.children.filter(isIndexIn(validMoveIndexes));
      }

      searchAlgorithmInstance.getInitialRootNode = getInitialRootNode(node);
    }
  }
};
