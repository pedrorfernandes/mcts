'use strict';

var fs = require('fs');
var stringify = require('json-stringify-safe');
var LZString = require('lz-string');

function replacer(key, value) {
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

var treeDump = function(fileName, mcts) {
  var gameTreeJson = stringify(mcts.rootNode, replacer, null, function(){});
  var compressedData = LZString.compressToUTF16(gameTreeJson);
  var treeFilePath = __dirname + '/trees/' + fileName;
  fs.writeFile(treeFilePath, compressedData, function(err) {
    if(err) {
      return console.log(err);
    }

    console.log("The game tree dump was saved into a file!");
  });

  var stateJson = JSON.stringify({
    game: mcts.game,
    rng: mcts.rng.state(),
    player: mcts.player,
    iterations: mcts.iterations
  });

  var stateFilePath = __dirname + '/states/' + fileName;
  fs.writeFile(stateFilePath, stateJson, function(err) {
    if(err) {
      return console.log(err);
    }

    console.log("The state dump was saved into a file!");
  });
};

module.exports = {
  treeDump: treeDump
};
