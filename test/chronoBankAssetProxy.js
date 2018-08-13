const ChronoBankPlatformTestable = artifacts.require('./ChronoBankPlatformTestable.sol');
const ChronoBankAsset = artifacts.require('./ChronoBankAsset.sol');
const ChronoBankAssetWithFee = artifacts.require('./ChronoBankAssetWithFee.sol');
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
  let chronoBankAssetWithFee;
  let chronoBankAssetProxy;
  let stub;

  before('setup others', async () => {
    stub = await Stub.deployed()
    storageManager = await StorageManager.new()
    chronoBankPlatform = await ChronoBankPlatformTestable.new()

    await chronoBankPlatform.setupEventsHistory(stub.address);
    await chronoBankPlatform.setManager(storageManager.address)
    await storageManager.giveAccess(chronoBankPlatform.address, "ChronoBankPlatform")

    chronoBankAsset = await ChronoBankAsset.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAsset.address, SYMBOL)

    chronoBankAssetProxy = await ChronoBankAssetProxy.new()
    await chronoBankAssetProxy.init(chronoBankPlatform.address, SYMBOL, NAME)

    await chronoBankPlatform.issueAsset(SYMBOL, VALUE, NAME, DESCRIPTION, BASE_UNIT, IS_REISSUABLE)
    await chronoBankAssetProxy.proposeUpgrade(chronoBankAsset.address)
    await chronoBankAsset.init(chronoBankAssetProxy.address)

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

    chronoBankAssetWithFee = await ChronoBankAssetWithFee.new(chronoBankPlatform.address, SYMBOL)
    await storageManager.giveAccess(chronoBankAssetWithFee.address, SYMBOL)
    await chronoBankAssetWithFee.init(chronoBankAssetProxy.address)
    await chronoBankAssetProxy.proposeUpgrade(chronoBankAssetWithFee.address)

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
