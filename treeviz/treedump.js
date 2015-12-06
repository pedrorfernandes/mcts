'use strict';

var fs = require('fs');
var stringify = require('json-stringify-safe');

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
  var fileContents = 'var rootNode = ' + gameTreeJson;
  fs.writeFile('./' + fileName, fileContents, function(err) {
    if(err) {
      return console.log(err);
    }

    console.log("The file was saved!");
  });
};

module.exports = {
  treeDump: treeDump
};
