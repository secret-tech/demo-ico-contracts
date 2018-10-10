const DemoToken = artifacts.require("DemoToken");
const DemoPreSale = artifacts.require("DemoPreSale");
const InvestorWhiteList = artifacts.require("InvestorWhiteList");

const assertJump = function(error) {
  assert.isAbove(error.message.search('VM Exception while processing transaction: revert'), -1, 'Invalid opcode error must be returned');
};

// 1 ETH = 200$
// 3 ETH = 600$
// 1 SPACE = 0.0065$
// 92307.692307692

const hardCap = 26600000; //in SPACE
const softCap = 2500000; //in SPACE
const beneficiary = web3.eth.accounts[9];
const ethUsdPrice = 10000; //in cents
const ethPriceProvider = web3.eth.accounts[8];

function advanceToBlock(number) {
  if (Math.floor(Date.now() / 1000) > number) {
    throw Error(`block number ${number} is in thfe past (current is ${web3.eth.blockNumber})`)
  }

  while (Math.floor(Date.now() / 1000) < number) {
    web3.eth.sendTransaction({value: 1, from: web3.eth.accounts[8], to: web3.eth.accounts[7]});
  }
}

contract('DemoPreSale', function (accounts) {
  beforeEach(async function () {
    this.startTime = Math.floor(Date.now() / 1000);
    this.endTime = this.startTime + 10; // 10 seconds

    this.token = await DemoToken.new();
    this.whiteList = await InvestorWhiteList.new();

    this.crowdsale = await DemoPreSale.new(hardCap, softCap, this.token.address, beneficiary, this.whiteList.address, ethUsdPrice, this.startTime, this.endTime);
    this.token.setTransferAgent(this.token.address, true);
    this.token.setTransferAgent(this.crowdsale.address, true);
    this.token.setTransferAgent(accounts[0], true);

    await this.crowdsale.setEthPriceProvider(ethPriceProvider);

    //transfer more than hardcap to test hardcap reach properly
    this.token.transfer(this.crowdsale.address, web3.toWei(30000000, "ether"));
  });

  it('should allow to halt by owner', async function () {
    await this.crowdsale.halt();

    const halted = await this.crowdsale.halted();

    assert.equal(halted, true);
  });

  it('should not allow to halt by not owner', async function () {
    try {
      await this.crowdsale.halt({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to halt if already halted', async function () {
    await this.crowdsale.halt();

    try {
      await this.crowdsale.halt();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to unhalt by owner', async function () {
    await this.crowdsale.halt();

    await this.crowdsale.unhalt();
    const halted = await this.crowdsale.halted();

    assert.equal(halted, false);
  });

  it('should not allow to unhalt when not halted', async function () {
    try {
      await this.crowdsale.unhalt();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to unhalt by not owner', async function () {
    await this.crowdsale.halt();

    try {
      await this.crowdsale.unhalt({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to update ETH price by ETH price provider', async function () {
    await this.crowdsale.receiveEthPrice(25000, {from: ethPriceProvider});

    const ethUsdRate = await this.crowdsale.ethUsdRate();

    assert.equal(ethUsdRate, 25000);
  });

  it('should not allow to update ETH price by not ETH price provider', async function () {
    try {
      await this.crowdsale.receiveEthPrice(25000, {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to set ETH price provider by owner', async function () {
    await this.crowdsale.setEthPriceProvider(accounts[2], {from: accounts[0]});

    const newPriceProvider = await this.crowdsale.ethPriceProvider();

    assert.equal(accounts[2], newPriceProvider);
  });

  it('should not allow to set ETH price provider by not owner', async function () {
    try {
      await this.crowdsale.setEthPriceProvider(accounts[2], {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to update eth price with zero value', async function () {
    try {
      await this.crowdsale.receiveEthPrice(0, {from: ethPriceProvider});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to set new whitelist with zero value', async function () {
    try {
      await this.crowdsale.setNewWhiteList(0x0);
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to set new whitelist by not owner', async function () {
    try {
      await this.crowdsale.setNewWhiteList(0x0, { from: accounts[1] });
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should set new whitelist', async function () {
    const newWhiteList = await InvestorWhiteList.new();
    await this.crowdsale.setNewWhiteList(newWhiteList.address);

    const actual = await this.crowdsale.investorWhiteList();
    assert.equal(newWhiteList.address, actual);
  });

  it('should not allow to transfer ownership if ICO is active', async function () {
    try {
      await this.crowdsale.transferOwnership(accounts[1]);
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to transfer ownership when ICO is ended', async function () {
    advanceToBlock(this.endTime);

    await this.crowdsale.transferOwnership(accounts[1]);
    const actual = await this.crowdsale.owner();
    assert.equal(accounts[1], actual);
  });

  it('should increase deposit accordingly with several investments', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    await this.whiteList.addInvestorToWhiteList(accounts[3]);
    await this.whiteList.addReferralOf(accounts[3], accounts[4]);

    await this.crowdsale.sendTransaction({value: 5 * 10 ** 18, from: accounts[2]});

    const deposited1 = await this.crowdsale.deposited(accounts[2]);
    assert.equal(deposited1.toNumber(), 5 * 10 ** 18);

    await this.crowdsale.sendTransaction({value: 5 * 10 ** 18, from: accounts[2]});

    const deposited2 = await this.crowdsale.deposited(accounts[2]);
    assert.equal(deposited2.toNumber(), 10 * 10 ** 18);

    await this.crowdsale.sendTransaction({value: 5 * 10 ** 18, from: accounts[3]});

    const deposited3 = await this.crowdsale.deposited(accounts[3]);
    assert.equal(deposited3.toNumber(), 5 * 10 ** 18);

    //should not increase deposit of referral
    const deposited4 = await this.crowdsale.deposited(accounts[4]);
    assert.equal(deposited4.toNumber(), 0);
  });


  it('should add 35% bonus if softCap was not reached', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({
      value: 5 * 10 ** 18,
      from: accounts[2],
    });

    //check that investor received proper tokens count
    const balanceOf2 = await this.token.balanceOf(accounts[2]);
    assert.equal(balanceOf2.valueOf(), 76923076923076923076923);

    //check that sender deposit was increased
    const deposited = await this.crowdsale.deposited(accounts[2]);
    assert.equal(deposited.toNumber(), 5 * 10 ** 18);

    //check that tokensSold is correct 76923.076923077
    const tokensSold1 = await this.crowdsale.tokensSold();
    assert.equal(tokensSold1.toNumber(), 76923076923076923076923);
  });

  it('should add 20% bonus after softCap  reached', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    await this.whiteList.addInvestorToWhiteList(accounts[3]);

    await this.crowdsale.sendTransaction({
      value: 162.5 * 10 ** 18,
      from: accounts[2],
    });

    await this.crowdsale.sendTransaction({
      value: 7 * 10 ** 18,
      from: accounts[3],
    });

    //check that investor received proper tokens count
    const balanceOf2 = await this.token.balanceOf(accounts[3]);
    assert.equal(balanceOf2.valueOf(), 87500 * 10 ** 18);

    //check that sender deposit was increased
    const deposited = await this.crowdsale.deposited(accounts[3]);
    assert.equal(deposited.toNumber(), 7 * 10 ** 18);
  });


  it('should calculate discount on the softcap border correctly', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    await this.whiteList.addInvestorToWhiteList(accounts[3]);

    await this.crowdsale.sendTransaction({
      value: 169.5 * 10 ** 18,
      from: accounts[2],
    });

    //check that investor received proper tokens count
    const balanceOf2 = await this.token.balanceOf(accounts[2]);
    assert.equal(balanceOf2.valueOf(), 2587500 * 10 ** 18);

    //check that sender deposit was increased
    const deposited = await this.crowdsale.deposited(accounts[2]);
    assert.equal(deposited.toNumber(), 169.5 * 10 ** 18);
  });


  it('should not allow purchase when ICO is halted', async function () {
    await this.crowdsale.halt();
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    try {
      await this.crowdsale.sendTransaction({value: 100 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to buy less than 50000 SPACE', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    //50000 SPACE with the price of 0.01$ for token and ETH price = 200$ is ~2.5 ETH
    try {
      await this.crowdsale.sendTransaction({value: 2.4 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should set flag when softcap is reached', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    //ICO softcap will be reached with single 125 ETH investment
    await this.crowdsale.sendTransaction({value: 162.5 * 10 ** 18, from: accounts[1]});

    const softCapReached = await this.crowdsale.softCapReached();
    assert.equal(softCapReached, true);
  });

  it('should set flag when softcap is reached - referral purchase', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addReferralOf(accounts[1], accounts[2]);

    //ICO softcap will be reached with single 9843 ETH investment due to high volume and referral bonus
    await this.crowdsale.sendTransaction({value: 162.5 * 10 ** 18, from: accounts[1]});

    const softCapReached = await this.crowdsale.softCapReached();
    assert.equal(softCapReached, true);
  });

  it('should not allow to exceed hard cap', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    await this.whiteList.addInvestorToWhiteList(accounts[4]);

    await this.crowdsale.sendTransaction({value: 10 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 10 * 10 ** 18, from: accounts[2]});

    try {
      await this.crowdsale.sendTransaction({value: 133000 * 10 ** 18, from: accounts[4]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow withdraw only for owner', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    await this.crowdsale.sendTransaction({value: 165 * 10 ** 18, from: accounts[1]});

    try {
      await this.crowdsale.withdraw({from: accounts[1]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow withdraw when softcap is not reached', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    await this.crowdsale.sendTransaction({value: 10 * 10 ** 18, from: accounts[1]});

    try {
      await this.crowdsale.withdraw();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should withdraw - send all not distributed tokens and collected ETH to beneficiary', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 125 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 60 * 10 ** 18, from: accounts[2]});

    const oldBenBalanceEth = web3.eth.getBalance(beneficiary);
    const oldIcoContractBalanceSPACE = await this.token.balanceOf(this.crowdsale.address).valueOf();
    advanceToBlock(this.endTime);
    await this.crowdsale.withdraw();

    const newBenBalanceEth = web3.eth.getBalance(beneficiary);
    const newBenBalanceSPACE = await this.token.balanceOf(beneficiary).valueOf();
    const icoContractBalanceSPACE = await this.token.balanceOf(this.crowdsale.address).valueOf();
    const icoContractBalanceEth = web3.eth.getBalance(this.crowdsale.address);

    assert.equal(icoContractBalanceSPACE, 0);
    assert.equal(icoContractBalanceEth, 0);
    assert.equal(newBenBalanceEth.minus(oldBenBalanceEth).toNumber(), web3.toWei(185));
    assert.equal(newBenBalanceSPACE.toNumber(), oldIcoContractBalanceSPACE.toNumber());
  });

  it('should not allow purchase if ICO is ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    advanceToBlock(this.endTime);

    try {
      await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow purchase after withdraw', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 165 * 10 ** 18, from: accounts[2]});
    advanceToBlock(this.endTime);
    await this.crowdsale.withdraw();

    try {
      await this.crowdsale.sendTransaction({value: 10 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow refund if ICO is not ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 30 * 10 ** 18, from: accounts[2]});

    try {
      await this.crowdsale.refund({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow refund if soft cap is reached', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[3]);

    await this.crowdsale.sendTransaction({value: 125 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 50 * 10 ** 18, from: accounts[3]});

    advanceToBlock(this.endTime);

    try {
      await this.crowdsale.refund({from: accounts[3]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow refund if ICO is halted', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    await this.crowdsale.sendTransaction({value: 30 * 10 ** 18, from: accounts[1]});

    advanceToBlock(this.endTime);
    await this.crowdsale.halt();

    const balanceBefore = web3.eth.getBalance(accounts[1]);

    await this.crowdsale.refund({from: accounts[1]});

    const balanceAfter = web3.eth.getBalance(accounts[1]);

    assert.equal(balanceAfter > balanceBefore, true);
  });

  it('should refund if cap is not reached and ICO is ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 30 * 10 ** 18, from: accounts[2]});

    advanceToBlock(this.endTime);

    const balanceBefore = web3.eth.getBalance(accounts[2]);
    await this.crowdsale.refund({from: accounts[2]});

    const balanceAfter = web3.eth.getBalance(accounts[2]);

    assert.equal(balanceAfter > balanceBefore, true);

    const weiRefunded = await this.crowdsale.weiRefunded();
    assert.equal(weiRefunded.valueOf(), 30 * 10 ** 18);

    const deposited = await this.crowdsale.deposited(accounts[2]);
    assert.equal(deposited.toNumber(), 0);
    //should not refund 1 more time
    try {
      await this.crowdsale.refund({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });
});
