var ISMCTS = require('./search/ismcts.js').ISMCTS;
var stringify = require('json-stringify-safe');

var seedrandom = require('seedrandom');
var rng = seedrandom();

var Sueca = require('./games/sueca').Sueca;

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

while(!sueca.getWinners()) {
    var mcts = new ISMCTS(sueca, 10000, sueca.nextPlayer, seed);
    if (round !== sueca.round) {
        round = sueca.round;
        console.log('\nRound ' + round);
    }

    console.time('selectMove');
    var move = mcts.selectMove();
    console.timeEnd('selectMove');
    console.log(sueca.getPrettyPlayerHand(sueca.nextPlayer));
    console.log(sueca.nextPlayer + ' played ' + move  + '\n');
    sueca.performMove(move);
}

var winners = sueca.getWinners();

console.log('\n' + winners + ' have won the match with ' + sueca.getPoints(winners));
