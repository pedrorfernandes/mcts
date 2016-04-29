'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
let shuffle = require('../search/shuffle').shuffle;
let sample = require('../search/shuffle').sample;
let Combinatorics = require('js-combinatorics');
let CardGame = require('./card-game').CardGame;

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

let values = {
  'A': 11, '7': 10, 'K': 4, 'J': 3, 'Q': 2, '6': 0, '5': 0, '4': 0, '3': 0, '2': 0
};

let valuesScale = {
  'A': 10, '7': 9, 'K': 8, 'J': 7, 'Q': 6, '6': 5, '5': 4, '4': 3, '3': 2, '2': 1
};

let ranks = ['A', '7', 'K', 'J', 'Q', '6', '5', '4', '3', '2'];
let suits = ['♠', '♥', '♦', '♣'];

let startingDeck = suits.reduce(function(deck, suit) {
  return deck.concat(ranks.map(function(rank) {
    return Card(rank, suit);
  }));
}, []);

function copyHands(hand) {
  let newArray = [];
  for (let i = 0; i < hand.length; i++) {
    newArray[i] = hand[i].slice();
  }

  return newArray
}

function flatten (a, b) {
  return a.concat(b);
}

function isGame(object) {
  return object.hands && object.trick;
}

let numberOfPlayers = 4;

let storeScores = false;

class Sueca extends CardGame {
  constructor(options) {
    super(options);

    if (isGame(options)) {
      this._clone(options);
      return;
    }

    let seed = options.seed;
    let rng = seed ? randomGenerator(seed) : randomGenerator();
    let lastGameTrumpPlayer = _.get(options, 'lastGame.trumpPlayer');
    if (lastGameTrumpPlayer) {
      this.trumpPlayer = Sueca.getPlayerAfter(lastGameTrumpPlayer);
    } else {
      this.trumpPlayer = Math.floor(rng() * numberOfPlayers + 1);
    }
    this.nextPlayer = this.getPlayerAfter(this.trumpPlayer);
    this.hands = _.chunk(shuffle(startingDeck, rng), 10);
    this.trumpCard = _.last(this.hands[toPlayerIndex(this.trumpPlayer)]);
    this.trumpSuit = getSuit(this.trumpCard);
    this.lastTrick = null;
    this.trick = _.range(numberOfPlayers).map(() => null);
    this.wonCards = _.range(numberOfPlayers).map(() => []);
    this.round = 1;
    this.suitToFollow = null;
    this.hasSuits = _.range(numberOfPlayers).map(() => ({ '♠': true, '♥': true, '♦': true, '♣': true }));
    this.winners = null;

    if (storeScores) {
      this.score = this._getTeams().map(() => 0);
    }

    this.error = false;
  }

  _clone(game) {
    this.trumpPlayer = game.trumpPlayer;
    this.nextPlayer = game.nextPlayer;
    this.hands = copyHands(game.hands);
    this.trumpSuit = game.trumpSuit;
    this.trumpCard = game.trumpCard;
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
    this.lastTrick = null;
    this.error = game.error;
  };

  getFullState() {
    return _.pick(this, [
      'trumpPlayer', 'nextPlayer', 'hands', 'trumpSuit', 'trumpCard',
      'trick', 'wonCards', 'round', 'suitToFollow',
      'hasSuits', 'winners', 'score', 'lastTrick'
    ]);
  }

  getStateView(fullState, player) {
    let self = this;
    let playerIndex = toPlayerIndex(player);
    let hideIfNotTrumpCard = card => card !== self.trumpCard ? null : card;
    let hideHandIfNotPlayer = function(hand, index) {
      return playerIndex === index ? hand : hand.map(hideIfNotTrumpCard);
    };

    return _.assign({}, fullState, {
      hands: fullState.hands.map(hideHandIfNotPlayer),
      hand: fullState.hands[toPlayerIndex(player)]
    });
  }

  getPlayerCount() {
    return numberOfPlayers;
  }

