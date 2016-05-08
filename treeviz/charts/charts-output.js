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

    function getWinnersOrderedByGameTime() {
        let query = N1qlQuery.fromString(`
          select default.game.winners from default where type = 'game' order by timestamp asc
        `);
        return bucketQuery(query);
    }

    function getScoresOrderedByGameTime() {
        let query = N1qlQuery.fromString(`
          select default.game.score from default where type = 'game' order by timestamp asc
        `);
        return bucketQuery(query);
    }

    return {
        getWinnersOrderedByGameTime: getWinnersOrderedByGameTime,
        getScoresOrderedByGameTime: getScoresOrderedByGameTime
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

    let players = [1,2,3,4];
    let winRateOverGames = { '1': [], '2': [], '3': [], '4': [] };
    let scoresOverGames = { '1': [], '2': [], '3': [], '4': [] };
    let winCount = { '1': 0, '2': 0, '3': 0, '4': 0 };
    let totalGames = 0;

    let getWinners = dbInstance.getWinnersOrderedByGameTime().then(winnersList => {

        winnersList.forEach(winningPlayersObject => {
            let winningPlayers = winningPlayersObject.winners;
            totalGames += 1;

            players.forEach(player => {
                if (winningPlayers.indexOf(player) > -1) {
                    winCount[player] += 1;
                }

                winRateOverGames[player].push(( winCount[player] / totalGames ) * 100);
            });
        });
    });

    let getScores = dbInstance.getScoresOrderedByGameTime().then(scoresList => {

        scoresList.forEach(scoresObject => {
            let scores = scoresObject.score;

            scores.forEach((score, playerIndex) => {
                let player = playerIndex + 1;
                if (Array.isArray(score)) {
                    score = score[0];
                }
                scoresOverGames[player].push(score);
            });
        });

        scoresOverGames = _.mapValues(scoresOverGames, scores => scores.sort((a,b) => a - b));
    });

    Promise.all([getWinners, getScores]).then(function () {
        let template = fs.readFileSync(__dirname + '/victory-charts.mustache.html', 'utf8');
        let output = Mustache.render(template, {
            winRateOverGames: JSON.stringify(winRateOverGames),
            scoresOverGames: JSON.stringify(scoresOverGames)
        }).replace(/&quot;/g, '\'');

        fs.writeFileSync(__dirname + '/victory-charts.html', output);
        process.exit();
    });

});