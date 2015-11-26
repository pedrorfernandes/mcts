'use strict';

var request = require('request');

var WebSocket = require('ws');

module.exports = function(host, gameHref, player, gameInterface) {
  var playerName = 'Player ' + player;

  var gamesUri = 'http://' + host + '/api/' + gameHref + '/games';

  var registerUri = function(gameId) {
    return 'http://' + host + '/api/' + gameHref + '/games/' + gameId + '/register?player=' + player;
  };

  var streamUri = function(gameId, playerToken) {
    return 'ws://' + host + '/api/' + gameHref + '/games/' + gameId + '/stream?playerToken=' + playerToken;
  };

  function enterGame(gameId, next) {
    request.post(registerUri(gameId), function(err, res, body) {
      if(err) { console.log('Could not register in the game'); return; }

      var playerToken = JSON.parse(body).playerToken;
      var ws = new WebSocket(streamUri(gameId, playerToken));

      ws.on('open', function() {
        console.log('[' + playerName + '] Connected to game ' + gameId + ' (with token ' + playerToken + ')');
      });

      ws.on('message', function(data) {
        var evt = JSON.parse(data);

        if (!gameInterface[evt.eventType]) {
          console.log('Unhandled event type:' + evt.eventType + ' ' + data);
          return;
        }

        gameInterface[evt.eventType](evt, function(error, result) {
          if (error) {
            console.log(error);
            return;
          }

          if (result) {
            ws.send(JSON.stringify(result));
          }
        });
      });

      ws.on('close', function() {
        console.log('[' + playerName + '] Finished');
        next();
      });
    });
  }

  function findGame() {
    request.get(gamesUri, function(err, res, body) {
      if(err) { console.log('Could not retrieve the list of current games'); return; }

      var games = JSON.parse(body);
      for(var i = 0; i < games.length; i++) {
        if(games[i].status == 'not_started') {
          enterGame(games[i].gameId, findGame);
          return;
        }
      }
      setTimeout(findGame, 2000);
    });
  }

  findGame();
};
