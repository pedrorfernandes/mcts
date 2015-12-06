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

function getValue(card) {
  return values[card[0]];
}

function getScaledValue(card) {
  return valuesScale[card[0]];
}

var values = {
  'A': 11, '7': 10, 'K': 4, 'J': 3, 'Q': 2, '6': 0, '5': 0, '4': 0, '3': 0, '2': 0
};

var valuesScale = {
  'A': 10, '7': 9, 'K': 8, 'J': 7, 'Q': 6, '6': 5, '5': 4, '4': 3, '3': 2, '2': 1
};

var ranks = ['A', '7', 'K', 'J', 'Q', '6', '5', '4', '3', '2'];
var suits = ['♠', '♥', '♦', '♣'];

var startingDeck = suits.reduce(function(deck, suit) {
  return deck.concat(ranks.map(function(rank) {
    return Card(rank, suit);
  }));
}, []);

var isRandomNumberGenerator = function(object) {
  return typeof object !== 'object';
};

function Sueca(options) {
  if (!isRandomNumberGenerator(options)) {
    this.clone(options);
  } else {
    var seed = options;
    this.currentPlayer = 0;
    var rng = seed ? randomGenerator(seed) : randomGenerator();
    this.hands = _.chunk(shuffle(startingDeck, rng), 10);
    this.trumpCard = _.last(_.last(this.hands));
    this.trumpPlayer = 3;
    this.trump = getSuit(this.trumpCard);
    this.trick = [null, null, null, null];
    this.wonCards = [[], [], [], []];
    this.round = 1;
    this.suitToFollow = null;
    this.hasSuits = new Array(4).fill({
      '♠': true, '♥': true, '♦': true, '♣': true
    })
  }
}

Sueca.prototype.setObserver = function(watcher) {
  this.observer = watcher;
};

function copyHands(hand) {
  var newArray = [];
  for (var i = 0; i < hand.length; i++) {
    newArray[i] = hand[i].slice();
  }

  return newArray
}

Sueca.prototype.clone = function(game) {
  this.currentPlayer = game.currentPlayer;
  this.hands = copyHands(game.hands);
  this.trump = game.trump;
  this.trick =  game.trick.slice();
  this.trumpCard = game.trumpCard;
  this.trumpPlayer = game.trumpPlayer;
  this.trump = game.trump;
  this.wonCards = copyHands(game.wonCards);
  this.round = game.round;
  this.suitToFollow = game.suitToFollow;
  this.hasSuits = game.hasSuits.map(function(playerHasSuits) {
    return {
      '♠': playerHasSuits['♠'],
      '♥': playerHasSuits['♥'],
      '♦': playerHasSuits['♦'],
      '♣': playerHasSuits['♣']
    }
  })
};

Sueca.prototype.getCardsInTableCount = function () {
  return this.trick.reduce(function(count, card) {
    if (card !== null) {
      return count + 1;
    }
    return count;
  }, 0);
};

Sueca.prototype.getPossibilities = function(playerPerspective) {
  var playerPerspectiveHand = this.hands[playerPerspective];
  var playedCards = _.flatten(this.wonCards);
  var inRoundCards = this.trick.filter(function(card) { return card !== null });
  var hasSuits = this.hasSuits[this.currentPlayer];
  var trumpCard = [];
  if (this.currentPlayer !== this.trumpPlayer) {
    trumpCard = [this.trumpCard];
  }

  var impossibilities = playerPerspectiveHand
      .concat(playedCards).concat(inRoundCards).concat(trumpCard);

  return startingDeck.filter(function(card) {
    var suit = getSuit(card);
    return hasSuits[suit] && impossibilities.indexOf(card) === -1;
  });
};

Sueca.prototype.getPossibleMoves = function (playerPerspective) {
  var hand = this.hands[this.currentPlayer];

  if (_.all(this.hands, _.isEmpty)) {
    return [];
  }

  if (playerPerspective && playerPerspective !== this.currentPlayer) {
    return this.getPossibilities(playerPerspective);
  }

  if (this.getCardsInTableCount() === 0) {
    return hand;
  }
  else {
    var cardsOfSuit = [];
    if (this.suitToFollow) {
      cardsOfSuit = hand.filter(function (card) {
        return getSuit(card) === this.suitToFollow
      }, this);
    }

    if (_.isEmpty(cardsOfSuit)) {
      return hand;
    }
    else {
      return cardsOfSuit;
    }
  }
};

