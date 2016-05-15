'use strict';

let request = require('request');
let WebSocket = require('ws');

function noop() {}

function playBotWars(options) {
  let host = options.host;
  let gameHref = options.gameHref;
  let player = options.player;
  let gameInterface = options.gameInterface;
  let gameType = options.gameType;
  let gameName = options.gameName;
  let playerName = 'Player ' + player;
  let gamesUri = 'http://' + host + '/api/' + gameHref + '/' + gameType;

  if (gameType !== 'games' && gameType !== 'competitions') {
    throw new Error('Invalid game type');
  }

  function isNameToFind(game) {
    return gameName && game.name === gameName;
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

  function onMessageReceived(replySocket, gameId, data) {
    let event = JSON.parse(data);

    event.gameId = gameId;

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
    let gameId = getId(game);
    let ws = new WebSocket(getStreamUri(gameId, playerToken));

    ws.on('open', onGameOpen.bind(null, gameId, playerToken));
    ws.on('message', onMessageReceived.bind(null, ws, gameId));
    ws.on('close', onGameEnd.bind(null, nextActionFn));
    ws.on('error', onError);
  }

  function registerAndEnterGame(game, nextActionFn) {
    let gameId = getId(game);
    request.post(getRegisterUri(gameId), function(err, res, body) {
      if (err) {
        console.log('Could not register in the game');
        return;
      }

      let playerToken = JSON.parse(body).playerToken;
      enterGame(game, playerToken, nextActionFn)
    });
  }

  function enterCompetition(competition, nextActionFn) {
    let gameId = getId(competition);
    request.post(getRegisterUri(gameId), function(err, res, body) {
      if (err) {
        console.log('Could not register in the game');
        return;
      }

      let playerToken = JSON.parse(body).playerToken;

      function searchCompetitionGames () {
        request.get(getCompetitionGamesUri(competition), function(err, res, body) {
          let parsed = JSON.parse(body);
          let gamesToPlayCount = parsed.gamesToPlayCount;
          let games = parsed.games;

          if (gamesToPlayCount === 0) {
            nextActionFn();
          }

          if (games.length === 0) {
            setTimeout(searchCompetitionGames, 2000);
            return;
          }

          let game;
          for(let i = 0; i < games.length; i++) {
            game = games[i];

            if(game.status == 'not_started') {
              enterGame(games[i], playerToken, searchCompetitionGames);
              return;
            }
          }
        });
      }

      searchCompetitionGames();
    });
  }

  function findGame() {
    request.get(gamesUri, function(err, res, body) {
      if (err) {
        console.log('Could not retrieve the list of current games');
        return;
      }

      let games = JSON.parse(body);

      let game;
      for (let i = 0; i < games.length; i++) {
        game = games[i];

        if(game.status == 'not_started' && isNameToFind(game)) {
          registerAndEnterGame(game, findGame);
          return;
        }
      }

      console.log('Could not find game to play.. Searching again in 2 seconds');
      setTimeout(findGame, 2000);
    });
  }

  function terminateProcess() {
    process.exit(0);
  }

  function findCompetition() {
    request.get(gamesUri, function(err, res, body) {
      if (err) {
        console.log('Could not retrieve the list of current games');
        return;
      }

      let competitions = JSON.parse(body);
      let competition;
      for (let i = 0; i < competitions.length; i++) {
        competition = competitions[i];

        if(competition.status == 'not_started' && isNameToFind(competition)) {
          enterCompetition(competition, terminateProcess);
          return;
        }
      }

      console.log('Could not find competition to play.. Searching again in 2 seconds');
      setTimeout(findCompetition, 2000);
    });
  }

  let findFn = gameType === 'games' ? findGame : findCompetition;
  findFn();
}

module.exports = playBotWars;
