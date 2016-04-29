'use strict';

var play = require('./play');
var ISMCTS = require('./search/ismcts.js').ISMCTS;
var Minimax = require('./search/minimax.js').Minimax;
var seedrandom = require('seedrandom');
var rng = seedrandom(null, { state: true });
var Sueca = require('./games/sueca').Sueca;
var MiniSueca = require('./games/mini-sueca').MiniSueca;
var Bisca = require('./games/bisca').Bisca;
var Hearts = require('./games/hearts').Hearts;
var Dumper = require('./treeviz/dumper');
var _ = require('lodash');

var host = 'localhost:3000';
var Game = Sueca;
var gameType = Game.name.toLowerCase();
var game;
var playerNumber = process.argv[2];

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
let mapCard = mapSame;
let mapCardInverse = mapSame;
let mapPlayer = mapSame;

function toGame(event) {
  return new Game(event.state);
}

function startHandler(event, callback) {
  game = toGame(event);
  movesCount = getInitialMovesCount();
  console.log('Game started');
}

function getSearchAlgorithm() {
  //if (playerNumber === 1 && playerNumber === 3) {
    return _.partialRight(ISMCTS, 10000, game.nextPlayer, rng);
  //}
  //return _.partialRight(Minimax, game.nextPlayer, 13);
}

function requestMoveHandler(event, callback) {
  game = toGame(event);

  var stateFileName = getStateFileName(event.gameId, movesCount);
  var SearchAlgorithm = getSearchAlgorithm();
  var mcts = new SearchAlgorithm(game);
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
  var nextPlayer = mapPlayer(event.player);
  if (game.nextPlayer !== nextPlayer) {
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

play(host, gameType, playerNumber, gameInterface, 'games');
