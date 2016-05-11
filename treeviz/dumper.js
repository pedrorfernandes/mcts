'use strict';

let fs = require('fs');
let stringify = require('json-stringify-safe');
let LZString = require('lz-string');
let database = require('../utils/database');
let _ = require('lodash');

function replacer(key, value) {
  if (key === 'game' || key === 'mcts') {
    return undefined;
  }
  if (key === 'children') {
    if (!value || value.every(function(c) { return c === null })) {
      return undefined;
    }
    else {
      return value.filter(function(c) {
        return c !== null;
      });
    }
  }
  return value;
}

let saveGameTreeToFile = function(fileName, mcts) {
  let gameTreeJson = stringify(mcts.rootNode, replacer, null, function(){});
  let compressedData = LZString.compressToUTF16(gameTreeJson);
  let treeFilePath = __dirname + '/trees/' + fileName;
  fs.writeFile(treeFilePath, compressedData, function(err) {
    if(err) {
      return console.log(err);
    }

    console.log("The game tree dump was saved into a file!");
  });
};

let prefixWithGameId = true;
function getStateFileName(gameId, movesCount) {
  let prefix = '';
  if (prefixWithGameId) {
    prefix += gameId + '_';
  }
  return prefix + movesCount + '.json';
}

let saveGameStateToFile = function(fileName, mcts) {
  let stateFilePath = __dirname + '/states/' + fileName;

  let stateJson = JSON.stringify({
    game: mcts.game,
    gameType: mcts.game.constructor.name.toLowerCase(),
    rng: mcts.rng ? mcts.rng.state() : null,
    player: mcts.player,
    iterations: mcts.iterations
  });

  fs.writeFileSync(stateFilePath, stateJson);
  console.log("The state dump was stored!");
};

let saveGameStateToDatabase = function(stateData) {

  let data = _.defaults(stateData, {
    mcts: { player: null, game: null, rng: null },
    event: { gameId: null },
    stateNumber: null,
    searchAlgorithm: null,
    searchOptions: null,
    computationTime: null,
    move: null
  });

  let stateJson = {
    date: (new Date()).toString(),
    timestamp: Date.now(),
    id: data.event.gameId + '_' + data.stateNumber,
    searchAlgorithm: data.searchAlgorithm,
    searchOptions: data.searchOptions,
    stateNumber: data.stateNumber,
    gameId: data.event.gameId,
    game: data.mcts.game,
    gameType: data.mcts.game ? data.mcts.game.constructor.name.toLowerCase() : null,
    rng: data.mcts.rng ? data.mcts.rng.state() : null,
    player: data.mcts.player,
    computationTime: data.computationTime,
    move: data.move
  };

  return database.gameStates.save(stateJson);
};

let saveGameStateAndTreeToFiles = function(fileName, mcts) {
  saveGameTreeToFile(fileName, mcts);
  saveGameStateToFile(fileName, mcts);
};

module.exports = {
  saveGameTreeToFile: saveGameTreeToFile,
  saveGameStateToDatabase: saveGameStateToDatabase,
  saveGameStateToFile: saveGameStateToFile,
  saveGameStateAndTreeToFiles: saveGameStateAndTreeToFiles
};
