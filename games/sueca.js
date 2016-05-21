'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
let shuffle = require('../utils/shuffle').shuffle;
let CardGame = require('./card-game');
let crypto = require('crypto');

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

function isGame(object) {
  return object && object.hands && object.trick;
}

let numberOfPlayers = 4;

let storeScores = false;

let gameValues = [-4, -2, -1, 0, 1, 2, 4];
let gameValueRanges = [[0], [1, 29], [30, 59], [60], [61, 90], [91, 119], [120]];

function getGameValue(score) {

  let gameValueIndex = _.findIndex(gameValueRanges, range => {
    if (range.length === 1) {
      return score === range[0];
    }
    return score >= range[0] && score <= range[1];
  });

  return gameValues[gameValueIndex];
}

let getCachedGameValue = _.memoize(getGameValue);

class Sueca extends CardGame {
  constructor(options) {
    super(options);

    if (isGame(options)) {
      this._clone(options);
      return;
    }

    let seed = _.get(options, 'seed');
    let rng = seed ? randomGenerator(seed) : randomGenerator();
    let lastGameTrumpPlayer = _.get(options, 'lastGame.trumpPlayer');
    if (lastGameTrumpPlayer) {
      this.trumpPlayer = this.getPlayerAfter(lastGameTrumpPlayer);
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

  toUniqueStateHash() {
    let cardSort = (card1, card2) => card1 > card2;

    this.score = this._getTeamScores();

    let uniqueCharacteristics = {
      trumpPlayer: this.trumpPlayer,
      nextPlayer: this.nextPlayer,
      hands: this.hands.map(h => h.sort(cardSort)),
      wonCards: _.flatten(this.wonCards).sort(cardSort),
      trumpSuit: this.trumpSuit,
      trumpCard: this.trumpCard,
      trick: this.trick,
      score: this.score,
      round: this.round,
      suitToFollow: this.suitToFollow,
      hasSuits: this.hasSuits,
      winners: this.winners
    };

    return crypto.createHash('md5').update(JSON.stringify(uniqueCharacteristics)).digest("hex");
  }

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

  isTie() {
    return _.isEqual(this.winners, [1,2,3,4]);
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

  getScore(players) {
    let teamWonCards = players.reduce((cards, player) => {
      let playerIndex = toPlayerIndex(player);
      return cards.concat(this.wonCards[playerIndex])
    }, []);

    return _.sumBy(teamWonCards, card => getValue(card));
  }

  getWonGames(player) {
    let score = this.getScore([player]);
    return getCachedGameValue(score);
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
    return [1,2,3,4];
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

    let winningBonus = 0;
    let winner = this._getWinners();
    if (winner && _.includes(winner, this.nextPlayer)) {
      winningBonus = 1000;
    }
    else if (winner) {
      winningBonus = -1000;
    }

    return winningBonus + pointsDifferenceForNextPlayer;
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

module.exports = Sueca;
