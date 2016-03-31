'use strict';

var _ = require('lodash');
var randomGenerator = require('seedrandom');
var shuffle = require('../search/shuffle').shuffle;
var sample = require('../search/shuffle').sample;
var Combinatorics = require('js-combinatorics');

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

function copyHands(hand) {
  var newArray = [];
  for (var i = 0; i < hand.length; i++) {
    newArray[i] = hand[i].slice();
  }

  return newArray
}

function flatten (a, b) {
  return a.concat(b);
}

class Sueca {
  constructor(options) {
    if (!isRandomNumberGenerator(options)) {
      this._clone(options);
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

  _clone(game) {
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

  _getCardsInTableCount() {
    return this.trick.reduce(function(count, card) {
      if (card !== null) {
        return count + 1;
      }
      return count;
    }, 0);
  }

  getAllPossibilities(playerPerspective) {
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
  }

  getPossibleMoves(playerPerspective) {
    var hand = this.hands[this.currentPlayer];

    if (_.isNumber(playerPerspective) && playerPerspective !== this.currentPlayer) {
      return this.getAllPossibilities(playerPerspective);
    }

    if (this._getCardsInTableCount() === 0) {
      return hand;
    }

    var cardsOfSuit = [];

    if (this.suitToFollow) {
      cardsOfSuit = hand.filter(function (card) {
        return getSuit(card) === this.suitToFollow
      }, this);
    }

    if (_.isEmpty(cardsOfSuit)) {
      return hand;
    }

    return cardsOfSuit;
  }

  getHighestCard(table, suitToFollow) {
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
  }


  _updatePlayerHasSuits(playedCard) {
    var playedSuit = getSuit(playedCard);
    if (this.suitToFollow && this.suitToFollow !== playedSuit) {
      this.hasSuits[this.currentPlayer][this.suitToFollow] = false;
    }
  }

  performMove(card) {
    this.trick[this.currentPlayer] = card;

    var hand = this.hands[this.currentPlayer];
    hand.splice(hand.indexOf(card), 1);

    this._updatePlayerHasSuits(card);

    var cardsInTableCount = this._getCardsInTableCount();

    if (cardsInTableCount === 4) {
      var highestCard = this.getHighestCard(this.trick, this.suitToFollow);
      var roundWinner = this.trick.indexOf(highestCard);
      this.wonCards[roundWinner] = this.wonCards[roundWinner].concat(this.trick);

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
  }

  getCurrentPlayer() {
    return this.currentPlayer;
  }

  isGameOver() {
    return _.all(this.hands, function (hand) {
      return hand.length === 0;
    });
  }

  getPoints(players) {
    var self = this;
    var teamWonCards = players.reduce(function getCards(cards, player) {
      return cards.concat(self.wonCards[player]);
    }, []);
    return _.sum(teamWonCards, function(card) { return getValue(card) });
  }

  getWinner() {
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

    // tie
    return null;
  }

  _isInvalidAssignment(hands) {
    if (!hands) { return true; }

    var hasSuits = this.hasSuits;
    return _.some(hands, function isInvalid (hand, playerIndex) {

      if (hand.length !== this._getRoundStartCardNumber(playerIndex)) {
        return true;
      }

      return _.some(hand, function hasInvalidSuit (card) {
        return hasSuits[playerIndex][getSuit(card)] === false;
      });

    }, this);
  }

  _getSeenCards() {
    var seenCards = _.flatten(this.wonCards)
      .concat(_.flatten(this.hands))
      .concat(this.trick.filter(function(c) { return c !== null }));

    if (!_.includes(seenCards, this.trumpCard)) {
      seenCards.push(this.trumpCard);

      // side effect
      this.hands[this.trumpPlayer].push(this.trumpCard);
    }

    return seenCards;
  }

  _getUnknownCards() {
    return _.difference(startingDeck, this._getSeenCards());
  }

  _getRoundStartCardNumber(playerIndex) {
    if (!this.roundStartCardNumberArray) {
      this.roundStartCardNumberArray = this.hands.map(function (h, playerIndex) {
        return 11 - this.round - (this.trick[playerIndex] ? 1 : 0);
      }, this);
    }

    return this.roundStartCardNumberArray[playerIndex];
  }

  randomize(rng, player) {
    if (typeof player != 'undefined') {
      // clear other player hands when game is already deterministic
      var hand = this.hands[player];
      this.hands = [[],[],[],[]];
      this.hands[player] = hand;
    }

    var unknownCards = this._getUnknownCards();

    var possibleHands, shuffledUnknownCards, counter = 0;

    while (this._isInvalidAssignment(possibleHands)) {

      shuffledUnknownCards = shuffle(unknownCards.slice(), rng);

      possibleHands = copyHands(this.hands);

      possibleHands = possibleHands.map(function distributeUnknownCards(hand, playerIndex) {
        var numberOfCardsToTake = this._getRoundStartCardNumber(playerIndex) - hand.length;
        return hand.concat(shuffledUnknownCards.splice(0, numberOfCardsToTake));
      }, this);

    }

    this.hands = possibleHands;

    return this;
  }

  getAllPossibleHands() {
    var unknownCards = this._getUnknownCards();

    var self = this;
    function buildCombinations(playerIndex, possibleCards, accumulator) {

      if ( playerIndex >= 4 ) {
        return accumulator;
      }

      var playerHand = self.hands[playerIndex];

      var numberCardsToTake = self._getRoundStartCardNumber(playerIndex) - playerHand.length;

      if (numberCardsToTake === 0) {
        return buildCombinations(playerIndex + 1, possibleCards, accumulator.concat([playerHand]));
      }

      return Combinatorics.combination(possibleCards, numberCardsToTake)
        .map(function (combination) {
          var nextPossible = _.difference(possibleCards, combination);

          var newHand = playerHand.concat(combination);

          return buildCombinations(playerIndex + 1, nextPossible, accumulator.concat([newHand]));
        })
        .reduce(flatten)
    }

    return _.chunk(buildCombinations(0, unknownCards, []), 4)
  }

  getAllPossibleStates() {
    var self = this;
    return this.getAllPossibleHands()
      .map(function(possibleHand) {
        var possibleGame = new Sueca(self);
        possibleGame.hands = possibleHand;
        return possibleGame
      })
  }

  getTeam(player) {
    if (player === 0 || player === 2) {
      return 0;
    }
    return 1;
  }

  getGameValue() {
    var team1 = [0, 2];
    var pointsTeam1 = this.getPoints(team1);

    var team2 = [1, 3];
    var pointsTeam2 = this.getPoints(team2);

    var pointsDifferenceForCurrentPlayer;
    if (this.currentPlayer === 0 || this.currentPlayer === 2) {
      pointsDifferenceForCurrentPlayer = pointsTeam1 - pointsTeam2;
    }
    else {
      pointsDifferenceForCurrentPlayer = pointsTeam2 - pointsTeam1;
    }

    var pointsInHand = this.getPoints([this.currentPlayer]);

    var winningBonus = 0;
    var winner = this.getWinner();
    if (winner && _.contains(winner, this.currentPlayer)) {
      winningBonus = 1000;
    }
    else if (winner) {
      winningBonus = -1000;
    }

    return winningBonus + pointsDifferenceForCurrentPlayer + pointsInHand;
  }

  getPrettyPlayerHand(player) {
    var suitOrder = { '♠': 4, '♥': 3, '♦': 2, '♣': 1 };

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
  }
}

exports.Sueca = Sueca;
