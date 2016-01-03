'use strict';

var _ = require('lodash');
var randomGenerator = require('seedrandom');
var shuffle = require('../mcts/shuffle').shuffle;
var sample = require('../mcts/shuffle').sample;
var Munkres = require('munkres-js').Munkres;
var munkres = new Munkres();

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

var distributionWeights = {};
var getDistributionWeightsForGame = function(cards, playerIndexes, numberCardsPerPlayer) {
  var gameKey = cards.join() + playerIndexes.join() + numberCardsPerPlayer.join();
  return distributionWeights[gameKey];
};

Sueca.prototype.distributionWeights = distributionWeights;

var setDistributionWeightsForGame = function(cards, playerIndexes, numberCardsPerPlayer, weights) {
  var gameKey = cards.join() + playerIndexes.join() + numberCardsPerPlayer.join();
  return distributionWeights[gameKey] = weights;
};

Sueca.prototype.assignCardsToPlayersWithRestrictions = function (cards, playerIndexes, numberCardsPerPlayer) {
  var hasSuits = this.hasSuits;
  function getRestrictionPenalty (card, playerIndex)  {
    // 0 -> possible, 1 -> impossible, constraint broken
    return hasSuits[playerIndex][getSuit(card)] ? 0 : Infinity;
  }

  var cardCompatibilityCountForEachPlayer = [];

  var playerAssignmentIndexes = _.flatten(playerIndexes.map(function(playerIndex) {
    var numberCardsToAssign = numberCardsPerPlayer[playerIndex];
    return _.fill(new Array(numberCardsToAssign), playerIndex);
  }));

  cards.forEach(function(card, cardIndex) {
    cardCompatibilityCountForEachPlayer[cardIndex] = playerAssignmentIndexes.map(function(playerIndex) {
      return getRestrictionPenalty(card, playerIndex)
    });
  }, this);

  var distributionWeights = getDistributionWeightsForGame(cards, playerIndexes, numberCardsPerPlayer);
  if (!distributionWeights) {
    distributionWeights = cardCompatibilityCountForEachPlayer;
  }
  else {
    for(var i = 0; i < distributionWeights.length; i++) {
      var weights = distributionWeights[i];
      for(var j = 0; j < weights.length; j++) {
        cardCompatibilityCountForEachPlayer[i][j] += distributionWeights[i][j];
      }
    }
  }

  var mapToPlayerIndex = function(resultMatrixCell) {
    return playerAssignmentIndexes[resultMatrixCell[1]];
  };

  var mapToCard = function(resultMatrixCell) {
    return cards[resultMatrixCell[0]];
  };

  var result = munkres.compute(cardCompatibilityCountForEachPlayer);

  var hands = [[],[],[],[]];

  result.forEach(function(resultMatrixCell) {
    distributionWeights[resultMatrixCell[0]][resultMatrixCell[1]] += 1;
    var playerIndex = mapToPlayerIndex(resultMatrixCell);
    var card = mapToCard(resultMatrixCell);
    hands[playerIndex].push(card);
  }, this);

  setDistributionWeightsForGame(cards, playerIndexes, numberCardsPerPlayer, distributionWeights);

  return hands;
};

Sueca.prototype.randomize = function(rng, player) {
  if (typeof player != 'undefined') {
    // clear other player hands when game is already deterministic
    var hand = this.hands[player];
    this.hands = [[],[],[],[]];
    this.hands[player] = hand;
  }

  var numberOfCardsInEachHandAtStartOfRound = this.hands.map(function(h, playerIndex) {
    return 11 - this.round - (this.trick[playerIndex] ? 1 : 0);
  }, this);

  var handsSize = this.hands.map(function(h) { return h.length });
  var maxCardsCount = _.max(handsSize);
  var currentPlayerIndex = handsSize.indexOf(maxCardsCount);

  var knownCards = _.flatten(this.wonCards)
    .concat(_.flatten(this.hands))
    .concat(this.trick.filter(function(c) { return c !== null }));

  if (!_.contains(knownCards, this.trumpCard)) {
    knownCards.push(this.trumpCard);
    this.hands[this.trumpPlayer].push(this.trumpCard);
  }

  var unknownCards = _.difference(startingDeck, knownCards);

  var playerIndexesToAssignCards = _.pull([0,1,2,3], currentPlayerIndex);
  var numberCardsPerPlayer = this.hands.map(function(h, playerIndex) {
    return numberOfCardsInEachHandAtStartOfRound[playerIndex] - this.hands[playerIndex].length;
  }, this);

  var assigned = this.assignCardsToPlayersWithRestrictions(unknownCards, playerIndexesToAssignCards, numberCardsPerPlayer, rng);

  assigned.forEach(function(assignedCards, playerIndex) {
    this.hands[playerIndex] = this.hands[playerIndex].concat(assignedCards);
  }, this);

  // TODO remove, only purpose is for debugging inconsistencies
  var hasSuits = this.hasSuits;
  this.hands.forEach(function(hand, playerIndex) {
    if (hand.length !== numberOfCardsInEachHandAtStartOfRound[playerIndex]) {
      throw new Error('Game randomization failed!');
    }
    var invalid = _.some(hand, function(card) {
      return hasSuits[playerIndex][getSuit(card)] === false;
    });
    if (invalid) {
      throw new Error('Game randomization failed due to restrictions!');
    }
  }, this);

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
