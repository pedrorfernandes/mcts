var _ = require('lodash');
var MCTS = require('./mcts/index.js').MCTS;
var games = require('./test/games');
var TicTacToeGame = games.TicTacToeGame;

var seedrandom = require('seedrandom');
var rng = seedrandom();

var move = [2, 0];
var mcts;
while(move[0] == 2 && move[1] == 0) {
  var tictactoegame = new TicTacToeGame();
  var seed = rng();
  mcts = new MCTS(tictactoegame, 5000, 'X', seed);//, 0.3382841647474541);
  tictactoegame.board = [
    [null, null,  'O'],
    [null,  'O', null],
    [null, null, null]
  ];
  move = mcts.selectMove();
  console.log(move, seed);
}

console.log('done');
