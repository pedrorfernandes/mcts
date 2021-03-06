'use strict';

let fs = require('fs');
let _ = require('lodash');
let couchbase = require('couchbase');
let Cluster = couchbase.Cluster;
let N1qlQuery = couchbase.N1qlQuery;
let Promise = require('bluebird');
let Mustache = require('mustache');

const dbConfig = require(__dirname + '/../../config.js').couchbase;

function getWorkingDatabase(bucket) {

    let bucketQuery = Promise.promisify(bucket.query, { context: bucket });

    function getGameIdsOfCompetition(competitionName) {
        let query = N1qlQuery.fromString(`
          select default.gameIds from default where type = 'competition' and comp.name like "${competitionName}%"
        `);

        return bucketQuery(query).then(function (results) {
            return _.flatMap(results, result => result.gameIds);
        });
    }

    function getWinnersOrderedByTimestamp(competitionPrefix) {

        if (competitionPrefix) {
            return getGameIdsOfCompetition(competitionPrefix).then(function (gameIds) {
                return bucketQuery(N1qlQuery.fromString(`
                    select default.game.winners, default.game.gameClass from default where type = 'game' and id in ["${gameIds.join('","')}"] order by timestamp asc
                `));
            });
        }

        return bucketQuery(N1qlQuery.fromString(`
            select default.game.winners, default.game.gameClass from default where type = 'game' order by timestamp asc
        `));
    }

    function getScoresOrderedByTimestamp(competitionPrefix) {

        if (competitionPrefix) {
            return getGameIdsOfCompetition(competitionPrefix).then(function (gameIds) {
                return bucketQuery(N1qlQuery.fromString(`
                    select default.game.score, default.game.gameClass from default where type = 'game' and id in ["${gameIds.join('","')}"] order by timestamp asc
                `));
            });
        }

        return bucketQuery(N1qlQuery.fromString(`
          select default.game.score, default.game.gameClass from default where type = 'game' order by timestamp asc
        `));
    }

    return {
        getWinnersOrderedByTimestamp: getWinnersOrderedByTimestamp,
        getScoresOrderedByTimestamp: getScoresOrderedByTimestamp,
        getGameIdsOfCompetition: getGameIdsOfCompetition
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

function writeReportForGames(dbInstance, competitionPrefix, fileSuffix, botNameSuffix) {

    let players = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

    let botNames = [
        'Pure ISMCTS',
        'ISMCTS + NAST, N=2, UCB1',
        'Pure ISMCTS',
        'ISMCTS + NAST, N=2, UCB1',
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

    let getWinners = dbInstance.getWinnersOrderedByTimestamp(competitionPrefix).then(winnersList => {

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

    let getScores = dbInstance.getScoresOrderedByTimestamp(competitionPrefix).then(scoresList => {

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

    return Promise.all([getWinners, getScores]).then(function () {
        function toDataColumns(dataObject) {
            return Object.keys(dataObject).map(function (playerKey) {
                return [playerKey].concat(dataObject[playerKey].map(n => n.toFixed(3)));
            });
        }

        function toAverage(dataObject) {
            return _.mapValues(dataObject, playerScores => _.mapValues(playerScores, scores => {
                var sum = scores.reduce((a, b) => a + b, 0);
                return sum / scores.length;
            }));
        }

        function decorateBotNames(playerScores, playerName) {
            return playerName + ' (' + botNames[players.indexOf(playerName)] + ')';
        }

        function decorateBotNamesInGame(scores) {
            return _.mapValues(scores, playerScores => _.mapKeys(playerScores, decorateBotNames));
        }

        cumulativeWinRate = decorateBotNamesInGame(cumulativeWinRate);
        sortedScoresDistribution = decorateBotNamesInGame(sortedScoresDistribution);

        let cumulativeWinRateColumns = _.mapValues(cumulativeWinRate, toDataColumns);
        let sortedScoresDistributionColumns = _.mapValues(sortedScoresDistribution, toDataColumns);

        let scoreAverages = toAverage(sortedScoresDistribution);

        let template = fs.readFileSync(__dirname + '/victory-charts.mustache.html', 'utf8');
        let output = Mustache.render(template, {
            winRateOverGames: JSON.stringify(cumulativeWinRateColumns),
            scoresOverGames: JSON.stringify(sortedScoresDistributionColumns),
            scoreAverages: JSON.stringify(scoreAverages),
            title: title
        }).replace(/&quot;/g, '\'').replace(/&#x3D;/g, '=');

        let fileName = fileSuffix ? `/victory-charts${fileSuffix}.html` : '/victory-charts.html';
        fs.writeFileSync(__dirname + fileName, output);
    });

}

databaseInstancePromise.then(dbInstance => {

    let competitions = [
        {prefix: "Pure ISMCTS VS ISMCTS + NAST (N=2, UCB1)", fileSuffix: '', botNameSuffix: ''},
    ];

    let writeReportPromises = competitions.map(function (competition) {
        return writeReportForGames(dbInstance, competition.prefix, competition.fileSuffix, competition.botNameSuffix);
    });

    Promise.all(writeReportPromises).then(function () {
        process.exit(0);
    });

});
