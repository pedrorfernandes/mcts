'use strict';

var play = require('./play');
var ISMCTS = require('./search/ismcts.js').ISMCTS;
var Minimax = require('./search/minimax.js').Minimax;
var seedrandom = require('seedrandom');
var rng = seedrandom();
var Sueca = require('./games/sueca').Sueca;
var MiniSueca = require('./games/mini-sueca').MiniSueca;
var Bisca = require('./games/bisca').Bisca;
var Hearts = require('./games/hearts').Hearts;
var Dumper = require('./treeviz/dumper');
var _ = require('lodash');

var host = 'localhost:3000';
var Game = Hearts;
var gameType = Game.name.toLowerCase();
var game;
var seed = rng();
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

console.log(seed);

function getInitialMovesCount() {
  // offset to sync tree dumps with BotWars pagination
  return 2;
}

let prefixWithGameId = true;
function getStateFileName(gameId, movesCount) {
  let prefix = '';
  if (prefixWithGameId) {
    prefix += gameId + '_';
  }
  return prefix + movesCount + '.json';
}

var movesCount;

let mapSame = card => card;

let mapCardSueca = function(card) {
  return card.value + suitMap[card.suit];
};

let mapCard = gameType.includes('sueca') ? mapCardSueca : mapSame;

let mapCardInverseSueca = function(card) {
  return {
    value: card[0],
    suit: suitMap[card[1]]
  }
};

let mapCardInverse = gameType.includes('sueca') ? mapCardInverseSueca : mapSame;

let mapPlayerSueca = function(player) {
  return player - 1;
};

let mapPlayer = gameType.includes('sueca') ? mapPlayerSueca : mapSame;

function toSuecaGame(event) {

  var hands = [[], [], [], []];
  var myPlayer = mapPlayer(playerNumber);

  hands[myPlayer] = event.state.hand.map(mapCard);

  return new Game({
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
}

function toBiscaGame(event) {
  event.state.currentPlayer = event.state.nextPlayer;
  return new Game(event.state);
}

let toGame = {
  'sueca': toSuecaGame,
  'bisca': toBiscaGame,
  'hearts': toBiscaGame
};

function startHandler(event, callback) {
  game = toGame[gameType](event);
  movesCount = getInitialMovesCount();
  console.log('Game started');
}

function getSearchAlgorithm() {
  //if (playerNumber === 1 && playerNumber === 3) {
    return _.partialRight(ISMCTS, 10000, game.currentPlayer, seed);
  //}
  //return _.partialRight(Minimax, game.currentPlayer, 13);
}

function requestMoveHandler(event, callback) {
  // server does not return 'hasSuits' in sueca, 
  // so we need to maintain state for that game
  if (gameType !== 'sueca' && gameType !== 'mini-sueca') {
    game = toGame[gameType](event);
  }
  
  var stateFileName = getStateFileName(event.gameId, movesCount);
  var searchAlgorithm = getSearchAlgorithm();
  var mcts = new searchAlgorithm(game);
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
  if (game.currentPlayer !== currentPlayer) {
    console.error('Game is desynchronized!', JSON.stringify(game), JSON.stringify(event));
  }
  game.performMove(mapCard(event.move));
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
    
    console.log('Received event type ' + eventType);

    var handlerFn = handlers[eventType];

    if (!handlerFn) {
      console.log('Unhandled event type:' + eventType + ' ' + event);
      return;
    }

    handlerFn(event, callback);
  }
};

play(host, gameType, playerNumber, gameInterface, 'competitions');
