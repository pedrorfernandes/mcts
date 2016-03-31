'use strict';

var play = require('./play');

var host = 'localhost:3000';
var gameType = 'sueca';

var ISMCTS = require('./search/ismcts.js').ISMCTS;
var Minimax = require('./search/minimax.js').Minimax;
var seedrandom = require('seedrandom');
var rng = seedrandom();
var Sueca = require('./games/sueca').Sueca;
var MiniSueca = require('./games/mini-sueca').MiniSueca;
var Dumper = require('./treeviz/dumper');

var _ = require('lodash');
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

// offset to sync tree dumps with BotWars pagination
var movesCount = 2;

function startHandler(event, callback) {
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

  console.log('Game started');
}

function getSearchAlgorithm() {
  //if (playerNumber === 1 && playerNumber === 3) {
    return _.partialRight(ISMCTS, 10000, sueca.currentPlayer, seed);
  //}
  //return _.partialRight(Minimax, sueca.currentPlayer, 13);
}

function requestMoveHandler(event, callback) {
  var stateFileName = movesCount + '.json';
  var searchAlgorithm = getSearchAlgorithm();
  var mcts = new searchAlgorithm(sueca);
  Dumper.saveState(stateFileName, mcts);

  console.time('selectMove');
  var move = mcts.selectMove();
  console.timeEnd('selectMove');

  callback(null, mapCardInverse(move), function(error) {
  //  Dumper.saveTree(stateFileName, mcts);
  });
}

function stateHandler(event, callback) {
  // console.log('state ' + JSON.stringify(event));

}

function infoHandler(event, callback) {

}

function moveHandler(event, callback) {
  var currentPlayer = mapPlayer(event.player);
  if (sueca.currentPlayer !== currentPlayer) {
    console.error('Game is desynchronized!', JSON.stringify(sueca), JSON.stringify(event));
  }
  sueca.performMove(mapCard(event.move));
  movesCount += 1;
}

var handlers = {
  'start': startHandler,
  'requestMove': requestMoveHandler,
  'move': moveHandler,
  'state': stateHandler,
  'info': infoHandler
};

var gameInterface = {
  handleEvent : function(event, callback) {
    var eventType = event.eventType;

    var handlerFn = handlers[eventType];

    if (!handlerFn) {
      console.log('Unhandled event type:' + eventType + ' ' + event);
      return;
    }

    handlerFn(event, callback);
  }
};

play(host, gameType, playerNumber, gameInterface, 'competitions');
