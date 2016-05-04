'use strict';

let fs = require('fs');
let couchbase = require('couchbase');
let Cluster = couchbase.Cluster;
let N1qlQuery = couchbase.N1qlQuery;
let Promise = require('bluebird');
let crypto = require('crypto');

const dbConfig = JSON.parse(fs.readFileSync(__dirname + '/../config.json')).couchbase;

function getNoopFunction(value) {
  return () => value;
}

function getNoopDatabase() {
  return {
    gameStates: {
      save: getNoopFunction(),
      getAll: getNoopFunction(Promise.resolve([]))
    }
  }
}

function getWorkingDatabase(bucket) {

  let bucketUpsert = Promise.promisify(bucket.upsert, { context: bucket });

  function saveGameState(object) {
    object.type = "gameState";
    return bucketUpsert(object.id, object);
  }

  return {
    gameStates: {
      save: saveGameState
    }
  }
}

let databaseInstancePromise = new Promise(function (resolve /*, reject*/) {

  if (!dbConfig.enabled) {
    resolve(getNoopDatabase());
    return;
  }

  let cluster = new Cluster(dbConfig.cluster);

  let bucket = cluster.openBucket(dbConfig.bucket, dbConfig.password, function (error) {

    if (error) {
      console.error(`Please create the bucket in your couchbase server first
        Don't forget to create index as well!
        Cancelling database use for this run.`);
      resolve(getNoopDatabase());
      return;
    }

    resolve(getWorkingDatabase(bucket));
  });
});

let database = {
  gameStates: {
    save: function (object) {
      return databaseInstancePromise.then(dbInstance => dbInstance.gameStates.save(object));
    }
  }
};

module.exports = database;
