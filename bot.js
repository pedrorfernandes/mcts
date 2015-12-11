'use strict';

var play = require('./play');

var host = 'localhost:3000';
var gameType = 'sueca';

var ISMCTS = require('./mcts/ismcts.js').ISMCTS;
var seedrandom = require('seedrandom');
var rng = seedrandom();
var Sueca = require('./test/sueca').Sueca;
var Dumper = require('./treeviz/dumper');

var seed = rng();
console.log(seed);

var sueca;

var playerNumber = process.argv[2];

var suitMap = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs'
};

var mapCard = function(card) {
  return card.value + suitMap[card.suit];
};

var mapCardInverse = function(card) {
  return {
    value: card[0],
    suit: suitMap[card[1]]
  }
};

var mapPlayer = function(player) {
  return player - 1;
};

var movesCount = 2;

var gameInterface = {
  'start': function(event, callback) {
    var hands = [[], [], [], []];
    var myPlayer = mapPlayer(playerNumber);

    hands[myPlayer] = event.state.hand.map(mapCard);

    sueca = new Sueca({
      hands: hands,
      currentPlayer: mapPlayer(event.state.nextPlayer),
      trumpCard: mapCard(event.state.trump),
      trumpPlayer: mapPlayer(event.state.trumpPlayer),
      trump: suitMap[event.state.trump.suit],
      trick: [null, null, null, null],
      wonCards: [[], [], [], []],
      round: 1,
      suitToFollow: null,
      hasSuits: new Array(4).fill({ '♠': true, '♥': true, '♦': true, '♣': true })
    });
    console.log('game start');
  },
  'requestMove': function(event, callback) {
    var stateFileName = movesCount + '.json';
    var mcts = new ISMCTS(sueca, 10000, sueca.currentPlayer, seed);
    Dumper.saveState(stateFileName, mcts);

    console.time('selectMove');
    var move = mcts.selectMove();
    console.timeEnd('selectMove');

    Dumper.saveTree(stateFileName, mcts);

    callback(null, mapCardInverse(move));
  },
  'move': function(event, callback) {
    var currentPlayer = mapPlayer(event.player);
    if (sueca.currentPlayer !== currentPlayer) {
      console.error('Game is desynchronized!', JSON.stringify(sueca), JSON.stringify(event));
    }
    sueca.performMove(mapCard(event.move));
    movesCount += 1;
  },
  'state': function(event, callback) {
    // console.log('state ' + JSON.stringify(event));

  },
  'info': function(event, callback) {

  }
};

play(host, gameType, playerNumber, gameInterface);
