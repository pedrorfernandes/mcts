'use strict';

let fs = require('fs');
let _ = require('lodash');
let couchbase = require('couchbase');
let Cluster = couchbase.Cluster;
let N1qlQuery = couchbase.N1qlQuery;
let Promise = require('bluebird');
let Mustache = require('mustache');

const dbConfig = JSON.parse(fs.readFileSync(__dirname + '/../../config.json')).couchbase;

function getWorkingDatabase(bucket) {

    let bucketQuery = Promise.promisify(bucket.query, { context: bucket });

    function getWinnersOrderedByTimestamp() {
        let query = N1qlQuery.fromString(`
          select default.game.winners, default.game.gameClass from default where type = 'game' order by timestamp asc
        `);
        return bucketQuery(query);
    }

    function getScoresOrderedByTimestamp() {
        let query = N1qlQuery.fromString(`
          select default.game.score, default.game.gameClass from default where type = 'game' order by timestamp asc
        `);
        return bucketQuery(query);
    }

    return {
        getWinnersOrderedByTimestamp: getWinnersOrderedByTimestamp,
        getScoresOrderedByTimestamp: getScoresOrderedByTimestamp
    }
}

let databaseInstancePromise = new Promise(function (resolve, reject) {

    let cluster = new Cluster(dbConfig.cluster);

    let bucket = cluster.openBucket(dbConfig.bucket, dbConfig.password, function (error) {

        if (error) {
            reject(`Please create the bucket in your couchbase server first
        Don't forget to create index as well!
        Cancelling database use for this run.`);
            return;
        }

        resolve(getWorkingDatabase(bucket));
    });
});

databaseInstancePromise.then(dbInstance => {

    let players = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

    let botNames = [
        'ISMCTS 10k iterations',
        'Det. UCT 500 iterations * 40 determinizations',
        'ISMCTS 10k iterations',
        'Det. UCT 500 iterations * 40 determinizations'
    ];

    let title = botNames[0] + ' VS ' + botNames[1];

    let cumulativeWinRate = {
        'Sueca': { 'Player 1': [], 'Player 2': [], 'Player 3': [], 'Player 4': [] },
        'Bisca': { 'Player 1': [], 'Player 2': [] },
        'Hearts': { 'Player 1': [], 'Player 2': [], 'Player 3': [], 'Player 4': [] }
    };

    let sortedScoresDistribution = {
        'Sueca': { 'Player 1': [], 'Player 2': [], 'Player 3': [], 'Player 4': [] },
        'Bisca': { 'Player 1': [], 'Player 2': [] },
        'Hearts': { 'Player 1': [], 'Player 2': [], 'Player 3': [], 'Player 4': [] }
    };

    let winCount = {
        'Sueca': { 'Player 1': 0, 'Player 2': 0, 'Player 3': 0, 'Player 4': 0 },
        'Bisca': { 'Player 1': 0, 'Player 2': 0 },
        'Hearts': { 'Player 1': 0, 'Player 2': 0, 'Player 3': 0, 'Player 4': 0 }
    };

    let totalGames = {
        'Sueca': 0,
        'Bisca': 0,
        'Hearts': 0
    };

    let numberOfPlayersToTie = {
        'Sueca': 4,
        'Bisca': 2,
        'Hearts': 4
    };

    function isTie(game, winners) {
        return numberOfPlayersToTie[game] === winners.length;
    }

    function isWinner(playerIndex, winners) {
        return winners.indexOf(playerIndex + 1) > -1;
    }

    let getWinners = dbInstance.getWinnersOrderedByTimestamp().then(winnersList => {

        winnersList.forEach(winningPlayersObject => {
            let gameWinners = winningPlayersObject.winners;
            let game = winningPlayersObject.gameClass;

            totalGames[game] += 1;

            players.forEach((player, playerIndex) => {
                if (isWinner(playerIndex, gameWinners) && !isTie(game, gameWinners)) {
                    winCount[game][player] += 1;
                }

                let playerCumulativeWinRate = cumulativeWinRate[game][player];

                if (playerCumulativeWinRate) {
                    let currentWinRate = ( ( winCount[game][player] / totalGames[game] ) * 100 );
                    playerCumulativeWinRate.push(currentWinRate);
                }
            });
        });
    });

    let getScores = dbInstance.getScoresOrderedByTimestamp().then(scoresList => {

        scoresList.forEach(scoresObject => {
            let scores = scoresObject.score;
            let game = scoresObject.gameClass;

            scores.forEach((score, playerIndex) => {
                let player = players[playerIndex];

                if (Array.isArray(score)) {
                    // fix for hearts score bug
                    score = score[0];
                }
                sortedScoresDistribution[game][player].push(score);
            });
        });

        sortedScoresDistribution = _.mapValues(sortedScoresDistribution, (playerScores) =>
          _.mapValues(playerScores, scores => scores.sort((a,b) => a - b)));
    });

    Promise.all([getWinners, getScores]).then(function () {
        function toDataColumns(dataObject) {
            return Object.keys(dataObject).map(function (playerKey) {
                return [playerKey].concat(dataObject[playerKey]);
            });
        }

        function decorateBotNames(playerScores, playerName) {
            return playerName + ' (' + botNames[players.indexOf(playerName)] + ')';
        }

        function decorateBotNamesInGame(scores) {
            return _.mapValues(scores, playerScores => _.mapKeys(playerScores, decorateBotNames));
        }

        cumulativeWinRate = decorateBotNamesInGame(cumulativeWinRate);
        sortedScoresDistribution = decorateBotNamesInGame(sortedScoresDistribution);

        let cumulativeWinRateColumns = _.mapValues(cumulativeWinRate,
          playerWinRates => toDataColumns(playerWinRates));
        let sortedScoresDistributionColumns = _.mapValues(sortedScoresDistribution,
          playerScores => toDataColumns(playerScores));

        let template = fs.readFileSync(__dirname + '/victory-charts.mustache.html', 'utf8');
        let output = Mustache.render(template, {
            winRateOverGames: JSON.stringify(cumulativeWinRateColumns),
            scoresOverGames: JSON.stringify(sortedScoresDistributionColumns),
            title: title
        }).replace(/&quot;/g, '\'');

        fs.writeFileSync(__dirname + '/victory-charts.html', output);
        process.exit();
    });

});
