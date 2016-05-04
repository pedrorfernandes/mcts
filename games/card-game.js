'use strict';

let _ = require('lodash');
let shuffle = require('../utils/shuffle').shuffle;
let sample = require('../utils/shuffle').sample;

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

function sumColumns(matrix) {
  let result = [];
  let sum;
  let columnsLength = matrix.length;
  let rowsLength = matrix[0].length;
  for (let i = 0; i < columnsLength; i++) {
    sum = 0;
    for (let j = 0; j < rowsLength; j++) {
      sum += matrix[i][j];
    }
    result.push(sum);
  }
  return result;
}

function sumRows(matrix) {
  let result = [];
  let sum;
  let columnsLength = matrix.length;
  let rowsLength = matrix[0].length;
  for (let j = 0; j < rowsLength; j++) {
    sum = 0;
    for (let i = 0; i < columnsLength; i++) {
      sum += matrix[i][j];
    }
    result.push(sum);
  }
  return result;
}

function getRow(matrix, rowIndex) {
  let result = [];
  let columnsLength = matrix.length;
  for (let i = 0; i < columnsLength; i++) {
    result.push(matrix[i][rowIndex]);
  }
  return result;
}

function selectRandomValidCellIndexFromColumn(matrix, columnIndex, rng) {
  let randomValidIndex = selectRandomIndexFromArrayWithFilter(matrix[columnIndex], i => i === true, rng);
  return [columnIndex, randomValidIndex];
}

function selectRandomValidCellIndexFromRow(matrix, rowIndex, rng) {
  let randomValidIndex = selectRandomIndexFromArrayWithFilter(getRow(matrix, rowIndex), i => i === true, rng);
  return [randomValidIndex, rowIndex];
}

function selectRandomIndexFromArrayWithFilter(array, filterFn, rng) {
  let filtered = array.map((x,index) => index).filter(index => filterFn(array[index]));
  return filtered[Math.floor(rng() * filtered.length)];
}

class CardGame {

  constructor(options) {}

  getUnknownCards() {
    throw new Error(this.constructor.name + ".getUnknownCards not implemented");
  }

  _isValidCardAssignment(playerIndex, card) {
    return this.hasSuits[playerIndex][getSuit(card)] === true;
  }

  _hasRestrictions() {
    return _.every(this.hasSuits, playerHasSuit => _.every(playerHasSuit, hasSuit => hasSuit === true))
  }

  _assignCardToPlayer(cardIndex, playerIndex, cardArray) {
    if (cardArray[cardIndex] === undefined) {
      console.log('bad');
    }
    let hiddenCardIndex = this.hands[playerIndex].indexOf(hiddenCard);
    this.hands[playerIndex][hiddenCardIndex] = cardArray[cardIndex];
  }

  _getPlayerIndexesWithHiddenCards() {
    return this.hands.map((hand, index) => index)
      .filter(playerIndex => _.some(this.hands[playerIndex], isCardHidden));
  }

  _shuffleUntilValidWithRestrictions(unknownCards, rng) {
    let possibleHands, shuffledUnknownCards;

    let isInvalidAssignment = (hands) => {
      return _.some(hands, (hand, playerIndex) => {
        return _.some(hand, card => this._isValidCardAssignment(playerIndex, card) === false);
      });
    };

    do {

      shuffledUnknownCards = shuffle(unknownCards.slice(), rng);

      possibleHands = this.hands.map(function distributeUnknownCards(hand) {
        let visibleCards = hand.filter(isCardVisible);
        let numberOfCardsToTake = hand.filter(isCardHidden).length;
        let cardsToTake = shuffledUnknownCards.splice(0, numberOfCardsToTake);
        return visibleCards.concat(cardsToTake);
      }, this);

    } while (isInvalidAssignment(possibleHands));

    this.hands = possibleHands;

    return this;
  }

  _subtractPlayerCardsLeftToAssign(rowSum, playerIndex) {
    if (rowSum === 0) {
      // player already has everything assigned
      return 1000;
    }
    return rowSum - this.hands[playerIndex].filter(isCardHidden).length;
  }

  _assignRandomCardsWithRestrictions(unknownCards, rng) {

    let playerIndexes = this._getPlayerIndexesWithHiddenCards();

    let numberOfUnknownCards = unknownCards.length;

    let hasUnknownCards = (playerIndex) => this.hands[playerIndex].indexOf(hiddenCard) > -1;

    let generateAssignmentMatrix = (unknownCards, playerIndexes) =>
      unknownCards.map(card =>
        playerIndexes.map(playerIndex =>
          this._isValidCardAssignment(playerIndex, card) && hasUnknownCards(playerIndex)
        )
      );

    let assignmentMatrix = generateAssignmentMatrix(unknownCards, playerIndexes);

    let cardPossibilitySums, minColumn, playerPossibilitySums, minRow,
      rowIndex, cell, pickedCardIndex, pickedPlayerIndex, restrictedColumnIndex;

    for (let i = 0; i < numberOfUnknownCards; i++) {

      // find where [0, 0, 1] -> only one 1 and rest 0's
      cardPossibilitySums = sumColumns(assignmentMatrix);
      minColumn = _.min(cardPossibilitySums);

      restrictedColumnIndex = _.findIndex(cardPossibilitySums, sum => sum === 1);
      if (restrictedColumnIndex > -1) {
        cell = [restrictedColumnIndex, assignmentMatrix[restrictedColumnIndex].indexOf(true)];
      }
      else {
        // else, keep trying with player with max restrictions
        playerPossibilitySums = sumRows(assignmentMatrix)
          .map((sum, index) => this._subtractPlayerCardsLeftToAssign(sum, playerIndexes[index]));
        minRow = _.min(playerPossibilitySums);

        rowIndex = selectRandomIndexFromArrayWithFilter(playerPossibilitySums, x => x === minRow, rng);

        cell = selectRandomValidCellIndexFromRow(assignmentMatrix, rowIndex, rng);
      }

      pickedCardIndex = cell[0];

      pickedPlayerIndex = playerIndexes[cell[1]];

      this._assignCardToPlayer(pickedCardIndex, pickedPlayerIndex, unknownCards);

      // card is now assigned, we don't need it in the matrix
      unknownCards.splice(pickedCardIndex, 1);
      assignmentMatrix.splice(pickedCardIndex, 1);

      if (!hasUnknownCards(pickedPlayerIndex)) {
        // if player is fully assigned, 0 all his possibilities
        // playerIndexes.splice(playerIndexes.indexOf(pickedPlayerIndex), 1);
        assignmentMatrix.forEach(column => column[cell[1]] = false);
      }
    }

    return this;
  }

  _assignRandomCards(unknownCards, rng) {
    let shuffledUnknownCards = shuffle(unknownCards, rng);

    this.hands = this.hands.map(function distributeUnknownCards(hand) {
      let visibleCards = hand.filter(isCardVisible);
      let numberOfCardsToTake = hand.filter(isCardHidden).length;
      let cardsToTake = shuffledUnknownCards.splice(0, numberOfCardsToTake);
      return visibleCards.concat(cardsToTake);
    });

    return this;
  }

  randomize(rng) {
    let unknownCards = this.getUnknownCards();

    if (this._hasRestrictions()) {
      return this._assignRandomCards(unknownCards, rng);
    }

    return this._assignRandomCardsWithRestrictions(unknownCards, rng);
  }
}

module.exports = CardGame;