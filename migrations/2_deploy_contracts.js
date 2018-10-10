var SafeMath = artifacts.require('./SafeMath.sol');
var DemoToken = artifacts.require("./DemoToken.sol");

module.exports = function(deployer) {
  deployer.deploy(SafeMath);
  deployer.link(SafeMath, DemoToken);
  deployer.deploy(DemoToken);
};
