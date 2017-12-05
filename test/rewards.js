const Rewards = artifacts.require("./Rewards.sol");
const RewardsWallet = artifacts.require("./RewardsWallet.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const TimeHolder = artifacts.require("./TimeHolder.sol");
const TimeHolderWallet = artifacts.require('./TimeHolderWallet.sol')
const LOCManager = artifacts.require('./LOCManager.sol')
const LOCWallet = artifacts.require('./LOCWallet.sol')
const FakeCoin = artifacts.require("./FakeCoin.sol");
const FakeCoin2 = artifacts.require("./FakeCoin2.sol");
const FakeCoin3 = artifacts.require("./FakeCoin3.sol");
const UserManager = artifacts.require("./UserManager.sol");
const AssetsManagerMock = artifacts.require("./AssetsManagerMock.sol");
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const Storage = artifacts.require("./Storage.sol");
const ManagerMock = artifacts.require('./ManagerMock.sol');
const Reverter = require('./helpers/reverter');
const bytes32 = require('./helpers/bytes32');
const eventsHelper = require('./helpers/eventsHelper');
const ErrorsEnum = require("../common/errors");

contract('Rewards', (accounts) => {
  let reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  let reward;
  let rewardsWallet;
  let timeHolder;
  let timeHolderWallet
  let storage;
  let userManager;
  let multiEventsHistory;
  let assetsManager;
  let chronoMint;
  let chronoMintWallet;
  let shares;
  let asset1;
  let asset2;

  const fakeArgs = [0,0,0,0,0,0,0,0];
  const ZERO_INTERVAL = 0;
  const SHARES_BALANCE = 1161;
  const CHRONOBANK_PLATFORM_ID = 1;

  const STUB_PLATFORM_ADDRESS = 0x0

  let defaultInit = () => {
    return storage.setManager(ManagerMock.address)
    .then(() => assetsManager.init(contractsManager.address))
    .then(() => rewardsWallet.init(contractsManager.address))
    .then(() => reward.init(contractsManager.address, rewardsWallet.address, STUB_PLATFORM_ADDRESS, ZERO_INTERVAL))
    .then(() => chronoMintWallet.init(contractsManager.address))
    .then(() => chronoMint.init(contractsManager.address, chronoMintWallet.address))
    .then(() => userManager.init(contractsManager.address))
    .then(() => timeHolderWallet.init(contractsManager.address))
    .then(() => timeHolder.init(contractsManager.address, shares.address, timeHolderWallet.address, accounts[0]))
    .then(() => assetsManager.addAsset(asset1.address, 'LHT', chronoMintWallet.address))
    .then(() => multiEventsHistory.authorize(reward.address))
    .then(() => {})
  };

  let assertSharesBalance = (address, expectedBalance) => {
    return shares.balanceOf(address)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertAsset1Balance = (address, expectedBalance) => {
    return asset1.balanceOf(address)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertAsset2Balance = (address, expectedBalance) => {
    return asset2.balanceOf(address)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertDepositBalance = (address, expectedBalance) => {
    return timeHolder.depositBalance(address)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertDepositBalanceInPeriod = (address, period, expectedBalance) => {
    return reward.depositBalanceInPeriod(address, period)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertTotalDepositInPeriod = (period, expectedBalance) => {
    return reward.totalDepositInPeriod(period)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertAssetBalanceInPeriod = (assetAddress, period, expectedBalance) => {
    return reward.assetBalanceInPeriod(assetAddress, period)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertRewardsLeft = (assetAddress, expectedBalance) => {
    return reward.getRewardsLeft(assetAddress)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertRewardsFor = (address, assetAddress, expectedBalance) => {
    return reward.rewardsFor(assetAddress, address)
      .then((balance) => assert.equal(balance.toString(), '' + expectedBalance));
  };

  let assertUniqueHoldersForPeriod = (period, expectedCount) => {
    return reward.periodUnique(period)
      .then((count) => assert.equal(count.toString(), '' + expectedCount));
  };

  let depositShareholders = (count, amount) => {
    let data = [];
    for(let i = 1000; i < count+1000; i++) {
       data.push(timeHolder.depositFor(i, amount));
    }
    return Promise.all(data);
  };

  before('Setup', (done) => {

    Storage.new()
    .then((instance) => storage = instance)
    .then(() => RewardsWallet.new(storage.address, "RewardsWallet"))
    .then((instance) => rewardsWallet = instance)
    .then(() => Rewards.new(storage.address, "Deposits"))
    .then((instance) => reward = instance)
    .then(() => AssetsManagerMock.deployed())
    .then((instance) => assetsManager = instance)
    .then(() => LOCWallet.new(storage.address, 'LOCWallet'))
    .then((instance) => chronoMintWallet = instance)
    .then(() => LOCManager.new(storage.address, 'LOCManager'))
    .then((instance) => chronoMint = instance)
    .then(() => TimeHolderWallet.new(storage.address, 'TimeHolderWallet'))
    .then(instance => timeHolderWallet = instance)
    .then(() => TimeHolder.new(storage.address,'Deposits'))
    .then((instance) => timeHolder = instance)
    .then(() => ContractsManager.new(storage.address, "ContractsManager"))
    .then((instance) => contractsManager = instance)
    .then(() => UserManager.new(storage.address, 'UserManager'))
    .then((instance) => userManager = instance)
    .then(() => MultiEventsHistory.deployed())
    .then((instance) => multiEventsHistory = instance)
    .then(() => FakeCoin2.deployed())
    .then((instance) => asset1 = instance)
    .then(() => FakeCoin3.deployed())
    .then((instance) => asset2 = instance)
    .then(() => FakeCoin.deployed())
    .then(function(instance) {
      shares = instance
  // init shares
      shares.mint(accounts[0], SHARES_BALANCE)
        .then(() => shares.mint(accounts[1], SHARES_BALANCE))
        .then(() => shares.mint(accounts[2], SHARES_BALANCE))
        // snapshot
        .then(() => reverter.snapshot(done))
        .catch(done);
  });
});

  // init(address _timeHolder, uint _closeIntervalDays) returns(bool)
  it('should receive the right ContractsManager contract address after init() call', () => {
    return defaultInit()
      .then(() => reward.contractsManager.call())
      .then((address) => assert.equal(address, contractsManager.address) );
  });

  // it('should not be possible to call init twice', () => {
  //   return defaultInit()
  //     .then(() => reward.init('0x1', 30))
  //     .then(reward.contractsManager)
  //     .then((address) => assert.equal(address, contractsManager.address))
  //     .then(reward.getCloseInterval)
  //     .then((interval) => assert.equal(interval, ZERO_INTERVAL));
  // });

  // init(address _timeHolder, uint _closeIntervalDays) returns(bool)
  it('should receive the rigth reward assets list', () => {
    return defaultInit()
      .then(() => reward.getAssets.call())
      .then((result) => {
          assert.equal(result[0], asset1.address)
      });
  });

  it("should have right wallet address", function () {
      return defaultInit()
      .then(() => reward.wallet.call())
      .then(_wallet => assert.equal(rewardsWallet.address, _wallet))
  })

  // depositFor(address _address, uint _amount) returns(bool)
  it('should return true if was called with 0 shares (copy from prev period)', () => {
    return defaultInit()
      .then(() => timeHolder.depositFor.call(accounts[0], 0))
      .then((res) => assert.equal(res, ErrorsEnum.OK));
  });

  it('should not deposit if sharesContract.transferFrom() failed', () => {
    return defaultInit()
      .then(() => timeHolder.depositFor(accounts[0], SHARES_BALANCE + 1))
      .then(() => assertSharesBalance(accounts[0], 1161))
      .then(() => assertDepositBalance(accounts[0], 0))
      .then(() => assertDepositBalanceInPeriod(accounts[0], 0, 0))
      .then(() => assertTotalDepositInPeriod(0, 0));
  });

  it('should be possible to deposit shares', () => {
    return defaultInit()
      .then(() => timeHolder.depositFor(accounts[0], 100))
      .then(() => assertDepositBalance(accounts[0], 100))
      .then(() => assertDepositBalanceInPeriod(accounts[0], 0, 100))
      .then(() => assertTotalDepositInPeriod(0, 100));
  });

  it('should be possible to make deposit several times in one period', () => {
    return defaultInit()
      // 1st deposit
      .then(() => timeHolder.depositFor(accounts[0], 100))
      .then(() => assertDepositBalance(accounts[0], 100))
      .then(() => assertDepositBalanceInPeriod(accounts[0], 0, 100))
      .then(() => assertTotalDepositInPeriod(0, 100))
      // 2nd deposit
      .then(() => timeHolder.depositFor(accounts[0], 100))
      .then(() => assertDepositBalance(accounts[0], 200))
      .then(() => assertDepositBalanceInPeriod(accounts[0], 0, 200))
      .then(() => assertTotalDepositInPeriod(0, 200))
      // 3rd deposit
      .then(() => timeHolder.depositFor(accounts[1], 100))
      .then(() => assertDepositBalance(accounts[1], 100))
      .then(() => assertDepositBalanceInPeriod(accounts[1], 0, 100))

      .then(() => assertTotalDepositInPeriod(0, 300));
  });

  it('should be possible to call deposit(0) several times', () => {
    return defaultInit()
      // 1st period - deposit 50
      .then(() => asset1.mint(rewardsWallet.address, 100))
      .then(() => timeHolder.depositFor(accounts[0], 50))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      .then(() => assertTotalDepositInPeriod(0, 50))
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 0, 100))

      // 2nd period - deposit 0 several times
      .then(() => asset1.mint(rewardsWallet.address, 200))
      .then(() => timeHolder.depositFor(accounts[0], 0))
      .then(() => timeHolder.depositFor(accounts[0], 0))
      .then(() => timeHolder.depositFor(accounts[0], 0))
      .then(() => reward.closePeriod())
      .then(() => assertTotalDepositInPeriod(1, 50))
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 1, 200));
  });

  // closePeriod() returns(bool)
  it('should not be possible to close period if period.startDate + closeInterval * 1 days > now', () => {
    return storage.setManager(ManagerMock.address)
      .then(() => reward.init(contractsManager.address, rewardsWallet.address, CHRONOBANK_PLATFORM_ID, ZERO_INTERVAL + 1))
      .then(() => userManager.init(contractsManager.address))
      .then(() => timeHolder.init(contractsManager.address, shares.address, timeHolderWallet.address, accounts[0]))
      .then(() => multiEventsHistory.authorize(reward.address))
      .then(() => reward.closePeriod.call())
      .then((res) => assert.notEqual(res, 1))
      .then(() => reward.closePeriod())
      // periods.length still 0
      .then(() => reward.lastPeriod())
      .then((period) => assert.equal(period, 0));
  });

  it('should be possible to close period', () => {
    return defaultInit()
      .then(() => reward.closePeriod())
      // periods.length become 1
      .then(() => reward.lastPeriod())
      .then((period) => assert.equal(period, 1));
  });

  // registerAsset(address _assetAddress) returns(bool)
  /*it('should not be possible to register asset for first period (periods.length == 1)', () => {
    return defaultInit()
      .then(() => asset1.mint(reward.address, 100))
      .then(() => reward.registerAsset(asset1.address)
        .then(assert.fail, () => {})
      );
  });*/

 it('should not be possible to register asset twice with non zero balance', () => {
    return defaultInit()
      .then(() => asset1.mint(rewardsWallet.address, 100))
      .then(() => assetsManager.addAsset(asset1.address, 'LHT2', chronoMintWallet.address))
      //.then((res) => assert.isTrue(res))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      // 1st registration - true
      //.then(() => reward.registerAsset.call(asset1.address))
      //.then((res) => assert.isTrue(res))
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 0, 100))
      .then(() => assertRewardsLeft(asset1.address, 100))

      .then(() => asset1.mint(rewardsWallet.address, 200))
      // 2nd registration - false
      //.then(() => reward.registerAsset.call(asset1.address))
      //.then((res) => assert.isFalse(res))
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 0, 100))
      .then(() => assertRewardsLeft(asset1.address, 100));
  });

  /*it('should not be possible to register shares as an asset', () => {
    return defaultInit()
      .then(() => shares.mint(reward.address, 100))
      .then(() => reward.closePeriod([]))
      // 1st registration - true
      .then(() => reward.registerAsset.call(shares.address))
      .then((res) => assert.notEqual(res, 1))
      .then(() => reward.registerAsset(shares.address))
      .then(() => assertAssetBalanceInPeriod(shares.address, 0, 0))
      .then(() => assertRewardsLeft(shares.address, 0));
  });*/

  it('should count incoming rewards separately for each period', () => {
    return defaultInit()
      // 1st period
      .then(() => asset1.mint(rewardsWallet.address, 100))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 0, 100))

      .then(() => assertRewardsLeft(asset1.address, 100))

      // 2nd period
      .then(() => asset1.mint(rewardsWallet.address, 200))
      .then(() => reward.closePeriod())
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 1, 200))

      .then(() => assertRewardsLeft(asset1.address, 300));
  });

  // calculateRewardForAddressAndPeriod(address _assetAddress, address _address, uint _period) returns(bool)
 /* it('should fail to calculate reward if there is only 1 period', () => {
    return defaultInit()
      .then(() => reward.calculateRewardForAddressAndPeriod.call('0x1', '0x1', 50)
        .then(assert.fail, () => {})
      );
  });*/

  /*it('should return false when calculating rewards for period that is not closed', () => {
    return defaultInit()
      .then(() => reward.closePeriod())
      .then(() => timeHolder.deposit(50))
      .then(() => asset1.mint(reward.address, 100))
      .then(() => reward.registerAsset(asset1.address))
      // call for unclosed period (last is always unclosed)
      .then(() => reward.lastPeriod())
      .then((lastPeriod) => reward.calculateRewardForAddressAndPeriod.call(asset1.address, accounts[0], lastPeriod))
      .then((res) => assert.isFalse(res));
  });*/

  /*it('should return false when calculating rewards if balance for assetAddress == 0', () => {
    return defaultInit()
      .then(() => timeHolder.deposit(50))
      .then(() => reward.closePeriod())
      // call for closed period (last - 1 is always closed)
      .then(() => reward.calculateRewardForAddressAndPeriod.call('0x1', accounts[0], 0))
      .then((res) => assert.isFalse(res));
  });*/

  it('should calculate reward', () => {
    return defaultInit()
      .then(() => asset1.mint(rewardsWallet.address, 100))
      .then(() => timeHolder.deposit(75, { from: accounts[0] }))
      .then(() => timeHolder.deposit(25, { from: accounts[1] }))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      .then(() => assertTotalDepositInPeriod(0, 100))

      //.then(() => reward.registerAsset(asset1.address))

      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[0], 0))
      .then(() => reward.isCalculatedFor(asset1.address, accounts[0], 0))
      .then((res) => assert.isTrue(res))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 75))

      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[1], 0))
      .then(() => reward.isCalculatedFor(asset1.address, accounts[1], 0))
      .then((res) => assert.isTrue(res))
      .then(() => assertRewardsFor(accounts[1], asset1.address, 25));
  });

  it('should calculate rewards for several periods', () => {
    return defaultInit()
      // 1st period - deposit 50
      .then(() => asset1.mint(rewardsWallet.address, 100))
      .then(() => timeHolder.depositFor(accounts[0], 50))
      .then(() => timeHolder.depositFor(accounts[1], 50))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      .then(() => assertTotalDepositInPeriod(0, 100))
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 0, 100))

      // calculate for 1st period
      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[0], 0))
      .then(() => reward.isCalculatedFor(asset1.address, accounts[0], 0))
      .then((res) => assert.isTrue(res))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 50))

      // 2nd period - should accept all shares
      .then(() => asset1.mint(rewardsWallet.address, 200))
      //.then(() => timeHolder.depositFor(accounts[0], 0))
      //.then(() => timeHolder.depositFor(accounts[1], 0))
      .then(() => reward.closePeriod())
      .then(() => assertTotalDepositInPeriod(1, 100))
      //.then(() => reward.registerAsset(asset1.address))
      .then(() => assertAssetBalanceInPeriod(asset1.address, 1, 200))

      // calculate for 2nd period
      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[0], 1))
      .then(() => reward.isCalculatedFor(asset1.address, accounts[0], 1))
      .then((res) => assert.isTrue(res))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 150));
  });

  // withdrawShares(uint _amount) returns(bool)
  it('should not withdraw more shares than you have', () => {
    return defaultInit()
      .then(() => timeHolder.deposit(100))
      .then(() => timeHolder.withdrawShares.call(200))
      .then((res) => assert.notEqual(res, ErrorsEnum.OK))
      .then(() => timeHolder.withdrawShares(200))
      .then(() => assertDepositBalance(accounts[0], 100))
      .then(() => assertTotalDepositInPeriod(0, 100))
      .then(() => assertSharesBalance(accounts[0], SHARES_BALANCE - 100))
      .then(() => timeHolder.wallet.call())
      .then(_timeHolderWallet => assertSharesBalance(_timeHolderWallet, 100));
  });

  it('should withdraw shares without deposit in new period', () => {
    return defaultInit()
      .then(() => timeHolder.deposit(100))
      .then(() => assertDepositBalance(accounts[0], 100))
      .then(() => assertDepositBalanceInPeriod(accounts[0], 0, 100))
      .then(() => assertTotalDepositInPeriod(0, 100))
      .then(() => reward.closePeriod())
      .then(() => assertUniqueHoldersForPeriod(0,1))
      .then(() => timeHolder.withdrawShares(50))
      .then(() => assertDepositBalance(accounts[0], 50))
      .then(() => assertDepositBalanceInPeriod(accounts[0], 1, 50))
      .then(() => assertTotalDepositInPeriod(1, 50))
  });

  it('should withdraw shares', () => {
    return defaultInit()
      .then(() => timeHolder.deposit(100))
      .then(() => timeHolder.withdrawShares(50))
      .then(() => assertDepositBalance(accounts[0], 50))
      .then(() => assertDepositBalanceInPeriod(accounts[0], 0, 50))
      .then(() => assertTotalDepositInPeriod(0, 50))
      .then(() => assertSharesBalance(accounts[0], SHARES_BALANCE - 50))
      .then(() => timeHolder.wallet.call())
      .then(_timeHolderWallet => assertSharesBalance(_timeHolderWallet, 50));
  });

  // withdrawRewardFor(address _address, uint _amount, address _assetAddress) returns(bool)
  it('should return false if rewardsLeft == 0', () => {
    return defaultInit()
      .then(() => reward.withdrawReward.call(asset1.address, 100, {from: accounts[0],}))
      .then((res) => assert.notEqual(res, 1));
  });

  it('should withdraw reward', () => {
    return defaultInit()
      .then(() => asset1.mint(rewardsWallet.address, 100))
      .then(() => timeHolder.depositFor(accounts[0], 100))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      //.then(() => reward.registerAsset(asset1.address))
      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[0], 0))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 100))
      .then(() => reward.withdrawReward(asset1.address, 100, {from: accounts[0]}))
      .then(() => assertAsset1Balance(accounts[0], 100))
      .then(() => assertRewardsLeft(asset1.address, 0))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 0));
  });

  it('should withdraw all rewards', () => {
    return defaultInit()
      .then(() => assetsManager.addAsset(asset2.address, 'LHT-2', chronoMintWallet.address))
      .then(() => asset1.mint(rewardsWallet.address, 555))
      .then(() => asset2.mint(rewardsWallet.address, 777))
      .then(() => timeHolder.depositFor(accounts[0], 555))
      .then(() => timeHolder.depositFor(accounts[0], 777))
      .then(() => reward.closePeriod())
      .then(() => assertRewardsFor(accounts[0], asset1.address, 555))
      .then(() => assertRewardsFor(accounts[0], asset2.address, 777))
      .then(() => reward.withdrawAllRewardsTotal({from: accounts[0]}))
      .then(() => assertAsset1Balance(accounts[0], 555))
      .then(() => assertAsset2Balance(accounts[0], 777))
      .then(() => assertRewardsLeft(asset1.address, 0))
      .then(() => assertRewardsLeft(asset2.address, 0))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 0))
      .then(() => assertRewardsFor(accounts[0], asset2.address, 0));
  });

  it('should withdraw reward by different shareholders', () => {
    return defaultInit()
      .then(() => asset1.mint(rewardsWallet.address, 100))
      .then(() => timeHolder.depositFor(accounts[0], 100))
      .then(() => timeHolder.depositFor(accounts[1], 200))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      //.then(() => reward.registerAsset(asset1.address))
      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[0], 0))
      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[1], 0))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 33))
      .then(() => assertRewardsFor(accounts[1], asset1.address, 66))
      .then(() => reward.withdrawReward(asset1.address, 33, {from: accounts[0]}))
      .then(() => reward.withdrawReward(asset1.address, 66, {from: accounts[1]}))
      .then(() => assertAsset1Balance(accounts[0], 33))
      .then(() => assertAsset1Balance(accounts[1], 66))
      .then(() => assertRewardsLeft(asset1.address, 1))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 0))
      .then(() => assertRewardsFor(accounts[1], asset1.address, 0));
  });

  it('should allow partial withdraw reward', () => {
    return defaultInit()
      .then(() => asset1.mint(rewardsWallet.address, 100))
      .then(() => timeHolder.depositFor(accounts[0], 100))
      //.then(() => reward.addAsset(asset1.address))
      .then(() => reward.closePeriod())
      //.then(() => reward.registerAsset(asset1.address))
      //.then(() => reward.calculateRewardForAddressAndPeriod(asset1.address, accounts[0], 0))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 100))

      .then(() => reward.withdrawReward(asset1.address, 30, {from: accounts[0]}))
      .then(() => assertAsset1Balance(accounts[0], 30))
      .then(() => assertRewardsLeft(asset1.address, 70))
      .then(() => assertRewardsFor(accounts[0], asset1.address, 70));
  });

   /* it('should allow 1111 shareholders to deposit, calculate and withdrawn', () => {
        return defaultInit()
          .then(() => asset1.mint(reward.address, 1000000))
          .then(() => timeHolder.depositFor(accounts[0], 50))
          .then(() => depositShareholders(711,1))
          .then(() => reward.closePeriod())
          .then(() => timeHolder.withdrawShares(25))
          .then(() => { return reward.getPartsCount.call() })
          .then((res) => {
            let data = [];
            for(let i=1;i<res;i++) {
                data.push(reward.storeDeposits(i));
            }
            return Promise.all(data);
          })
          //.then(() => reward.registerAsset(asset1.address))
          .then(() => assertTotalDepositInPeriod(0, 736))
          .then(() => timeHolder.withdrawShares(25))
          .then(() => assertTotalDepositInPeriod(0, 736))
    });*/

});
