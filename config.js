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
    'uct': {
      name: 'UCT',
      module: __dirname + '/search/uct'
    },
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
        module: __dirname + '/search/enhancements/node-reward',
        functionName: 'decorateWithPositiveWinOrLossReward'
      },
      'scores-difference': {
        module: __dirname + '/search/enhancements/node-reward',
        functionName: 'decorateWithScoresDifferenceReward'
      },
      'win-or-loss': {
        module: __dirname + '/search/enhancements/node-reward',
        functionName: 'decorateWithWinOrLossReward'
      }
    },

    'simulation': {
      'nast': {
        module: __dirname + '/search/enhancements/nast',
        functionName: 'decorateSearchAlgorithm'
      },

      'epic': {
        module: __dirname + '/search/enhancements/epic',
        functionName: 'decorateSearchAlgorithm'
      }
    },

    'node-expansion': {
      'unification': {
        module: __dirname + '/search/enhancements/tree-node-unification',
        functionName: 'decorateSearchAlgorithm'
      }
    },

    'tree-init': {
      'sub-tree-preservation': {
        module: __dirname + '/search/enhancements/sub-tree-preservation',
        functionName: 'decorateSearchAlgorithm'
      }
    },

    'hybrid-algorithm': {
      'minimax-end-game': {
        module: __dirname + '/search/enhancements/minimax-end-game',
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
