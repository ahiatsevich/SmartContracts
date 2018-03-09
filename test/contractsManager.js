const Setup = require('../setup/setup');
const Reverter = require('./helpers/reverter');
const bytes32 = require('./helpers/bytes32');
const bytes32fromBase58 = require('./helpers/bytes32fromBase58');
const eventsHelper = require('./helpers/eventsHelper');

contract('Contracts Manager', function(accounts) {
  var owner = accounts[0];
  var owner1 = accounts[1];
  var owner2 = accounts[2];
  var owner3 = accounts[3];
  var owner4 = accounts[4];
  var owner5 = accounts[5];
  var nonOwner = accounts[6];
  var txId;
  var vote;
  var watcher;

  const SYMBOL = 'TIME';
  const SYMBOL2 = 'LHT';
  const NAME = 'Time Token';
  const DESCRIPTION = 'ChronoBank Time Shares';
  const NAME2 = 'Labour-hour Token';
  const DESCRIPTION2 = 'ChronoBank Lht Assets';
  const BASE_UNIT = 2;
  const IS_REISSUABLE = true;
  const IS_NOT_REISSUABLE = false;
  const BALANCE_ETH = 1000;
  const fakeArgs = [0,0,0,0,0,0,0,0];

  before('setup', function(done) {

    Setup.setup(done);

  });

  context("initial tests", function(){

    it("can provide ExchangeManager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.ExchangeManager).then(function(r) {
        assert.equal(r,Setup.exchangeManager.address);
      });
    });

    it("can provide RewardsContract address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.Rewards).then(function(r) {
        assert.equal(r,Setup.rewards.address);
      });
    });

    it("can provide LOCManager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.LOCManager).then(function(r) {
        assert.equal(r,Setup.chronoMint.address);
      });
    });

    it("can provide ERC20Manager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.ERC20Manager).then(function(r) {
        assert.equal(r,Setup.erc20Manager.address);
      });
    });

    it("can provide AssetsManager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.AssetsManager).then(function(r) {
        assert.equal(r,Setup.assetsManager.address);
      });
    });

    it("can provide UserManager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.UserManager).then(function(r) {
        assert.equal(r,Setup.userManager.address);
      });
    });

    it("can provide PendingManager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.PendingManager).then(function(r) {
        assert.equal(r,Setup.shareable.address);
      });
    });

    it("can provide TimeHolder address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.TimeHolder).then(function(r) {
        assert.equal(r,Setup.timeHolder.address);
      });
    });

    it("can provide Voting Manager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.VotingManager).then(function(r) {
        assert.equal(r,Setup.votingManager.address);
      });
    });    

    it("can provide Token Extension Gateway Manager address.", async () => {
      let storedAddress = await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.TokenExtensionGateway)
      assert.equal(storedAddress, Setup.tokenExtensionGateway.address);
    });

    it("doesn't allow a non CBE key to change the contract address", function() {
      return Setup.contractsManager.addContract(Setup.rewards.address,Setup.contractTypes.VotingManager,{from: owner1}).then(function(r) {
        return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.VotingManager).then(function(r){
          assert.equal(r, Setup.votingManager.address);
        });
      });
    });

    it("allows a CBE key to change the contract address", function() {
      return Setup.contractsManager.addContract('0x0000000000000000000000000000000000000123',Setup.contractTypes.VotingManager).then(function(r) {
        return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.VotingManager).then(function(r){
          assert.equal(r, '0x0000000000000000000000000000000000000123');
        });
      });
    });

  });
});
