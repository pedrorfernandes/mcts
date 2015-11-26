var MCTS = require('./mcts/index.js').MCTS;

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
    var mcts = new MCTS(sueca, 10000, sueca.currentPlayer, seed);
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
