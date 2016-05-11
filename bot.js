'use strict';

let _ = require('lodash');
let playBotWars = require('./botwars-interface');
let seedrandom = require('seedrandom');
let Dumper = require('./treeviz/dumper');
let fs = require('fs');
const config = JSON.parse(fs.readFileSync("config.json"));

let program = require('commander');
program
  .version('0.0.1')
  .option('-p, --player [player]', 'Playernumber in game', str => parseInt(str), 2)
  .option('-a, --algorithm [algorithm]', 'Algorithm to use, check names in config file', 'ismcts')
  .option('-g, --game [game]', 'Game to play, check names in config file', 'sueca')
  .option('-o, --search-options [search-options]', 'Options JSON to pass down to algorithm', str => JSON.parse(str), { iterations: 10000 })
  .option('-c, --competition [competition]', 'Competition name to join in botwars server', 'Random Vs ISMCTS Sueca')
  .option('-h, --hostname [hostname]', 'Botwars server url', 'localhost:3000')
  .option('-e, --enhancements [enhancements]', 'Options JSON specifying which enhancements to apply in a algorithm', str => JSON.parse(str), { reward: 'positive-win-or-loss' })
  .parse(process.argv);

let host = program.hostname;
let Game = require(config.games[program.game].module);
let gameName = program.game;
let searchOptions = program.searchOptions;
searchOptions.enhancements = program.enhancements;
let SearchAlgorithm = require(config.algorithms[program.algorithm].module);
let playerNumber = program.player;
let competitionName = program.competition;

let game;

function getInitialMovesCount() {
  // offset to sync tree dumps with BotWars pagination
  return 2;
}

let movesCount;

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

function requestMoveHandler(event, callback) {
  game = toGame(event);

  let mcts = new SearchAlgorithm(game, game.nextPlayer, searchOptions);

  let stateData = {
    mcts: mcts,
    event: event,
    stateNumber: movesCount,
    searchAlgorithm: program.algorithm,
    searchOptions: searchOptions,
    computationTime: null
  };

  Dumper.saveGameStateToDatabase(stateData).then(function() {

    let move, hrStart, hrEnd;

    hrStart = process.hrtime();

    if (game.getPossibleMoves().length === 1) {
      console.log('Only one move possible, cancelling search');
      move = game.getPossibleMoves()[0];
    } else {
      move = mcts.selectMove();
    }

    hrEnd = process.hrtime(hrStart);

    stateData.computationTime = hrEnd[0] * 1000 + hrEnd[1]/1000000;
    stateData.move = move;

    callback(null, mapCardInverse(move));

    Dumper.saveGameStateToDatabase(stateData);
  });
}

function stateHandler(event, callback) {
  // console.log('state ' + JSON.stringify(event));

}

function infoHandler(event, callback) {

}

function moveHandler(event, callback) {
  let nextPlayer = mapPlayer(event.player);
  if (game.nextPlayer !== nextPlayer) {
    console.error('Game is desynchronized!', JSON.stringify(game), JSON.stringify(event));
  }
  game.performMove(mapCard(event.move));
  movesCount += 1;
}

let handlers = {
  'start': startHandler,
  'requestMove': requestMoveHandler,
  'move': moveHandler,
  'state': stateHandler,
  'info': infoHandler
};

let gameInterface = {
  handleEvent : function(event, callback) {
    let eventType = event.eventType;

    console.log('Received event type ' + eventType);

    let handlerFn = handlers[eventType];

    if (!handlerFn) {
      console.log('Unhandled event type:' + eventType + ' ' + event);
      return;
    }

    handlerFn(event, callback);
  }
};

playBotWars({
  host: host,
  gameHref: gameName,
  player: playerNumber,
  gameInterface: gameInterface,
  gameType: 'competitions',
  gameName: competitionName
});
