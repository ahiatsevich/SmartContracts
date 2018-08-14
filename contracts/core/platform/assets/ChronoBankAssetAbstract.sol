/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "../ChronoBankAssetInterface.sol";
import {ChronoBankAssetProxyInterface as ChronoBankAssetProxy} from "../ChronoBankAssetProxyInterface.sol";
import {ChronoBankPlatformInterface as ChronoBankPlatform} from "../ChronoBankPlatformInterface.sol";
import "../../storage/StorageAdapter.sol";
import "../../storage/Storage.sol";
import "./ChronoBankAssetUtils.sol";


contract ChronoBankAssetAbstract is ChronoBankAssetInterface, StorageAdapter {

    bytes32 constant CHRONOBANK_PLATFORM_CRATE = "ChronoBankPlatform";
    uint constant ASSETS_CHAIN_MAX_LENGTH = 20;

    /// @dev Assigned asset proxy contract
    StorageInterface.Address private proxyStorage;

    ChronoBankAssetAbstract public previousAsset;
    ChronoBankAssetAbstract public nextAsset;
    bool public chainingFinalized;

    string public version = "v0.0.1";

    function assetType() public pure returns (bytes32);

    /// @dev Only assigned proxy is allowed to call.
    modifier onlyProxy {
        if (msg.sender == address(proxy()) || 
            msg.sender == address(previousAsset)
        ) {
            _;
        }
    }

    /// @dev Only assets's admins are allowed to execute
    modifier onlyAuthorized {
        if (_chronoBankPlatform().hasAssetRights(msg.sender, proxy().smbl())) {
            _;
        }
    }

    modifier onlyNotFinalizedChaining {
        require(chainingFinalized == false, "Chaining should not be finalized");
        _;
    }

    constructor(Storage _platform, bytes32 _crate) StorageAdapter(_platform, _crate) public {
        require(
            _crate != CHRONOBANK_PLATFORM_CRATE, 
            "Asset crate should not have the same space as a platform"
        );

        proxyStorage.init("proxy");
    }

    /// @notice Sets asset proxy address.
    /// Can be set only once.
    /// @dev function is final, and must not be overridden.
    /// @param _proxy asset proxy contract address.
    /// @return success.
    function init(ChronoBankAssetProxy _proxy, bool _finalizeChaining)
    public 
    returns (bool) 
    {
        require(
            address(store.store) == _proxy.chronoBankPlatform(), 
            "ChronoBank platform should be a storage of an asset"
        );

        if (_finalizeChaining) {
            finalizeAssetChaining();
        }

        address _gotProxy = address(proxy());
        if (_gotProxy != 0x0 && address(_proxy) == _gotProxy) {
            return true;
        }

        if (_gotProxy != 0x0) {
            return false;
        }

        store.set(proxyStorage, _proxy);
        return true;
    }

    function getChainedAssets() 
    public
    view
    returns (bytes32[] _types, address[] _assets) 
    {
        return ChronoBankAssetUtils.getChainedAssets(ChronoBankAssetChainable(this));
    }

    function getAssetByType(bytes32 _assetType)
    public
    view
    returns (address)
    {
        return ChronoBankAssetUtils.getAssetByType(ChronoBankAssetChainable(this), _assetType);
    }

    /// @notice Gets eventsHistory contract used for events' triggering
    function eventsHistory() 
    public 
    view 
    returns (address) 
    {
        ChronoBankPlatform platform = _chronoBankPlatform();
        return platform.eventsHistory() != address(platform) 
            ? platform.eventsHistory() 
            : this;
    }

    function proxy() 
    public 
    view 
    returns (ChronoBankAssetProxy) 
    {
        return ChronoBankAssetProxy(store.get(proxyStorage));
    }

    function chainAssets(ChronoBankAssetAbstract[] _assets)
    external
    onlyNotFinalizedChaining
    returns (bool)
    {
        require(_assets.length - 1 <= ASSETS_CHAIN_MAX_LENGTH, "Max chain length is exceeded");
        require(address(previousAsset) == 0x0, "Not allowed to make a circle chain: previousAsset should be 0x0 for the first asset");
        
        if (_assets.length == 0) {
            return false;
        }

        return _chainAssets(_assets, 0);
    }

    function _chainAssets(ChronoBankAssetAbstract[] _assets, uint _startFromIdx)
    private
    returns (bool _result)
    {
        nextAsset = _assets[_startFromIdx];
        require(_assets[_startFromIdx].__setPreviousAsset(this), "Cannot set ourself as previous asset in assets chain");

        _result = _assets[_startFromIdx].__chainAssetsFromIdx(_assets, _startFromIdx + 1);
        if (_result) {
            chainingFinalized = true;
        }
    }

    function __chainAssetsFromIdx(ChronoBankAssetAbstract[] _assets, uint _startFromIdx)
    external
    onlyNotFinalizedChaining
    returns (bool)
    {
        require(msg.sender == address(previousAsset), "Should be called only by previous asset");
        require(_assets[_startFromIdx - 1] == this, "Invalid chain of connect");
        
        if (_startFromIdx >= _assets.length) {
            chainingFinalized = true;
            return true;
        }

        return _chainAssets(_assets, _startFromIdx);
    }

    function __setPreviousAsset(ChronoBankAssetAbstract _asset)
    external
    onlyNotFinalizedChaining
    returns (bool)
    {
        require(msg.sender == address(_asset), "Only asset could set up previous asset");
        // require(address(_asset.nextAsset()) == address(this), "Only when `next` property set to the current asset");
        previousAsset = _asset;

        return true;
    }

    function finalizeAssetChaining()
    public
    {
        if (!chainingFinalized) {
            chainingFinalized = true;
        }
    }

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __transferWithReference(
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    ) 
    public 
    onlyProxy 
    returns (bool _isSuccess) 
    {
        if (!_beforeTransferWithReference(_to, _value, _reference, _sender)) {
            return false;
        }

        ChronoBankAssetInterface _nextAsset = nextAsset;
        if (address(_nextAsset) == 0x0 || 
            _nextAsset.__transferWithReference(_to, _value, _reference, _sender)
        ) {
            return _afterTransferWithReference(_to, _value, _reference, _sender);
        }
    }

    function _beforeTransferWithReference(
        address /*_to*/, 
        uint /*_value*/, 
        string /*_reference*/, 
        address /*_sender*/
    )
    internal
    returns (bool)
    {
        return false;
    }

    function _afterTransferWithReference(
        address /*_to*/, 
        uint /*_value*/, 
        string /*_reference*/, 
        address /*_sender*/
    )
    internal
    returns (bool) 
    {
        return true;
    }

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __transferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    ) 
    public 
    onlyProxy 
    returns (bool) 
    {
        if (!_beforeTransferFromWithReference(_from, _to, _value, _reference, _sender)) {
            return false;
        }

        ChronoBankAssetInterface _nextAsset = nextAsset;
        if (address(_nextAsset) == 0x0 || 
            _nextAsset.__transferFromWithReference(_from, _to, _value, _reference, _sender)
        ) {
            return _afterTransferFromWithReference(_from, _to, _value, _reference, _sender);
        }
    }

    function _beforeTransferFromWithReference(
        address /*_from*/, 
        address /*_to*/, 
        uint /*_value*/, 
        string /*_reference*/, 
        address /*_sender*/
    )
    internal
    returns (bool)
    {
        return false;
    }

    function _afterTransferFromWithReference(
        address /*_from*/, 
        address /*_to*/, 
        uint /*_value*/, 
        string /*_reference*/, 
        address /*_sender*/
    )
    internal
    returns (bool)
    {
        return true;
    }

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __approve(address _spender, uint _value, address _sender) 
    public 
    onlyProxy 
    returns (bool) 
    {
        if (!_beforeApprove(_spender, _value, _sender)) {
            return false;
        }

        ChronoBankAssetInterface _nextAsset = nextAsset;
        if (address(_nextAsset) == 0x0 || 
            _nextAsset.__approve(_spender, _value, _sender)
        ) {
            return _afterApprove(_spender, _value, _sender);
        }
    }

    function _beforeApprove(address /*_spender*/, uint /*_value*/, address /*_sender*/)
    internal
    returns (bool)
    {
        return false;
    }

    function _afterApprove(address /*_spender*/, uint /*_value*/, address /*_sender*/)
    internal
    returns (bool) 
    {
        return true;
    }

    function _chronoBankPlatform()
    internal
    view
    returns (ChronoBankPlatform)
    {
        return ChronoBankPlatform(proxy().chronoBankPlatform());
    }

}