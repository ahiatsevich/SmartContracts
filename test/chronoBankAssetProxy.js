const ChronoBankPlatformTestable = artifacts.require('./ChronoBankPlatformTestable.sol');
const ChronoBankAssetBasic = artifacts.require("ChronoBankAssetBasic");
const ChronoBankAssetBasicWithFee = artifacts.require("ChronoBankAssetBasicWithFee");
const ChronoBankAssetPausable = artifacts.require("ChronoBankAssetPausable");
const ChronoBankAssetBlacklistable = artifacts.require("ChronoBankAssetBlacklistable");
const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol');
const StorageManager = artifacts.require("StorageManager");
const Stub = artifacts.require('./Stub.sol');

const Reverter = require('./helpers/reverter');
const TimeMachine = require('./helpers/timemachine')

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
    chronoBankAssetPausable = await ChronoBankAssetPausable.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAssetPausable.address, SYMBOL)
    await chronoBankAssetPausable.init(chronoBankAssetProxy.address, false)
    
    // blacklistable
    chronoBankAssetBlacklistable = await ChronoBankAssetBlacklistable.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAssetBlacklistable.address, SYMBOL)
    await chronoBankAssetBlacklistable.init(chronoBankAssetProxy.address, false)

    // basic
    chronoBankAsset = await ChronoBankAssetBasic.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAsset.address, SYMBOL)
    await chronoBankAsset.init(chronoBankAssetProxy.address, false)

    await chronoBankAssetPausable.chainAssets([ chronoBankAssetBlacklistable.address, chronoBankAsset.address, ])

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
    const chronoBankAssetPausable = await ChronoBankAssetPausable.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAssetPausable.address, SYMBOL)
    await chronoBankAssetPausable.init(chronoBankAssetProxy.address, false)
    
    // blacklistable
    const chronoBankAssetBlacklistable = await ChronoBankAssetBlacklistable.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAssetBlacklistable.address, SYMBOL)
    await chronoBankAssetBlacklistable.init(chronoBankAssetProxy.address, false)

    // basic with fee
    const chronoBankAssetWithFee = await ChronoBankAssetBasicWithFee.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAssetWithFee.address, SYMBOL)
    await chronoBankAssetWithFee.init(chronoBankAssetProxy.address, false)

    await chronoBankAssetPausable.chainAssets([ chronoBankAssetBlacklistable.address, chronoBankAssetWithFee.address, ])
    
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
