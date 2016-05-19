module.exports = {
  games: {
    'sueca': {
      name: 'Sueca',
      module: __dirname + '/games/sueca'
    },
    'mini-sueca': {
      name: 'MiniSueca',
      module: __dirname + '/games/mini-sueca'
    },
    'bisca': {
      name: 'Bisca',
      module: __dirname + '/games/bisca'
    },
    'hearts': {
      name: 'Hearts',
      module: __dirname + '/games/hearts'
    }
  },

  algorithms: {
    'ismcts': {
      name: 'ISMCTS',
      module: __dirname + '/search/ismcts'
    },
    'determinized-uct': {
      name: 'DeterminizedUCT',
      module: __dirname + '/search/determinized-uct'
    },
    'random-search': {
      name: 'RandomSearch',
      module: __dirname + '/search/random-search'
    },
    'minimax': {
      name: 'RandomSearch',
      module: __dirname + '/search/minimax'
    }
  },

  enhancements: {

    'reward': {
      'positive-win-or-loss': {
        module: __dirname + '/search/node-reward',
        functionName: 'decorateWithPositiveWinOrLossReward'
      },
      'scores-difference': {
        module: __dirname + '/search/node-reward',
        functionName: 'decorateWithScoresDifferenceReward'
      },
      'win-or-loss': {
        module: __dirname + '/search/node-reward',
        functionName: 'decorateWithWinOrLossReward'
      }
    },

    'simulation': {
      'nast': {
        module: __dirname + '/search/enhancements/nast',
        functionName: 'decorateSearchAlgorithm'
      }
    },

    'node-expansion': {
      'unification': {
        module: __dirname + '/search/enhancements/tree-node-unification',
        functionName: 'decorateSearchAlgorithm'
      }
    }

  },

  couchbase: {
    enabled: true,
    cluster: 'http://localhost:8091/',
    bucket: 'default'
  }
};
