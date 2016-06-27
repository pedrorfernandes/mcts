MCTS
====

This library implements a simple [Monte Carlo Tree Search](http://en.wikipedia.org/wiki/Monte_Carlo_tree_search) for games.

## Datasets ##

The datasets generated throughout the dissertation are available [here](https://mega.nz/#F!2ERjjBSI!5YkiicxAxEQfAA16NHs_3Q).

To use a dataset, install couchbase, restore the database from any folder and boot the botwars framework. All game states are fully queriable through a N1QL query editor and also accessible in the web interface.

## Usage ##

Implement a class that has the following methods:

  * getPossibleMoves() returns an array of possible moves
  * performMove(move) updates the internal state of the game based on the move
  * getCurrentPlayer() returns the current player
  * getWinner() returns the winner or undefined if there is no winner

Then to get the next move a player should perform call getcall MCTS with an instance of your game class. Here is a totally contrived game where whoever goes first wins:

    MCTS = require('mcts').MCTS;
    
    function Game() {
      this.winner = null;
    }
    
    Game.prototype.getPossibleMoves = function () {
      if (this.winner === null) {
        return [0];
      }
      return [];
    };
    
    Game.prototype.getCurrentPlayer = function () {
      return 0;
    };
     
    Game.prototype.performMove = function (player) {
      this.winner = player;
    };
    
    Game.prototype.getWinner = function () {
      return this.winner;
    };
    
    var mcts = new MCTS(new Game());
    console.log(mcts.selectMove());
    
    0
