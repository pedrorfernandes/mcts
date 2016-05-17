'use strict';

let _ = require('lodash');
let sample = require('../../utils/shuffle').sample;

function sumAll(sum, number) {
  return sum + number;
}

function toGibbsParcel(x, gibbsGreedyConstant) {
  return Math.exp(x / gibbsGreedyConstant)
}

function mapToGibbsDistribution(averages, gibbsGreedyConstant) {
  let sums = averages.map(avg => toGibbsParcel(avg, gibbsGreedyConstant));
  let sumAllParcels = sums.reduce(sumAll, 0);

  return sums.map(x => x / sumAllParcels);
}

function calculateNGramAverage(nGramStatistics) {
  if (!nGramStatistics) {
    throw new Error('nGramStatistics must be a valid object!')
  }

  return nGramStatistics.reward / nGramStatistics.count;
}

function selectRandomIndexWithOdds(odds, rng) {
  let cumulativeOdds = odds.reduce((cumulativeOdds, odd, index) => {
    let cumulativeOdd = index === 0 ? odd : odd + cumulativeOdds[index - 1];
    cumulativeOdds.push(cumulativeOdd);
    return cumulativeOdds;
  }, []);

  let randomNumber = rng();

  return _.findIndex(cumulativeOdds, odd => randomNumber < odd);
}

function createGibbsSimulationPolicyFunction(options) {
  // τ ∈ {0.05, 0.1, 0.15, 0.2, 0.25, 0.5, 1, 1.5, 2, 4}
  let gibbsGreedyConstant = _.get(options, 'gibbsGreedyConstant', 1.0);

  return function (nGramStatistics, rng) {

    let nGramAverages = nGramStatistics.map(calculateNGramAverage);

    let gibbsDistribution = mapToGibbsDistribution(nGramAverages, gibbsGreedyConstant);

    return selectRandomIndexWithOdds(gibbsDistribution, rng);
  }
}

function toIndexes(object, index) {
  return index;
}

function createEGreedySimulationPolicyFunction(options) {
  // For ε-greedy, ε ∈ {0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6} was tested and ε = 0.2 found to be best
  let eGreedyConstant = _.get(options, 'eGreedyConstant', 0.2);

  return function (nGramStatistics, rng) {

    let nGramAverages = nGramStatistics.map(calculateNGramAverage);

    let randomNumber = rng();

    // [0, constant] -> choose uniformly at random
    // [constant, 1] -> choose max average

    if (randomNumber < eGreedyConstant) {
      return sample(nGramAverages.map(toIndexes), rng);
    }

    let maxAverages = _.max(nGramAverages);

    let maximalNGramAverages = nGramAverages.map(toIndexes).filter(index => nGramAverages[index] === maxAverages);

    return sample(maximalNGramAverages, rng);
  }
}

function mapToRouletteDistribution(averages) {
  let sum = _.sum(averages);

  if (sum === 0) {
    let equalPart = 1.0 / averages.length;
    return averages.map(() => equalPart);
  }

  return averages.map(x => x / sum);
}

function createRouletteSimulationPolicyFunction(options) {

  return function (nGramStatistics, rng) {

    let nGramAverages = nGramStatistics.map(calculateNGramAverage);

    let rouletteDistribution = mapToRouletteDistribution(nGramAverages);

    return selectRandomIndexWithOdds(rouletteDistribution, rng);
  }
}

let toUCB1Value = function (nGramStats, parentCount, explorationValue) {
  // nGramStats = { reward: 0, count: 0 };
  if (explorationValue !== 0) {
    return (nGramStats.reward / nGramStats.count) + explorationValue * Math.sqrt(2 * Math.log(parentCount) / nGramStats.count);
  } else {
    return (nGramStats.reward / nGramStats.count);
  }
};

function createUCB1SimulationPolicyFunction(options) {

  let ucb1Constant = _.get(options, 'ucb1Constant', 0.7);

  return function (nGramStatistics, rng) {

    let parentCount = nGramStatistics.reduce((parentCount, nGramStats) => {
      parentCount += nGramStats.count;
      return parentCount;
    }, 0);

    let nGramValues = nGramStatistics.map(nGramStats => toUCB1Value(nGramStats, parentCount, ucb1Constant));

    let maxAverages = _.max(nGramValues);

    let maximalNGramAverages = nGramValues.map(toIndexes).filter(index => nGramValues[index] === maxAverages);

    return sample(maximalNGramAverages, rng);
  }
}

module.exports = {
  'gibbs': createGibbsSimulationPolicyFunction,
  'egreedy': createEGreedySimulationPolicyFunction,
  'roulette': createRouletteSimulationPolicyFunction,
  'ucb1': createUCB1SimulationPolicyFunction
};
