var ISMCTS = require('../mcts/ismcts.js').ISMCTS;
var stringify = require('json-stringify-safe');
var Dumper = require('./dumper.js');

var seedrandom = require('seedrandom');
var rng = seedrandom();

var Sueca = require('../test/sueca').Sueca;

var seed = rng();//0.2066450214900075;//rng();
console.log(seed);

var savedState = {"game":{"currentPlayer":3,"hands":[[],[],[],["A♠","Q♣","5♥","2♣","Q♠","4♦","K♦","7♠","7♥"]],"trump":"♦","trick":["6♥","A♥","3♥",null],"trumpCard":"3♦","trumpPlayer":1,"wonCards":[["2♦","4♣","J♣","A♣"],[],[],[]],"round":2,"suitToFollow":"♥","hasSuits":[{"♠":true,"♥":true,"♦":true,"♣":false},{"♠":true,"♥":true,"♦":true,"♣":true},{"♠":true,"♥":true,"♦":true,"♣":true},{"♠":true,"♥":true,"♦":true,"♣":true}]},"rng":{"i":0,"j":108,"S":[134,4,140,191,100,118,9,59,153,251,196,157,215,47,68,91,235,15,111,13,32,107,20,213,241,115,81,123,201,137,204,23,53,37,75,181,207,131,26,39,30,65,203,189,234,28,182,237,214,178,146,164,55,247,2,255,109,88,230,124,43,94,7,116,228,0,192,119,5,102,125,101,145,113,70,139,162,71,114,209,129,141,184,195,54,12,117,151,31,11,248,193,150,172,226,77,14,186,154,50,211,242,216,231,67,74,41,175,133,69,6,78,21,168,199,61,93,187,18,45,246,169,249,232,250,103,225,105,22,35,73,92,90,142,95,128,148,58,220,190,233,40,160,27,171,223,80,132,218,224,44,188,83,10,254,138,238,136,185,56,208,108,62,97,1,122,197,3,84,217,205,144,159,194,130,176,19,222,180,212,104,121,147,155,158,240,24,120,46,202,89,52,198,8,126,85,34,112,243,72,167,227,174,106,76,51,38,79,36,156,244,143,221,96,161,60,17,152,206,245,48,42,135,49,163,200,239,82,16,179,33,229,29,170,210,149,98,99,87,110,57,64,253,127,63,236,219,173,165,177,25,86,166,66,252,183]},"player":3,"iterations":10000};

var sueca = new Sueca(savedState.game);

var mcts = new ISMCTS(sueca, 100000, savedState.player, seed);

console.time('selectMove');
var move = mcts.selectMove();
console.timeEnd('selectMove');
console.log(sueca.getPrettyPlayerHand(sueca.currentPlayer));
console.log(sueca.currentPlayer + ' played ' + move  + '\n');
sueca.performMove(move);
Dumper.saveAll('test.json', mcts);
