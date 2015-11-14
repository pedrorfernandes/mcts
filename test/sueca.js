'use strict';

var _ = require('lodash');
var randomGenerator = require('seedrandom');
var shuffle = require('../mcts/shuffle');

function Card(rank, suit) {
  return rank + suit;
}

function getSuit(card) {
  return card[1];
}

function getRank(card) {
  return card[0]
}

function getValue(card) {
  return values[card[0]];
}

var values = {
  'A': 11, '7': 10, 'K': 4, 'J': 3, 'Q': 2, '6': 0, '5': 0, '4': 0, '3': 0, '2': 0
};

var  ranks = ['A', '7', 'K', 'J', 'Q', '6', '5', '4', '3', '2'];
var  suits = ['♠', '♥', '♦', '♣'];

var startingDeck = suits.reduce(function(deck, suit) {
  return deck.concat(ranks.map(function(rank) {
    return Card(rank, suit);
  }));
}, []);

function Sueca(options) {
  if (options instanceof Sueca) {
    this.clone(options);
  } else {
    var seed = options;
    this.currentPlayer = 0;
    var rng = seed ? randomGenerator(seed) : randomGenerator();
    this.hands = _.chunk(shuffle(startingDeck, rng), 10);
    this.trump = getSuit(_.last(_.last(this.hands)));
    this.table = [];
    this.wonCards = [[], [], [], []];
  }
}

function copyHands(hand) {
  var newArray = [];
  for (var i = 0; i < hand.length; i++)
    newArray[i] = hand[i].slice();

  return newArray
}

Sueca.prototype.clone = function(game) {
  this.currentPlayer = game.currentPlayer;
  this.hands = copyHands(game.hands);
  this.trump = game.trump;
  this.table =  game.table.slice();
  this.wonCards = copyHands(game.wonCards);
};

Sueca.prototype.getPossibleMoves = function () {
  var hand = this.hands[this.currentPlayer];
  if (_.isEmpty(this.table)) {
    return hand;
  }
  else {
    var suitToFollow = getSuit(_.first(this.table));
    var cardsOfSuit = hand.filter(function(card) { return getSuit(card) === suitToFollow });
    if (_.isEmpty(cardsOfSuit)) {
      return hand;
    }
    else {
      return cardsOfSuit;
    }
  }
};

Sueca.prototype.getHighestCard = function(table) {
  var trump = this.trump;
  var trumps = table.filter(function(card) {
    return getSuit(card) === trump;
  });

  if (_.isEmpty(trumps)) {
    return _.max(table, getValue);
  }
  else {
    return _.max(trumps, getValue);
  }
};

Sueca.prototype.performMove = function (card) {
  this.table = this.table.concat(card);

  if (this.table.length === 4) {
    var highestCard = this.getHighestCard(this.table);
    var roundWinner = this.table.indexOf(highestCard);
    this.wonCards[roundWinner] = this.wonCards[roundWinner].concat(this.table);
    this.table = [];
  }

  this.currentPlayer = (this.currentPlayer + 1) % 4;
};

Sueca.prototype.getCurrentPlayer = function () {
  return this.currentPlayer;
};

Sueca.prototype.isGameOver = function() {
  return _.all(this.hands, function (hand) {
    return hand.length === 0;
  });
};

Sueca.prototype.getPoints = function(players) {
  var teamWonCards = this.wonCards[players[0]].concat(this.wonCards[players[1]]);
  return _.sum(teamWonCards, function(card) { return getValue(card) });
};

Sueca.prototype.getWinner = function () {
  var team1 = [0, 2];
  var pointsTeam1 = this.getPoints(team1);
  if (pointsTeam1 >= 61) {
    return team1;
  }

  var team2 = [1, 3];
  var pointsTeam2 = this.getPoints(team2);
  if (pointsTeam2 >= 61) {
    return team2;
  }

  return null;
};

exports.Sueca = Sueca;
