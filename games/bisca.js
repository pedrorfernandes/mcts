'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
var shuffle = require('../utils/shuffle').shuffle;
var sample = require('../utils/shuffle').sample;
let CardGame = require('./card-game');

function toPlayer(playerIndex) {
  return playerIndex + 1;
}

function toPlayerIndex(player) {
  return player - 1;
}

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

function isCardVisible(card) {
  return card !== null;
}

function isCardHidden(card) {
  return card === null;
}

let hiddenCard = null;

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

function copyHands(hand) {
  var newArray = [];
  for (var i = 0; i < hand.length; i++) {
    newArray[i] = hand[i].slice();
  }
  return newArray
}

let teamsPerNumberOfPlayers = {
  2: [[0], [1]],
  4: [[0,2], [1,3]]
};

let cardNumbersPerPlayerNumbers = {
  2: 9,
  4: 6
};

function getNumberOfCardsPerPlayer(numberOfPlayers) {
  return cardNumbersPerPlayerNumbers[numberOfPlayers];
}

function isGame(object) {
  return object && object.hands && object.trick;
}

let storeScores = false;

class Bisca extends CardGame {
  constructor(options) {
    super(options);

    if (isGame(options)) {
      this._clone(options);
      return;
    }

    let seed = _.get(options, 'seed');
    this.numberOfPlayers = _.get(options, 'numberOfPlayers') || 2;
    let numberOfCardsPerPlayer = getNumberOfCardsPerPlayer(this.numberOfPlayers);
    let rng = seed ? randomGenerator(seed) : randomGenerator();
    let initialDeck = shuffle(startingDeck, rng);
    let initialNumberOfDealtCards = numberOfCardsPerPlayer * this.numberOfPlayers;
    let initialHands = initialDeck.slice(0, initialNumberOfDealtCards);
    this.deck = initialDeck.slice(initialNumberOfDealtCards, initialDeck.length);
    this.hands = _.chunk(initialHands, numberOfCardsPerPlayer);
    this.trumpCard = _.last(this.deck);
    this.trump = getSuit(this.trumpCard);

    let lastGameStartingPlayer = _.get(options, 'lastGame.startingPlayer');

    if (lastGameStartingPlayer) {
      this.startingPlayer = this.getPlayerAfter(lastGameStartingPlayer);
    } else {
      this.startingPlayer = Math.floor(rng() * this.numberOfPlayers + 1);
    }

    this.nextPlayer = this.startingPlayer;
    this.lastTrick = null;
    this.trick = _.range(this.numberOfPlayers).map(() => null);
    this.wonCards = _.range(this.numberOfPlayers).map(() => []);
    this.round = 1;
    this.suitToFollow = null;
    this.hasSuits = _.range(this.numberOfPlayers).map(() => ({ '♠': true, '♥': true, '♦': true, '♣': true }));

    if (storeScores) {
      this.score = _.range(this.numberOfPlayers).map(() => 0);
    }
    this.error = false;
    this.winners = null;
  }

