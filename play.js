'use strict';

var request = require('request');
var WebSocket = require('ws');

function playBotWars(host, gameHref, player, gameInterface, gameType) {
  var playerName = 'Player ' + player;
  var gamesUri = 'http://' + host + '/api/' + gameHref + '/' + gameType;

  if (gameType !== 'games' && gameType !== 'competitions') {
    throw new Error('Invalid game type');
  }

  function getRegisterUri(gameId) {
    return 'http://' + host + '/api/' + gameHref + '/' + gameType + '/' + gameId + '/register?player=' + player;
  }

  function getStreamUri(gameId, playerToken) {
    return 'ws://' + host + '/api/' + gameHref + '/games/' + gameId + '/stream?playerToken=' + playerToken;
  }

  function getId(game) {
    return game.gameId || game.compId;
  }

  function getCompetitionGamesUri(competition) {
    return 'http://' + host + '/api/' + gameHref + '/competitions/' + competition.compId + '/games';
  }

  function onGameOpen(gameId, playerToken) {
    console.log('[' + playerName + '] Connected to game ' + gameId + ' (with token ' + playerToken + ')');
  }

  function onError(error) {
    console.error(error);
  }

  function onMessageReceived(replySocket, data) {
    var event = JSON.parse(data);

    gameInterface.handleEvent(event, function sendResult(error, result, callback) {
      if (error) {
        console.log(error);
        return;
      }

      if (result) {
        replySocket.send(JSON.stringify(result), callback);
      }
    });
  }

  function onGameEnd(nextActionFn) {
    console.log('[' + playerName + '] Finished');
    nextActionFn();
  }

  function enterGame(game, playerToken, nextActionFn) {
    var gameId = getId(game);
    var ws = new WebSocket(getStreamUri(gameId, playerToken));

    ws.on('open', onGameOpen.bind(null, gameId, playerToken));
    ws.on('message', onMessageReceived.bind(null, ws));
    ws.on('close', onGameEnd.bind(null, nextActionFn));
    ws.on('error', onError);
  }

  function registerAndEnterGame(game, nextActionFn) {
    var gameId = getId(game);
    request.post(getRegisterUri(gameId), function(err, res, body) {
      if (err) {
        console.log('Could not register in the game');
        return;
      }

      var playerToken = JSON.parse(body).playerToken;
      enterGame(game, playerToken, nextActionFn)
    });
  }

  function enterCompetition(competition) {
    var gameId = getId(competition);
    request.post(getRegisterUri(gameId), function(err, res, body) {
      if (err) {
        console.log('Could not register in the game');
        return;
      }

      var playerToken = JSON.parse(body).playerToken;

      function searchGames () {
        request.get(getCompetitionGamesUri(competition), function(err, res, body) {
          var games = JSON.parse(body);
          if (games.length === 0) {
            setTimeout(searchGames, 2000);
            return;
          }

          for(var i = 0; i < games.length; i++) {
            if(games[i].status == 'not_started') {
              enterGame(games[i], playerToken, searchGames);
              return;
            }
          }
        });
      }

      searchGames();
    });
  }

  function findGame() {
    request.get(gamesUri, function(err, res, body) {
      if (err) {
        console.log('Could not retrieve the list of current games');
        return;
      }

      var games = JSON.parse(body);
      for(var i = 0; i < games.length; i++) {
        if(games[i].status == 'not_started') {
          registerAndEnterGame(games[i], findGame);
          return;
        }
      }
      setTimeout(findGame, 2000);
    });
  }

  function findCompetition() {
    request.get(gamesUri, function(err, res, body) {
      if (err) {
        console.log('Could not retrieve the list of current games');
        return;
      }

      var competitions = JSON.parse(body);
      var competition = competitions[0];
      enterCompetition(competition, function() {

      });
    });
  }

  findCompetition();
}

module.exports = playBotWars;
