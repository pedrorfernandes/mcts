'use strict';

const config = require(__dirname + '/../config.js').enhancements;

class SearchAlgorithm {
  constructor(game, player, options) {
    this.setNodeClass(this.getBasicNodeClass());

    let enhancements = options.enhancements || [];

    enhancements.forEach(enhancementOptions => {

      if (!enhancementOptions || !enhancementOptions.name || !enhancementOptions.type) {
        throw new Error('All enhancement options must be an object with name, type and functionName!')
      }

      let enhancementName = enhancementOptions.name;
      let enhancementType = enhancementOptions.type;

      let moduleConfig = config[enhancementType][enhancementName];

      if (!moduleConfig || !moduleConfig.functionName || !moduleConfig.module) {
        throw new Error(`Bad config file: missing .functionName or .module in enhancemente ${enhancementName} of ${enhancementType} `)
      }

      let enhancementModule = require(moduleConfig.module);
      let decorate = enhancementModule[moduleConfig.functionName];

      decorate(this, enhancementOptions);
    });
  }

  getNodeClass() {
    return this.NodeClass;
  }

  getBasicNodeClass() {
    throw new Error('The search algorithm must implement .getBasicNodeClass()')
  }

  setNodeClass(NodeClass) {
    this.NodeClass = NodeClass;
  }
}

module.exports = SearchAlgorithm;
