'use strict';

let _ = require('lodash');

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

  return _.findIndex(cumulativeOdds, odd => randomNumber <= odd);
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

// For ε-greedy, ε ∈ {0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6} was tested and ε = 0.2 found to be best

module.exports = {
  'gibbs': createGibbsSimulationPolicyFunction,
  'egreedy': function () {},
  'roulette': function () {},
  'uct': function () {}
};
