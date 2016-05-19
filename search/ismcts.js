'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
let shuffle = require('./../utils/shuffle').shuffle;
let sample = require('./../utils/shuffle').sample;
let Node = require('./node').Node;
let SearchAlgorithm = require('./search-algorithm');

class ISMCTSNode extends Node {
  expand(deterministicGame) {
    // let children = this.getChildNodes();
    let untriedMoves = this.getUntriedMoves(deterministicGame);

    if (untriedMoves.length === 0) {
      return this;
    }

    let move = sample(untriedMoves, this.mcts.rng);
    let moveIndex = this.possibleMoves.indexOf(move);

    if(moveIndex === -1) {
      throw new Error('Get Possible Moves and Randomize game are not coherent')
    }

    let expanded = this.createChildNode(move, moveIndex, { player: deterministicGame.nextPlayer });

    deterministicGame.performMove(move);

    return expanded;
  }

  getUCB1(explorationConstant, node) {
    if (explorationConstant !== 0) {
      return (node.wins / node.visits) + explorationConstant * Math.sqrt(Math.log(node.avails) / node.visits);
    } else {
      return (node.wins / node.visits);
    }
  }

  bestChild(explorationConstant, deterministicGame) {
    let legalMoves = deterministicGame.getPossibleMoves();
    let legalChildren = this.getChildNodes().filter(function(node) {
      // bestChild() only runs when getUntriedMoves() is empty
      // this means that legalChildren are always an already expanded node
      return node && legalMoves.indexOf(node.move) > -1;
    });

    // easier to update availability here instead of backprop
    legalChildren.forEach(node => node.avails += 1);

    let shuffled = shuffle(legalChildren, this.mcts.rng);
    return _.maxBy(shuffled, node => this.getUCB1(explorationConstant, node));
  }

  getMostVisitedChild() {
    return _.maxBy(this.children, 'visits');
  }
}

class ISMCTS extends SearchAlgorithm {
  constructor(game, player, options) {
    super(game, player, options);
    this.game = game;
    this.iterations = options.iterations || 1000;
    this.player = typeof player == 'undefined' ? 0 : player;
    this.rng = options.rng ? options.rng : randomGenerator(null, {state: true});
    this.explorationConstant = _.get(options, 'explorationConstant', (Math.sqrt(2) / 2));
  }

  getBasicNodeClass() {
    return ISMCTSNode;
  }

  selectMove() {
    this.rootNode = new this.NodeClass({
      game: this.game,
      player: this.game.nextPlayer,
      depth: 0,
      mcts: this
    });

    for(let i = 0; i < this.iterations; i ++) {
      let node = this.rootNode;
      let deterministicGame = node.determinize();
      node = this.select(node, deterministicGame, this.explorationConstant);
      node = node.expand(deterministicGame);
      let finishedGame = this.simulate(deterministicGame, node);
      node.backPropagate(finishedGame);
    }

    return this.rootNode.getMostVisitedChild().move;
  }

  select(node, deterministicGame, explorationConstant) {
    while(!node.isTerminal() && _.isEmpty(node.getUntriedMoves(deterministicGame)) ) {
      node = node.bestChild(explorationConstant, deterministicGame);
      deterministicGame.performMove(node.move);
    }
    return node;
  }

  simulate(deterministicGame, expandedNode) {
    let possibleMoves = deterministicGame.getPossibleMoves();
    let move;
    while(!_.isEmpty(possibleMoves)) {
      move = sample(possibleMoves, this.rng);
      deterministicGame.performMove(move);
      possibleMoves = deterministicGame.getPossibleMoves();
    }
    return deterministicGame;
  }
}

module.exports = ISMCTS;