Sueca.prototype.getHighestCard = function(table, suitToFollow) {
  var trump = this.trump;

  if (trump !== suitToFollow) {
    var trumps = table.filter(function(card) {
      return getSuit(card) === trump;
    });

    if (!_.isEmpty(trumps)) {
      return _.max(trumps, getScaledValue);
    }
  }

  var followed = table.filter(function(card) {
    return getSuit(card) === suitToFollow;
  });

  return _.max(followed, getScaledValue);
};

Sueca.prototype.notifyObserver = function(event) {
  if (this.observer && this.observer[event.type]) {
    this.observer[event.type](event);
  }
};

Sueca.prototype.updatePlayerHasSuits = function(card) {
  var playedSuit = getSuit(card);
  if (this.suitToFollow && this.suitToFollow !== playedSuit) {
    this.hasSuits[this.currentPlayer][this.suitToFollow] = false;
  }
};

Sueca.prototype.performMove = function (card) {
  this.trick[this.currentPlayer] = card;

  var hand = this.hands[this.currentPlayer];
  hand.splice(hand.indexOf(card), 1);

  this.updatePlayerHasSuits(card);

  var cardsInTableCount = this.getCardsInTableCount();

  if (cardsInTableCount === 4) {
    var highestCard = this.getHighestCard(this.trick, this.suitToFollow);
    var roundWinner = this.trick.indexOf(highestCard);
    this.wonCards[roundWinner] = this.wonCards[roundWinner].concat(this.trick);

    if (this.observer) {
      this.notifyObserver({
        type: 'roundWinner',
        roundWinner: roundWinner,
        highestCard: highestCard,
        pointsWon: _.sum(this.trick, function (card) {
          return getValue(card)
        })
      });
    }

    this.trick = [null, null, null, null];
    this.currentPlayer = roundWinner;
    this.round += 1;
    this.suitToFollow = null;
    return;
  }

  if (cardsInTableCount === 1) {
    this.suitToFollow = getSuit(card);
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

Sueca.prototype.randomize = function(rng, player) {
  if (typeof player != 'undefined') {
    var hand = this.hands[player];
    this.hands = [[],[],[],[]];
    this.hands[player] = hand;
  }

  this.hands.forEach(function returnTrickToHand(hand, playerIndex) {
    if (this.trick[playerIndex]) {
      hand.push(this.trick[playerIndex]);
    }
  }, this);

  var numberOfCardsInEachHand = _.max(this.hands.map(function(h) {return h.length}));

  var playedCards = _.flatten(this.wonCards)
    .concat(_.flatten(this.hands));

  if (!_.contains(playedCards, this.trumpCard)) {
    this.hands[this.trumpPlayer].push(this.trumpCard);
    playedCards.push(this.trumpCard);
  }

  var unPlayedCards = _.difference(startingDeck, playedCards);

  unPlayedCards = shuffle(unPlayedCards, rng);

  var hasSuits = this.hasSuits;

  this.hands = this.hands.map(function distributeCards(hand, player) {
    var numberOfCardsToTake =  numberOfCardsInEachHand - hand.length;
    if (numberOfCardsToTake > 0) {
      // take N cards from cards to distribute
      unPlayedCards = unPlayedCards.reduce(function(remaining, card) {
        if (hand.length < numberOfCardsInEachHand && hasSuits[player][getSuit(card)]) {
          hand.push(card);
        }
        else {
          remaining.push(card);
        }
        return remaining;
      }, []);
    }
    return hand;
  });

  return this;
};

var suitOrder = {
  '♠': 4, '♥': 3, '♦': 2, '♣': 1
};

Sueca.prototype.getPrettyPlayerHand = function(player) {
  var hand = this.hands[player].slice().sort(function(cardA, cardB) {
    var valueA = suitOrder[getSuit(cardA)] * 100 + getScaledValue(cardA);
    var valueB = suitOrder[getSuit(cardB)] * 100 + getScaledValue(cardB);
    return valueB - valueA;
  });
  var grouped = _.groupBy(hand, function(card) { return getSuit(card); });
  var string = _.reduce(grouped, function(string, suit) {
    return string + ' | ' + suit.join(' ')
  }, '');
  return 'His hand is ' + string;
};

exports.Sueca = Sueca;
