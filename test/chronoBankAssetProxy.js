const ChronoBankPlatformTestable = artifacts.require('./ChronoBankPlatformTestable.sol');
const ChronoBankAssetRouter = artifacts.require("ChronoBankAssetRouter");
const ChronoBankAssetRouterInterface = artifacts.require("ChronoBankAssetRouterInterface");
const ChronoBankAssetWithFeeRouter = artifacts.require("ChronoBankAssetWithFeeRouter");
const ChronoBankAssetWithFeeRouterInterface = artifacts.require("ChronoBankAssetWithFeeRouterInterface");
const ChronoBankAssetPausableRouter = artifacts.require("ChronoBankAssetPausableRouter");
const ChronoBankAssetPausableRouterInterface = artifacts.require("ChronoBankAssetPausableRouterInterface");
const ChronoBankAssetBlacklistableRouter = artifacts.require("ChronoBankAssetBlacklistableRouter");
const ChronoBankAssetBlacklistableRouterInterface = artifacts.require("ChronoBankAssetBlacklistableRouterInterface");

const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol');
const StorageManager = artifacts.require("StorageManager");
const Stub = artifacts.require('./Stub.sol');

const Reverter = require('./helpers/reverter');
const TimeMachine = require('./helpers/timemachine')
const Setup = require('../setup/setup')

contract('ChronoBankAssetProxy', function(accounts) {
  const reverter = new Reverter(web3);
  const timemachine = new TimeMachine(web3)

  const SYMBOL = 'LHT';
  const NAME = 'Test Name';
  const DESCRIPTION = 'Test Description';
  const VALUE = 1001;
  const BASE_UNIT = 2;
  const IS_REISSUABLE = true;

  let storageManager
  let chronoBankPlatform;
  let chronoBankAsset;
  let chronoBankAssetProxy;
  let stub;

  before('setup others', async () => {
    await Setup.setupPromise()

    stub = await Stub.deployed()
    storageManager = await StorageManager.new()
    chronoBankPlatform = await ChronoBankPlatformTestable.new()

    await chronoBankPlatform.setupEventsHistory(stub.address);
    await chronoBankPlatform.setManager(storageManager.address)
    await storageManager.giveAccess(chronoBankPlatform.address, "ChronoBankPlatform")

    await chronoBankPlatform.issueAsset(SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, IS_REISSUABLE)

    chronoBankAssetProxy = await ChronoBankAssetProxy.new()
    await chronoBankAssetProxy.init(chronoBankPlatform.address, SYMBOL, NAME)

    // pausable
    chronoBankAssetPausable = ChronoBankAssetPausableRouterInterface.at(
      (await ChronoBankAssetPausableRouter.new(chronoBankPlatform.address, SYMBOL, Setup.chronoBankAssetPausableLib.address)).address
    )
    await storageManager.giveAccess(chronoBankAssetPausable.address, SYMBOL)
    
    // blacklistable
    chronoBankAssetBlacklistable = ChronoBankAssetBlacklistableRouterInterface.at(
      (await ChronoBankAssetBlacklistableRouter.new(chronoBankPlatform.address, SYMBOL, Setup.chronoBankAssetBlacklistableLib.address)).address
    )
    await storageManager.giveAccess(chronoBankAssetBlacklistable.address, SYMBOL)
    
    // basic
    chronoBankAsset = ChronoBankAssetRouterInterface.at(
      (await ChronoBankAssetRouter.new(chronoBankPlatform.address, SYMBOL, Setup.chronoBankAssetBasicLib.address)).address
    )
    await storageManager.giveAccess(chronoBankAsset.address, SYMBOL)
    
    await chronoBankAssetPausable.chainAssets([ chronoBankAssetBlacklistable.address, chronoBankAsset.address, ])

    /* NOTE: Only single init needed to fully initialize chain of assets */
    await chronoBankAsset.init(chronoBankAssetProxy.address, true)

    // setup token
    await chronoBankAssetProxy.proposeUpgrade(chronoBankAsset.address)

    await reverter.promisifySnapshot()
  });

  afterEach('revert', reverter.revert);

  it('should be possible to upgrade asset implementation', async () => {
    const sender = accounts[0];
    const receiver = accounts[1];
    var feeAddress = accounts[2];
    var feePercent = 1; // 0.01 * 100;
    const value1 = 100;
    const value2 = 200;
    const fee = 1;

    await chronoBankPlatform.setProxy(chronoBankAssetProxy.address, SYMBOL)
    await chronoBankAssetProxy.transfer(receiver, value1)
    assert.equal((await chronoBankAssetProxy.balanceOf(sender)).toString(16), (VALUE - value1).toString(16))
    assert.equal((await chronoBankAssetProxy.balanceOf(receiver)).toString(16), value1.toString(16))

    // pausable
    const chronoBankAssetPausable = ChronoBankAssetPausableRouterInterface.at(
      (await ChronoBankAssetPausableRouter.new(chronoBankPlatform.address, SYMBOL, Setup.chronoBankAssetPausableLib.address)).address
    )
    await storageManager.giveAccess(chronoBankAssetPausable.address, SYMBOL)
    
    // blacklistable
    const chronoBankAssetBlacklistable = ChronoBankAssetBlacklistableRouterInterface.at(
      (await ChronoBankAssetBlacklistableRouter.new(chronoBankPlatform.address, SYMBOL, Setup.chronoBankAssetBlacklistableLib.address)).address
    )
    await storageManager.giveAccess(chronoBankAssetBlacklistable.address, SYMBOL)

    // basic with fee
    const chronoBankAssetWithFee = ChronoBankAssetWithFeeRouterInterface.at(
      (await ChronoBankAssetWithFeeRouter.new(chronoBankPlatform.address, SYMBOL, Setup.chronoBankAssetBasicWithFeeLib.address)).address
    )
    await storageManager.giveAccess(chronoBankAssetWithFee.address, SYMBOL)
    
    await chronoBankAssetPausable.chainAssets([ chronoBankAssetBlacklistable.address, chronoBankAssetWithFee.address, ])
    await chronoBankAssetPausable.init(chronoBankAssetProxy.address, true)
    
    // setup token
    await chronoBankAssetProxy.proposeUpgrade(chronoBankAssetPausable.address)

    await timemachine.jump(86400*3) // 3 days

    await chronoBankAssetWithFee.setupFee(feeAddress, feePercent)
    assert.isTrue(await chronoBankAssetProxy.commitUpgrade.call())

    await chronoBankAssetProxy.commitUpgrade()
    await chronoBankAssetProxy.transfer(receiver, value2)
    assert.equal((await chronoBankAssetProxy.balanceOf(sender)).toString(16), (VALUE - value1 - value2 - fee).toString(16))
    assert.equal((await chronoBankAssetProxy.balanceOf(receiver)).toString(16), (value1 + value2).toString(16))
    assert.equal((await chronoBankAssetProxy.balanceOf(feeAddress)).toString(16), fee.toString(16))
  });
});
