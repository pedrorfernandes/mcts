'use strict';

let fs = require('fs');
let _ = require('lodash');
let couchbase = require('couchbase');
let Cluster = couchbase.Cluster;
let N1qlQuery = couchbase.N1qlQuery;
let Promise = require('bluebird');

const dbConfig = require(__dirname + '/../../config.js').couchbase;

function getWorkingDatabase(bucket) {

  let bucketQuery = Promise.promisify(bucket.query, { context: bucket });

  function createIndexes() {
    return bucketQuery(N1qlQuery.fromString('create primary index on default'))
      .then(() => bucketQuery(N1qlQuery.fromString('CREATE INDEX type_index on `default`(type)')))
      .then(() => bucketQuery(N1qlQuery.fromString('CREATE INDEX timestamp_index on `default`(timestamp);')))
      .then(() => bucketQuery(N1qlQuery.fromString('CREATE INDEX id_index on `default`(id);')));
  }

  function getUniqueCompetitionPrefixes() {
    return bucketQuery(N1qlQuery.fromString(`
      select default.comp.name from default where type = 'competition'
    `)).then(results => _.uniq(results.map(result => result.name.replace(/\s\w+\s\d+$/,''))));
  }

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
    getGameIdsOfCompetition: getGameIdsOfCompetition,
    createIndexes: createIndexes,
    getUniqueCompetitionPrefixes: getUniqueCompetitionPrefixes
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

  let playerToWinner = {
    Sueca: function(player, winners) {
      if (winners.length === 4) {
        return 0;
      }
      return winners.indexOf(player) > -1 ? 1 : 0;
    },
    Bisca: function(player, winners) {
      if (winners.length === 2) {
        return 0;
      }
      return winners.indexOf(player) > -1 ? 1 : 0;
    },
    Hearts: function(player, winners) {
      return winners.indexOf(player) > -1 ? 1 : 0;
    },
  };

  dbInstance.createIndexes().then(function () {

    return dbInstance.getUniqueCompetitionPrefixes()
      .then(function(competitionPrefixes) {

        return Promise.map(competitionPrefixes, function (competitionPrefix) {
          let gameResults = {
            Sueca: { winners: [], scores: [], matches: [], players: [1,2,3,4] },
            Bisca: { winners: [], scores: [], players: [1,2]},
            Hearts: { winners: [], scores: [], players: [1,2,3,4] }
          };

          let getScores = dbInstance.getScoresOrderedByTimestamp(competitionPrefix).then(scoresList => {

            return scoresList.forEach(scoresObject => {
              let scores = scoresObject.score;
              let game = scoresObject.gameClass;

              gameResults[game].scores.push(scores);
            });

          });

          let getWinners = dbInstance.getWinnersOrderedByTimestamp(competitionPrefix).then(winnersList => {

            return winnersList.forEach(winningPlayersObject => {
              let gameWinners = winningPlayersObject.winners;
              let game = winningPlayersObject.gameClass;

              let players = gameResults[game].players;

              let mappedPlayers = players.map(p => playerToWinner[game](p, gameWinners));

              gameResults[game].winners.push(mappedPlayers);
            });
          });

          return Promise.all([getScores, getWinners]).then(function () {
            _.forEach(gameResults, function (results, game) {
              let csvScores = results.scores.map(score => score.join(',')).join('\n');
              let scoresFileName = 'scores_' + game.toLowerCase() + '_' + competitionPrefix.replace(/\s/g, '_').toLocaleLowerCase() + '.csv';
              fs.writeFileSync(scoresFileName, csvScores);

              let csvWinners = results.winners.map(winner => winner.join(',')).join('\n');
              let winnersFileName = 'winners_' + game.toLowerCase() + '_' + competitionPrefix.replace(/\s/g, '_').toLocaleLowerCase() + '.csv';
              fs.writeFileSync(winnersFileName, csvWinners);
            });
          });
        }, {concurrency: 1});
      }).then(function () {
        process.exit(0);
      });
  });

});