  _clone(game) {
    this.numberOfPlayers = game.numberOfPlayers;
    this.deck = game.deck.slice();
    this.hands = copyHands(game.hands);
    this.trumpCard = game.trumpCard;
    this.trump = game.trump;
    this.startingPlayer = game.startingPlayer;
    this.nextPlayer = game.nextPlayer;
    this.lastTrick = null;
    this.trick =  game.trick.slice();
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
    });
    this.winners = game.winners;
    this.score = game.score;
    this.error = game.error;
  };

  getFullState() {
    return _.pick(this, [
      'numberOfPlayers', 'deck', 'hands', 'trumpCard', 'trump',
      'startingPlayer', 'nextPlayer', 'lastTrick', 'trick', 'wonCards', 'round',
      'suitToFollow', 'hasSuits', 'error', 'winners', 'score'
    ]);
  }

  getPlayerCount() { return this.numberOfPlayers; }

  isEnded() {
    return this.error || this.winners !== null;
  }

  isError() { return this.error; }

  isTie() {
    // TODO consider bisca of 4
    return this.winners && this.winners.length >= 2;
  }

  getNextPlayer() { return this.nextPlayer; }

  _getCardsInTableCount() {
    return this.trick.reduce((count, card) => card !== null ? count + 1 : count, 0);
  }

  _getTeams() {
    return teamsPerNumberOfPlayers[this.numberOfPlayers];
  }

  getPossibleMoves() {

    let playerIndex = toPlayerIndex(this.nextPlayer);
    let hand = this.hands[playerIndex];

    if (hand.indexOf(hiddenCard) > -1) {
      return this.getAllPossibilities(this.nextPlayer).concat(hand.filter(isCardVisible));
    }

    let playableCards = null;

    let cardsOfSuit = hand.filter(card => getSuit(card) === this.suitToFollow);

    if (this.suitToFollow && this._isMandatoryToFollowSuit() && cardsOfSuit.length > 0) {
      playableCards = cardsOfSuit;
    } else {
      playableCards = hand;
    }

    if (hand.indexOf(hiddenCard) > -1) {
      return this.getAllPossibilities(this.nextPlayer).concat(playableCards);
    }

    return playableCards;
  }

  isValidMove(player, card) {
    return player === this.nextPlayer
      && this.getPossibleMoves().indexOf(card) > -1;
  }

  _putCardInTrick(playerIndex, card) {
    this.trick[playerIndex] = card;
    let hand = this.hands[playerIndex];
    hand.splice(hand.indexOf(card), 1);
  }

  _takeCardFromDeck(playerIndex) {
    this.hands[playerIndex].push(this.deck[0]);
    this.deck.splice(0, 1);
  }

  _takeCardsFromDeck(roundWinnerIndex) {
    let playerIndex = roundWinnerIndex;
    do {
      this._takeCardFromDeck(playerIndex);
      playerIndex = this._getPlayerIndexAfter(playerIndex);
    } while (playerIndex !== roundWinnerIndex);
  }

  move(player, card) {
    let playerIndex = player - 1;

    this._putCardInTrick(playerIndex, card);
    this._updatePlayerHasSuits(playerIndex, card);

    var cardsInTableCount = this._getCardsInTableCount();

    if (cardsInTableCount === this.numberOfPlayers) {
      var highestCard = this.getHighestCard(this.trick, this.suitToFollow);

      var roundWinnerIndex = this.trick.indexOf(highestCard);

      this.wonCards[roundWinnerIndex] = this.wonCards[roundWinnerIndex].concat(this.trick);

      this.previousPlayer = this.nextPlayer;
      this.lastTrick = this.trick;
      this.trick = _.range(this.numberOfPlayers).map(() => null);
      this.nextPlayer = toPlayer(roundWinnerIndex);
      this.round += 1;
      this.suitToFollow = null;

      if (this.deck.length > 0) {
        this._takeCardsFromDeck(roundWinnerIndex);
      }

      if (this.deck.length === 0 && _.every(this.hands, hand => hand.length === 0)) {
        this.winners = this._getWinners();
      }

      if (storeScores) {
        this.score = this._getTeamScores();
      }

      return;
    }

    if (cardsInTableCount === 1) {
      this.suitToFollow = getSuit(card);
    }

    this.nextPlayer = this.getPlayerAfter(this.nextPlayer);
  }

  performMove(card)  {
    return this.move(this.nextPlayer, card);
  }

  getPlayerAfter(player) {
    return (player % this.numberOfPlayers) + 1;
  }

  _getPlayerIndexAfter(player) {
    return (player + 1) % this.numberOfPlayers;
  }

  onMoveTimeout() {
    this.winners = Bisca.getTeam(this.getPlayerAfter(this.nextPlayer));
    this.nextPlayer = null;
    return true;
  }

  getStateView(fullState, player) {
    let self = this;
    let playerIndex = toPlayerIndex(player);
    let hideIfNotTrumpCard = card => card !== self.trumpCard ? null : card;
    let hideHandIfNotPlayer = function(hand, index) {
      return playerIndex === index ? hand : hand.map(hideIfNotTrumpCard);
    };

    return _.assign({}, fullState, {
      deck: fullState.deck.map(hideIfNotTrumpCard),
      hands: fullState.hands.map(hideHandIfNotPlayer),
      hand: fullState.hands[toPlayerIndex(player)]
    });
  }

  getHighestCard(table, suitToFollow) {
    let trumps = table.filter(card => getSuit(card) === this.trump);

    if (trumps.length > 0) {
      return _.maxBy(trumps, getScaledValue);
    }

    let followed = table.filter(card => getSuit(card) === suitToFollow);

    return _.maxBy(followed, getScaledValue);
  }

  _isMandatoryToFollowSuit() {
    return this.deck.length === 0;
  }

  _updatePlayerHasSuits(playerIndex, playedCard) {
    let playedSuit = getSuit(playedCard);
    if (this.suitToFollow
      && this.suitToFollow !== playedSuit
      && this._isMandatoryToFollowSuit()) {

      this.hasSuits[playerIndex][this.suitToFollow] = false;
    }
  }

  getScore(players) {
    let teamWonCards = players.reduce(
      (cards, player) => cards.concat(this.wonCards[player]), []);

    return _.sumBy(teamWonCards, card => getValue(card));
  }

  _getTeamScores() {
    return this._getTeams().map(this.getScore, this);
  }

  getWinners() {
    return this.winners;
  }

  _getWinners() {
    let teams = this._getTeams();
    let teamScores = this._getTeamScores();

    let maxScore = _.max(teamScores);

    let winningTeam = teams.filter((team, teamIndex) => teamScores[teamIndex] === maxScore);

    return _.flatten(winningTeam).map(toPlayer);
  }

  getAllPossibilities() {
    let visibleCards = _.flatten(this.hands).filter(isCardVisible);
    let playedCards = _.flatten(this.wonCards);
    let inRoundCards = this.trick.filter(isCardVisible);
    let visibleDeckCards = this.deck.filter(isCardVisible);
    let impossibilities = visibleCards.concat(playedCards)
      .concat(inRoundCards).concat(visibleDeckCards);

    let nextPlayerIndex = toPlayerIndex(this.nextPlayer);
    let hasSuits = this.hasSuits[nextPlayerIndex];
    return startingDeck.filter(card => {
      let suit = getSuit(card);
      return hasSuits[suit] && !_.includes(impossibilities, card);
    });
  }

  _getSeenCards() {
    return _.flatten(this.wonCards)
      .concat(_.flatten(this.hands).filter(isCardVisible))
      .concat(this.trick.filter(isCardVisible))
      .concat(this.deck.filter(isCardVisible));
  }

  getUnknownCards() {
    return _.difference(startingDeck, this._getSeenCards());
  }

  randomize(rng) {
    super.randomize(rng);

    let shuffledUnknownCards = shuffle(this.getUnknownCards());

    this.deck = this.deck.map(card => {
      if (isCardVisible(card)) {
        return card;
      }
      return shuffledUnknownCards.splice(0, 1)[0];
    });

    return this;
  }

  getAllPossibleHands() {
    throw new Error(this.constructor.name + ".getAllPossibleHands not implemented");
  }

  getAllPossibleStates() {
    throw new Error(this.constructor.name + ".getAllPossibleStates not implemented");
  }

  getTeam(player) {
    throw new Error(this.constructor.name + ".getTeam not implemented");
  }

  getGameValue() {
    throw new Error(this.constructor.name + ".getGameValue not implemented");
  }

  getPrettyPlayerHand(player) {
    var suitOrder = { '♠': 4, '♥': 3, '♦': 2, '♣': 1 };

    var hand = this.hands[toPlayerIndex(player)].slice()
      .filter(c => c !== null)
      .sort(function(cardA, cardB) {
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

module.exports = Bisca;
