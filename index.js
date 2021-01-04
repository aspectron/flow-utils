const isVertx = (typeof vertx !== 'undefined' && vertx !== null) ? true : false;
const utils = require("./lib/utils");
isVertx ? require('./lib/vertx')(utils) : require('./lib/node')(utils);
module.exports = utils;