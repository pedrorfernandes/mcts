var _ = require('lodash');
var MCTS = require('./mcts/index.js').MCTS;
var games = require('./test/games');
var TicTacToeGame = games.TicTacToeGame;

var seedrandom = require('seedrandom');
var rng = seedrandom();

var Sueca = require('./test/sueca').Sueca;

var seed = 0.9981069023819238;//rng();
var sueca = new Sueca(seed);
console.log(seed);
console.log('Trumps are ' + sueca.trump);
var round = 0;

sueca.setObserver({
    roundWinner: function(event) {
        console.log(event.roundWinner
            + ' won the round with ' + event.highestCard
            + ' and took ' + event.pointsWon + ' points!');
    }
});

while(!sueca.getWinner()) {
    var mcts = new MCTS(sueca, 100000, sueca.currentPlayer, seed);
    if (round !== sueca.round) {
        round = sueca.round;
        console.log('\nRound ' + round);
    }

    console.time('selectMove');
    var move = mcts.selectMove();
    console.timeEnd('selectMove');
    console.log(sueca.getPrettyPlayerHand(sueca.currentPlayer));
    console.log(sueca.currentPlayer + ' played ' + move  + '\n');
    sueca.performMove(move);
}

var winners = sueca.getWinner();

console.log('\n' + winners + ' have won the match with ' + sueca.getPoints(winners));

/*
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
*/