  isEnded() {
    return this.error || this.winners !== null;
  }

  isError() {
    return this.error;
  }

  _getStartingDeck() {
    return startingDeck;
  }

  getNextPlayer() {
    return this.nextPlayer;
  }

  _getCardsInTableCount() {
    return this.trick.reduce((count, card) =>
      card !== null ? count + 1 : count, 0);
  }

  getPossibleMoves() {
    let playerIndex = toPlayerIndex(this.nextPlayer);
    let hand = this.hands[playerIndex];

    if (hand.indexOf(hiddenCard) > -1) {
      return this.getAllPossibilities(this.nextPlayer).concat(hand.filter(isCardVisible));
    }

    if (this._getCardsInTableCount() === 0) {
      return hand;
    }

    let cardsOfSuit = [];

    if (this.suitToFollow) {
      cardsOfSuit = hand.filter(card => getSuit(card) === this.suitToFollow);
    }

    if (_.isEmpty(cardsOfSuit)) {
      return hand;
    }

    return cardsOfSuit;
  }

  isValidMove(player, card) {
    return player === this.nextPlayer
      && this.getPossibleMoves().indexOf(card) > -1;
  }

  _updatePlayerHasSuits(playerIndex, playedCard) {
    if (this.suitToFollow && this.suitToFollow !== getSuit(playedCard)) {

      this.hasSuits[playerIndex][this.suitToFollow] = false;
    }
  }

  getHighestCard(table, suitToFollow) {
    let trumps = table.filter(card => getSuit(card) === this.trumpSuit);

    if (trumps.length > 0) {
      return _.maxBy(trumps, getScaledValue);
    }

    let followed = table.filter(card => getSuit(card) === suitToFollow);

    return _.maxBy(followed, getScaledValue);
  }

  _putCardInTrick(playerIndex, card) {
    this.trick[playerIndex] = card;
    let hand = this.hands[playerIndex];
    hand.splice(hand.indexOf(card), 1);
  }

