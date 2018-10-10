var SafeMath = artifacts.require('./SafeMath.sol');
var DemoToken = artifacts.require("./DemoToken.sol");
var DemoPreSale = artifacts.require("./DemoPreSale.sol");
var EthPriceProvider = artifacts.require("./EthPriceProvider.sol");
var InvestorWhiteList = artifacts.require("./InvestorWhiteList.sol");

module.exports = function(deployer) {
  deployer.deploy(SafeMath);
  deployer.link(SafeMath, DemoToken);
  deployer.link(SafeMath, DemoPreSale);
  deployer.deploy(DemoToken).then(async function() {
    const hardCap = 26600000; //in SPACE
    const softCap = 2500000; //in SPACE
    const token = DemoToken.address;
    const beneficiary = web3.eth.accounts[0];
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 600; // 10 minutes
    await deployer.deploy(InvestorWhiteList);
    await deployer.deploy(DemoPreSale, hardCap, softCap, token, beneficiary, InvestorWhiteList.address, 25500, startTime, endTime);
    await deployer.deploy(EthPriceProvider);

    const icoInstance = web3.eth.contract(DemoPreSale.abi).at(DemoPreSale.address);
    const ethProvider = web3.eth.contract(EthPriceProvider.abi).at(EthPriceProvider.address);

    icoInstance.setEthPriceProvider(EthPriceProvider.address, { from: web3.eth.accounts[0] });
    ethProvider.setWatcher(DemoPreSale.address, { from: web3.eth.accounts[0] });

    //start update and send ETH to cover Oraclize fees
    ethProvider.startUpdate(30000, { value: web3.toWei(1000), from: web3.eth.accounts[0], gas: 200000 });
  });
};
