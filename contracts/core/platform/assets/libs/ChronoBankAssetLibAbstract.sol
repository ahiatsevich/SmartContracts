/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import {ChronoBankAssetProxyInterface as ChronoBankAssetProxy} from "../../ChronoBankAssetProxyInterface.sol";
import {ChronoBankPlatformInterface as ChronoBankPlatform} from "../../ChronoBankPlatformInterface.sol";
import "./ChronoBankAssetChainableInterface.sol";
import "../routers/ChronoBankAssetRouter.sol";
import "../routers/ChronoBankAssetAbstractCore.sol";
import "../../ChronoBankAssetInterface.sol";


contract ChronoBankAssetLibAbstract is 
    ChronoBankAssetRouterCore,
    ChronoBankAssetAbstractCore
{
    bytes32 constant CHRONOBANK_PLATFORM_CRATE = "ChronoBankPlatform";

    /// @dev Only assets's admins are allowed to execute
    modifier onlyAuthorized {
        if (_chronoBankPlatform().hasAssetRights(msg.sender, proxy().smbl())) {
            _;
        }
    }

    /// @dev Only assigned proxy is allowed to call.
    modifier onlyProxy {
        if (msg.sender == address(proxy()) || 
            msg.sender == address(ChronoBankAssetChainableInterface(this).getPreviousAsset())
        ) {
            _;
        }
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
            "ASSET_LIB_INVALID_STORAGE_INITIALIZED"
        );

        if (_finalizeChaining) {
            ChronoBankAssetChainableInterface(this).finalizeAssetChaining();
        }

        address _gotProxy = proxy();
        if (_gotProxy != 0x0 && address(_proxy) == _gotProxy) {
            return true;
        }

        if (_gotProxy != 0x0) {
            return false;
        }

        store.set(proxyStorage, address(_proxy));
        return true;
    }

    function proxy() 
    public 
    view 
    returns (ChronoBankAssetProxy) 
    {
        return ChronoBankAssetProxy(store.get(proxyStorage));
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

        ChronoBankAssetInterface _nextAsset = ChronoBankAssetInterface(ChronoBankAssetChainableInterface(this).getNextAsset());
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

        ChronoBankAssetInterface _nextAsset = ChronoBankAssetInterface(ChronoBankAssetChainableInterface(this).getNextAsset());
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

        ChronoBankAssetInterface _nextAsset = ChronoBankAssetInterface(ChronoBankAssetChainableInterface(this).getNextAsset());
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