  move(player, card) {
    let playerIndex = toPlayerIndex(player);

    this._putCardInTrick(playerIndex, card);
    this._updatePlayerHasSuits(playerIndex, card);

    let cardsInTableCount = this._getCardsInTableCount();

    if (cardsInTableCount === numberOfPlayers) {
      let highestCard = this.getHighestCard(this.trick, this.suitToFollow);
      let roundWinnerIndex = this.trick.indexOf(highestCard);
      this.wonCards[roundWinnerIndex] = this.wonCards[roundWinnerIndex].concat(this.trick);

      this.lastTrick = this.trick;
      this.trick = _.range(numberOfPlayers).map(() => null);
      this.nextPlayer = toPlayer(roundWinnerIndex);
      this.round += 1;
      this.suitToFollow = null;

      if (_.every(this.hands, hand => hand.length === 0)) {
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

  performMove(card) {
    return this.move(this.nextPlayer, card);
  }

  getPlayerAfter(player) {
    return (player % numberOfPlayers) + 1;
  }

  getNextPlayer() {
    return this.nextPlayer;
  }

  getScore(players) {
    let teamWonCards = players.reduce((cards, player) => {
      let playerIndex = toPlayerIndex(player);
      return cards.concat(this.wonCards[playerIndex])
    }, []);

    return _.sumBy(teamWonCards, card => getValue(card));
  }

  _getTeams() {
    return [[1,3], [2,4]];
  }

  _getTeamScores() {
    return this._getTeams().map(this.getScore, this);
  }

  getWinners() {
    return this.winners;
  }

  _getWinners() {
    let team1 = [1, 3];
    let pointsTeam1 = this.getScore(team1);
    if (pointsTeam1 >= 61) {
      return team1;
    }

    let team2 = [2, 4];
    let pointsTeam2 = this.getScore(team2);
    if (pointsTeam2 >= 61) {
      return team2;
    }

    // tie
    return null;
  }

  getAllPossibilities() {
    let visibleCards = _.flatten(this.hands).filter(isCardVisible);
    let playedCards = _.flatten(this.wonCards);
    let inRoundCards = this.trick.filter(isCardVisible);

    let nextPlayerIndex = toPlayerIndex(this.nextPlayer);
    let hasSuits = this.hasSuits[nextPlayerIndex];

    let impossibilities = visibleCards
      .concat(playedCards).concat(inRoundCards);

    return startingDeck.filter(function(card) {
      let suit = getSuit(card);
      return hasSuits[suit] && impossibilities.indexOf(card) === -1;
    });
  }

  _getSeenCards() {
    return _.flatten(this.wonCards)
      .concat(_.flatten(this.hands).filter(isCardVisible))
      .concat(this.trick.filter(isCardVisible));
  }

  getUnknownCards() {
    return _.difference(startingDeck, this._getSeenCards());
  }

  getAllPossibleHands() {
    let unknownCards = this.getUnknownCards();

    let self = this;
    function buildCombinations(playerIndex, possibleCards, accumulator) {

      if ( playerIndex >= 4 ) {
        return accumulator;
      }

      let playerHand = self.hands[playerIndex];

      let numberOfCardsToTake = playerHand.filter(isCardHidden).length;

      if (numberOfCardsToTake === 0) {
        return buildCombinations(playerIndex + 1, possibleCards, accumulator.concat([playerHand]));
      }

      return Combinatorics.combination(possibleCards, numberOfCardsToTake)
        .map(function (combination) {
          let nextPossible = _.difference(possibleCards, combination);

          let newHand = playerHand.concat(combination);

          return buildCombinations(playerIndex + 1, nextPossible, accumulator.concat([newHand]));
        })
        .reduce(flatten)
    }

    return _.chunk(buildCombinations(0, unknownCards, []), 4)
  }

  getAllPossibleStates() {
    let self = this;
    return this.getAllPossibleHands()
      .map(function(possibleHand) {
        let possibleGame = new Sueca(self);
        possibleGame.hands = possibleHand;
        return possibleGame
      })
  }

  getTeam(player) {
    if (player === 1 || player === 3) {
      return 0;
    }
    return 1;
  }

  getGameValue() {
    let team1 = [1, 3];
    let pointsTeam1 = this.getScore(team1);

    let team2 = [2, 4];
    let pointsTeam2 = this.getScore(team2);

    let pointsDifferenceForNextPlayer;
    if (this.nextPlayer === 1 || this.nextPlayer === 3) {
      pointsDifferenceForNextPlayer = pointsTeam1 - pointsTeam2;
    }
    else {
      pointsDifferenceForNextPlayer = pointsTeam2 - pointsTeam1;
    }

    let nextPlayerIndex = toPlayerIndex(this.nextPlayer);
    let pointsInHand = this.getScore([nextPlayerIndex]);

    let winningBonus = 0;
    let winner = this._getWinners();
    if (winner && _.includes(winner, this.nextPlayer)) {
      winningBonus = 1000;
    }
    else if (winner) {
      winningBonus = -1000;
    }

    return winningBonus + pointsDifferenceForNextPlayer + pointsInHand;
  }

  getPrettyPlayerHand(player) {
    let suitOrder = { '♠': 4, '♥': 3, '♦': 2, '♣': 1 };

    let playerIndex = toPlayerIndex(player);

    let hand = this.hands[playerIndex].slice().sort(function(cardA, cardB) {
      let valueA = suitOrder[getSuit(cardA)] * 100 + getScaledValue(cardA);
      let valueB = suitOrder[getSuit(cardB)] * 100 + getScaledValue(cardB);
      return valueB - valueA;
    });
    let grouped = _.groupBy(hand, function(card) { return getSuit(card); });
    let string = _.reduce(grouped, function(string, suit) {
      return string + ' | ' + suit.join(' ')
    }, '');
    return 'His hand is ' + string;
  }
}

exports.Sueca = Sueca;
