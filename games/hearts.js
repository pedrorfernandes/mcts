'use strict';

let _ = require('lodash');
let randomGenerator = require('seedrandom');
var shuffle = require('../search/shuffle').shuffle;
var sample = require('../search/shuffle').sample;

// for compatibility lodash 3 <-> 4
let max = _.maxBy || _.max;
let min = _.minBy || _.min;
let sum = _.sumBy || _.sum;

function toPlayer(player) {
  return player + 1;
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
  if (card === 'Q♠') {
    return 13;
  }
  if (getSuit(card) === '♥') {
    return 1;
  }
  return 0
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

function isHeartsOrQueenOfSpadesCard(card) {
  return getSuit(card) === '♥' || card === 'Q♠';
}

function isHeartsCard(card) {
  return getSuit(card) === '♥';
}

var valuesScale = {
  'A': 14, 'K': 13, 'J': 12, 'Q': 11, '1': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

var ranks = ['A', 'K', 'J', 'Q', '1', '8', '9', '7', '6', '5', '4', '3', '2'];
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

let numberOfPlayers = 4;

function isGame(object) {
  return object.hands && object.trick;
}

let storeScores = false;

class Hearts {
  constructor(options) {
    // super(options);

    if (isGame(options)) {
      this._clone(options);
      return;
    }

    let seed = options.seed;
    let rng = seed ? randomGenerator(seed) : randomGenerator();
    let shuffledDeck = shuffle(startingDeck, rng);
    this.hands = _.chunk(shuffledDeck, shuffledDeck.length / numberOfPlayers);
    let currentPlayerIndex = _.findIndex(this.hands, hand => _.includes(hand, '2♣'));
    this.currentPlayer = toPlayer(currentPlayerIndex);
    this.lastTrick = null;
    this.trick = _.range(numberOfPlayers).map(() => null);
    this.wonCards = _.range(numberOfPlayers).map(() => []);
    this.round = 1;
    this.suitToFollow = null;
    this.hasSuits = _.range(numberOfPlayers).map(() => ({ '♠': true, '♥': true, '♦': true, '♣': true }));
    this.receivedHearts = _.range(numberOfPlayers).map(() => false);
    this.isHeartsBroken = false;

    if (storeScores) {
      this.score = _.range(numberOfPlayers).map(() => 0);
    }
    this.error = false;
    this.winners = null;
  }

  _clone(game) {
    this.currentPlayer = game.currentPlayer;
    this.hands = copyHands(game.hands);
    this.trick =  game.trick.slice();
    this.wonCards = copyHands(game.wonCards);
    this.round = game.round;
    this.suitToFollow = game.suitToFollow;
    this.receivedHearts = game.receivedHearts.slice();
    this.isHeartsBroken = game.isHeartsBroken;
    this.score = game.score;
    this.hasSuits = game.hasSuits.map(function(playerHasSuits) {
      return {
        '♠': playerHasSuits['♠'],
        '♥': playerHasSuits['♥'],
        '♦': playerHasSuits['♦'],
        '♣': playerHasSuits['♣']
      }
    })
  };

  getFullState() {
    return _.pick(this, [
      'currentPlayer', 'hands', 'trick', 'lastTrick', 
      'wonCards', 'round', 'suitToFollow', 'hasSuits', 
      'error', 'winners', 'score', 'receivedHearts'
    ]);
  }

  getStateView(fullState, player) {
    let playerIndex = toPlayerIndex(player);
    let hideCard = card => null;
    let hideHandIfNotPlayer = function(hand, index) {
      return playerIndex === index ? hand : hand.map(hideCard);
    };

    return _.assign({}, fullState, {
      hands: fullState.hands.map(hideHandIfNotPlayer),
      hand: fullState.hands[playerIndex]
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

  getNextPlayer() {
    return this.currentPlayer;
  }

  _getCardsInTableCount() {
    return this.trick.reduce((count, card) =>
      card !== null ? count + 1 : count, 0);
  }

  getPossibleMoves(playerPerspective) {
    if (playerPerspective && playerPerspective !== this.currentPlayer) {
      return this.getAllPossibilities(playerPerspective);
    }

    let playerIndex = toPlayerIndex(this.currentPlayer);
    let hand = this.hands[playerIndex];

    if (this.round === 1 && _.includes(hand, '2♣')) {
      // The player with the 2 of clubs leads by playing that card. 
      return ['2♣'];
    }

    let cardsInTableCount = this._getCardsInTableCount();

    if (cardsInTableCount === 0 && !this.isHeartsBroken) {
      // You may lead a heart at the beginning of a round only 
      //    if you have only hearts in your hand or if hearts have been broken. 
      // Hearts are broken when anyone plays a heart when they cannot follow suit.
      let notHearts = hand.filter(card => getSuit(card) !== '♥');
      if (notHearts.length > 0) {
        return notHearts;
      }
    }

    let cardsOfSuit = hand.filter(card => getSuit(card) === this.suitToFollow);

    if (this.suitToFollow && cardsOfSuit.length > 0) {
      return cardsOfSuit;
    }

    if (this.round === 1) {
      // In the first round, you may not play a heart or the queen of spades.
      return hand.filter(card => card !== 'Q♠' && getSuit(card) !== '♥');
    }

    return hand;
  }

  isValidMove(player, card) {
    return player === this.currentPlayer
      && this.getPossibleMoves(player).indexOf(card) > -1;
  }

  _updatePlayerHasSuits(playerIndex, playedCard) {
    if (this.suitToFollow && this.suitToFollow !== getSuit(playedCard)) {

      this.hasSuits[playerIndex][this.suitToFollow] = false;
    }
  }

  getHighestCard(table, suitToFollow) {
    let followed = table.filter(card => getSuit(card) === suitToFollow);
    return max(followed, getScaledValue);
  }

  _putCardInTrick(playerIndex, card) {
    this.trick[playerIndex] = card;
    let hand = this.hands[playerIndex];
    hand.splice(hand.indexOf(card), 1);
  }

  _updateIsHeartsBroken() {
    if (!this.isHeartsBroken && this.suitToFollow) {
      let hearts = this.hands.filter(card => card ? getSuit(card) === '♥' : false);
      if (hearts.length > 0) {
        this.isHeartsBroken = true;
      }
    }
  }
  
  move(player, card) {
    let playerIndex = toPlayerIndex(player);

    this._putCardInTrick(playerIndex, card);
    this._updatePlayerHasSuits(playerIndex, card);
    this._updateIsHeartsBroken();

    var cardsInTableCount = this._getCardsInTableCount();

    if (cardsInTableCount === numberOfPlayers) {
      let highestCard = this.getHighestCard(this.trick, this.suitToFollow);
      let roundWinnerIndex = this.trick.indexOf(highestCard);

      this.wonCards[roundWinnerIndex] = this.wonCards[roundWinnerIndex].concat(this.trick);
      
      if (!this.receivedHearts[roundWinnerIndex] && _.some(this.trick, isHeartsCard)) {
        this.receivedHearts[roundWinnerIndex] = true;
      }

      this.lastTrick = this.trick;
      this.trick = _.range(numberOfPlayers).map(() => null);
      this.currentPlayer = toPlayer(roundWinnerIndex);
      this.round += 1;
      this.suitToFollow = null;

      if (_.every(this.hands, hand => hand.length === 0)) {
        this.winners = this._getWinners();
      }

      if (storeScores) {
        this.score = this._getScores();
      }

      return;
    }

    if (cardsInTableCount === 1) {
      this.suitToFollow = getSuit(card);
    }

    this.currentPlayer = this.getPlayerAfter(this.currentPlayer);
  }

  performMove(card)  {
    return this.move(this.currentPlayer, card);
  }

  getPlayerAfter(player) {
    return (player % numberOfPlayers) + 1;
  }

  _getPlayerIndexAfter(player) {
    return (player + 1) % numberOfPlayers;
  }

  _getPlayerThatShotTheMoon() {
    let playersThatReceivedHearts = this.receivedHearts.filter(received => received === true);
    if (playersThatReceivedHearts.length === 1) {
      return toPlayer(playersThatReceivedHearts[0]);
    }
    
    return null;
  }

  getScore(players) {
    if (this.round === 14) {
      let playerThatShotTheMoon = this._getPlayerThatShotTheMoon();

      if (playerThatShotTheMoon) {
        return players.map(player => player === playerThatShotTheMoon ? 0 : 26);
      }
    }

    let wonCards = players.reduce((cards, player) => {
      let playerIndex = toPlayerIndex(player);
      return cards.concat(this.wonCards[playerIndex]);
    }, []);

    return sum(wonCards, card => getValue(card));
  }

  _getPlayers() {
    return [1,2,3,4];
  }

  _getScores() {
    return this._getPlayers().map(player => this.getScore([player]));
  }
  
  _getWinners() {
    let players = this._getPlayers();
    let playerScores = this._getScores();

    let minScore = min(playerScores);

    return players.filter((player, playerIndex) => playerScores[playerIndex] === minScore);
  }

  getWinners() {
    return this.winners;
  }

  getAllPossibilities(playerPerspective) {
    let playerPerspectiveIndex = toPlayerIndex(playerPerspective);
    let playerPerspectiveHand = this.hands[playerPerspectiveIndex];

    let playedCards = _.flatten(this.wonCards);
    let inRoundCards = this.trick.filter(card => card !== null);
    let impossibilities = playerPerspectiveHand.concat(playedCards).concat(inRoundCards);

    let currentPlayerIndex = toPlayerIndex(this.currentPlayer);
    let hasSuits = this.hasSuits[currentPlayerIndex];
    return startingDeck.filter(card => {
      let suit = getSuit(card);
      return hasSuits[suit] && !_.includes(impossibilities, card);
    });
  }

  _isInvalidAssignment(hands) {
    if (!hands) { 
      return true; 
    }
    
    let self = this;

    return _.some(hands, function isInvalid (hand, playerIndex) {

      return _.some(hand, function hasInvalidSuit (card) {
        return self.hasSuits[playerIndex][getSuit(card)] === false;
      });

    });
  }

  _getSeenCards() {
    return _.flatten(this.wonCards)
      .concat(_.flatten(this.hands).filter(isCardVisible))
      .concat(this.trick.filter(isCardVisible));
  }

  _getUnknownCards() {
    return _.difference(startingDeck, this._getSeenCards());
  }

  randomize(rng, player) {
    // if (!_.isUndefined(player)) {
    //   // clear other player hands when game is already visible
    //   var hand = this.hands[player];
    //   this.hands = [[],[],[],[]];
    //   this.hands[player] = hand;
    // }

    let unknownCards = this._getUnknownCards();

    var possibleHands, shuffledUnknownCards;

    do {

      shuffledUnknownCards = shuffle(unknownCards.slice(), rng);

      possibleHands = copyHands(this.hands);

      possibleHands = possibleHands.map(function distributeUnknownCards(hand, playerIndex) {
        let visibleCards = hand.filter(isCardVisible);
        var numberOfCardsToTake = hand.filter(isCardHidden).length;
        return visibleCards.concat(shuffledUnknownCards.splice(0, numberOfCardsToTake));
      }, this);

    } while (this._isInvalidAssignment(possibleHands));

    this.hands = possibleHands;

    return this;
  }

  getAllPossibleHands() {
    throw new Error(this.constructor.name + ".getAllPossibleHands not implemented");
  }

  getAllPossibleStates() {
    throw new Error(this.constructor.name + ".getAllPossibleStates not implemented");
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

exports.Hearts = Hearts;
