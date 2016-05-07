/*jslint nomen: true */
/*jslint indent: 2 */
'use strict';

var _ = require('lodash');
var randomGenerator = require('seedrandom');
var shuffle = require('./../utils/shuffle').shuffle;
var sample = require('./../utils/shuffle').sample;
var Node = require('./node').Node;

class DeterminizedUCTNode extends Node {

  isExpandable() {
    return !this.isTerminal() && _.some(this.getChildNodes(), isNotExpanded);
  };

  expand() {
    var children = this.getChildNodes();

    var possibleMovesIndexArray = this.possibleMoves.map((value, index) => index);

    var moveIndex = sample(
      possibleMovesIndexArray.filter(index => isNotExpanded(children[index])),
      this.mcts.rng
    );

    var expanded = new DeterminizedUCTNode({
      game: this.game,
      parent: this,
      move: this.possibleMoves[moveIndex],
      depth: this.depth + 1,
      mcts: this.mcts
    });

    children[moveIndex] = expanded;

    return expanded;
  };

  bestChild(explorationValue) {
    var shuffled = shuffle(this.getChildNodes().slice(), this.mcts.rng);
    return _.maxBy(shuffled, nodeValue.bind(null, explorationValue));
  };
}

function isNotExpanded(node) {
  return node === null;
}

function treePolicy(node) {
  while(!node.isTerminal()) {
    if (node.isExpandable()) {
      return node.expand();
    }
    else {
      node = node.bestChild(EXPLORATION_VALUE);
    }
  }
  return node;
}

function simulate(node) {
  let clonedGame = new node.game.constructor(node.game);
  let possibleMoves = node.game.getPossibleMoves();
  let move;
  while(!_.isEmpty(possibleMoves)) {
    move = sample(possibleMoves, node.mcts.rng);
    clonedGame.performMove(move);
    possibleMoves = clonedGame.getPossibleMoves();
  }
  return clonedGame;
}

var nodeValue = function(explorationValue, node) {
  return getUCB1(explorationValue, node);
};

var EXPLORATION_VALUE = Math.sqrt(2);
var NO_EXPLORATION = 0;
var getUCB1 = function (explorationValue, node) {
  if (explorationValue !== 0) {
    return (node.wins / node.visits)
      + explorationValue * Math.sqrt(2 * Math.log(node.parent.visits) / node.visits);
  }
  else {
    return (node.wins / node.visits);
  }
};

function DeterminizedUCT(game, player, configs) {
  this.game = game;
  this.iterations = configs.iterations || 100;
  this.determinizations = configs.determinizations || 100;
  this.player = typeof player == 'undefined' ? 0 : player;
  if (configs.rng) {
    this.rng = configs.rng;
  } else {
    this.rng = randomGenerator(null, { state: true });
  }
}

DeterminizedUCT.prototype.selectMove = function () {
  this.rootNodes = [];

  let initialNode = new Node({ game: this.game, depth: 0, mcts: this });

  for(let d = 0; d < this.determinizations; d++) {
    let deterministicGame = initialNode.determinize();

    let rootNode = new DeterminizedUCTNode({
      game: deterministicGame,
      depth: 0,
      mcts: this
    });

    for (let i = 0; i < this.iterations; i++) {
      let selectedNode = treePolicy(rootNode);
      let endGame = simulate(selectedNode);
      selectedNode.backPropagate(endGame);
    }

    this.rootNodes.push(rootNode);
  }


  function addStatistics(receiverNode, node) {
    receiverNode.visits += node.visits;
    receiverNode.wins += node.wins;
    receiverNode.avails += node.avails;
  }

  this.rootNode = this.rootNodes.reduce(function updateStats(rootNode, node, index) {
    if (index === 0) {
      return rootNode;
    }

    addStatistics(rootNode, node);

    rootNode.children.forEach(function(child, index) {
      addStatistics(child, node.children[index]);
    });

    return rootNode;
  }, this.rootNodes[0]);

  return this.rootNode.bestChild(NO_EXPLORATION).move;
};

module.exports = DeterminizedUCT;
