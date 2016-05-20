/*jslint nomen: true */
/*jslint indent: 2 */
'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
let shuffle = require('./../utils/shuffle').shuffle;
let sample = require('./../utils/shuffle').sample;
let Node = require('./node').Node;
let SearchAlgorithm = require('./search-algorithm');

function isNotExpanded(node) {
  return node === null;
}

class DeterminizedUCTNode extends Node {

  isExpandable() {
    return !this.isTerminal() && _.some(this.getChildNodes(), isNotExpanded);
  };

  expand() {
    let children = this.getChildNodes();

    let possibleMovesIndexArray = this.possibleMoves.map((value, index) => index);

    let moveIndex = sample(
      possibleMovesIndexArray.filter(index => isNotExpanded(children[index])),
      this.mcts.rng
    );

    let move = this.possibleMoves[moveIndex];

    return this.createChildNode(move, moveIndex);
  };

  getUCB1(explorationConstant, node) {
    if (explorationConstant !== 0) {
      return (node.wins / node.visits) + explorationConstant * Math.sqrt(2 * Math.log(node.parent.visits) / node.visits);
    } else {
      return (node.wins / node.visits);
    }
  }

  bestChild(explorationConstant) {
    let shuffled = shuffle(this.getChildNodes().slice(), this.mcts.rng);
    return _.maxBy(shuffled, node => this.getUCB1(explorationConstant, node));
  }
}

let NO_EXPLORATION = 0;

class DeterminizedUCT extends SearchAlgorithm {
  constructor(game, player, configs) {
    super(game, player, configs);
    this.iterations = configs.iterations || 100;
    this.determinizations = configs.determinizations || 100;
    this.rng = configs.rng ? configs.rng : randomGenerator(null, { state: true });
    this.explorationConstant = _.get(configs, 'explorationConstant', (Math.sqrt(2) / 2) );
  }

  getBasicNodeClass() {
    return DeterminizedUCTNode;
  }

  selectMove() {
    this.rootNodes = [];

    let initialNode = new Node({ game: this.game, depth: 0, mcts: this });

    for(let d = 0; d < this.determinizations; d++) {
      let deterministicGame = initialNode.determinize();

      let rootNode = new this.NodeClass({
        game: deterministicGame,
        depth: 0,
        mcts: this
      });

      for (let i = 0; i < this.iterations; i++) {
        let selectedNode = this.select(rootNode, this.explorationConstant);
        let endGame = this.simulate(selectedNode);
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
  }

  select(node, explorationConstant) {
    while(!node.isTerminal()) {
      if (node.isExpandable()) {
        return node.expand();
      }
      else {
        node = node.bestChild(explorationConstant);
      }
    }
    return node;
  }

  simulate(node) {
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
}

module.exports = DeterminizedUCT;
