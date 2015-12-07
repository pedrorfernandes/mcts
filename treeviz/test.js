var ISMCTS = require('../mcts/ismcts.js').ISMCTS;
var stringify = require('json-stringify-safe');
var treeDump = require('./treedump.js').treeDump;

var seedrandom = require('seedrandom');
var rng = seedrandom();

var Sueca = require('../test/sueca').Sueca;

var seed = 0.3191013755078013;//rng();
console.log(seed);

var savedState = {"game":{"currentPlayer":2,"hands":[[],[],["4♣","3♥","Q♠","K♣","3♠","7♥","J♥","7♠","K♥","3♦"],[]],"trump":"♣","trick":["2♣","5♣",null,"A♣"],"trumpCard":"4♣","trumpPlayer":2,"wonCards":[[],[],[],[]],"round":1,"suitToFollow":"♣","hasSuits":[{"♠":true,"♥":true,"♦":true,"♣":true},{"♠":true,"♥":true,"♦":true,"♣":true},{"♠":true,"♥":true,"♦":true,"♣":true},{"♠":true,"♥":true,"♦":true,"♣":true}]},"rng":{"i":50,"j":13,"S":[151,5,76,210,120,100,254,92,250,221,248,73,4,9,41,175,85,246,51,127,23,232,101,102,1,253,178,247,55,42,0,67,130,182,131,64,90,119,114,135,159,148,202,191,177,58,150,139,218,56,33,87,39,50,31,124,105,45,226,237,61,62,74,233,222,84,163,24,229,129,3,172,17,180,208,215,241,167,223,146,6,27,255,36,52,231,69,225,112,205,235,193,13,213,113,185,186,118,252,238,16,154,20,108,239,86,132,251,43,128,187,152,196,249,15,34,192,156,243,88,219,137,38,79,169,157,203,10,125,166,83,153,199,7,236,21,184,98,78,63,136,2,141,227,133,171,173,60,162,145,94,183,57,25,95,30,75,161,155,37,12,220,59,117,54,107,121,8,195,204,106,32,48,164,26,200,29,179,68,181,40,47,109,110,176,228,72,194,53,240,230,134,35,77,197,143,80,174,22,242,103,18,89,142,123,126,245,165,244,212,122,217,104,115,214,209,99,207,111,211,91,201,46,216,97,65,198,190,49,66,71,149,147,44,168,116,189,188,70,19,14,234,144,96,158,93,138,170,82,11,81,160,140,224,28,206]},"player":2,"iterations":10000};

var sueca = new Sueca(savedState.game);

var mcts = new ISMCTS(sueca, 10000, sueca.currentPlayer, seed);

console.time('selectMove');
var move = mcts.selectMove();
console.timeEnd('selectMove');
console.log(sueca.getPrettyPlayerHand(sueca.currentPlayer));
console.log(sueca.currentPlayer + ' played ' + move  + '\n');
sueca.performMove(move);
treeDump('test.json', mcts);
