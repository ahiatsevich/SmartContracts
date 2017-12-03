const ContractsManager = artifacts.require("./ContractsManager.sol")
const Exchange = artifacts.require("./ExchangeInterface.sol")
const ExchangeFactory = artifacts.require("./ExchangeFactory.sol")
const Setup = require('../setup/setup')
const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const ErrorsEnum = require("../common/errors")
const eventsHelper = require('./helpers/eventsHelper')

contract('Exchange Manager', function(accounts) {
  const owner = accounts[0]
  const owner1 = accounts[1]
  const owner2 = accounts[2]
  const owner3 = accounts[3]
  const owner4 = accounts[4]
  const owner5 = accounts[5]
  const nonOwner = accounts[6]
  const manager = accounts[3]
  const SYMBOL = 'TIME'

  before('setup', function (done) {
      Setup.setup(done)
  })

  it("should has a valid factory", async () => {
      let factory = await Setup.exchangeManager.getExchangeFactory.call();
      assert.equal(factory, ExchangeFactory.address);
  })

  it("should allow to create a new exchange", async () => {
    let result = await Setup.exchangeManager.createExchange.call(SYMBOL, 1, 2, false, manager, true);
    assert.equal(result, ErrorsEnum.OK);

    let createExchangeTx = await Setup.exchangeManager.createExchange(SYMBOL, 1, 2, false, manager, true);

    let events = eventsHelper.extractEvents(createExchangeTx, "ExchangeCreated");
    assert.equal(events.length, 1);

    let exchange = events[0].args.exchange;

    let exchangeExists = await Setup.exchangeManager.isExchangeExists.call(exchange);
    assert.isTrue(exchangeExists);

    let exchanges = await Setup.exchangeManager.getExchangesForOwner.call(owner);
    assert.equal(exchanges.length, 1);
    assert.equal(exchanges[0], exchange);
  });

  it("should cleanup an exchange info after Exchange#kill() execution", async () => {
    let createExchangeTx = await Setup.exchangeManager.createExchange(SYMBOL, 1, 2, false, 0x0, false);

    let events = eventsHelper.extractEvents(createExchangeTx, "ExchangeCreated");
    assert.equal(events.length, 1);

    let exchange = events[0].args.exchange;

    let exchangeExists = await Setup.exchangeManager.isExchangeExists.call(exchange);
    assert.isTrue(exchangeExists);

    let theExchange = await Exchange.at(exchange);
    let killTx = await theExchange.kill();

    assert.isFalse(await Setup.exchangeManager.isExchangeExists.call(exchange));
    assert.isFalse(await Setup.multiEventsHistory.isAuthorized(theExchange.address));
  });

  context("Access rights", function () {
    it("should allow to set fee by CBE", async() => {
        await Setup.userManager.addCBE(owner5, 0x0)
        let isCBE = await Setup.userManager.isAuthorized.call(owner5);
        assert.isTrue(isCBE);

        let fee = await Setup.exchangeManager.getFee.call();
        let newFee = fee.toNumber() + 1;

        await Setup.exchangeManager.setFee(newFee, {from: owner5})
        fee = await Setup.exchangeManager.getFee.call();
        assert.equal(newFee, fee.toNumber());
    });

    it("shouldn't allow non-CBE to set fee", async() => {
        let isCBE = await Setup.userManager.isAuthorized.call(owner4);
        assert.isFalse(isCBE);

        let fee = await Setup.exchangeManager.getFee.call();
        let newFee = fee.toNumber() + 1;

        await Setup.exchangeManager.setFee(newFee, {from: owner4})
        fee = await Setup.exchangeManager.getFee.call();
        assert.notEqual(newFee, fee.toNumber());
    });

    it("shouldn't allow non-contract owner to change an Exchange Factory", async() => {
        await Setup.exchangeManager.setExchangeFactory(owner2, {from: owner1});
        let factory = await Setup.exchangeManager.getExchangeFactory.call();
        assert.equal(ExchangeFactory.address, factory);
    });
  });
});
