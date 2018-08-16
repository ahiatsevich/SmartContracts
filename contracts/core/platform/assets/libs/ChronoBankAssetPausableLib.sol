/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetLibAbstract.sol";
import "./ChronoBankAssetChainableImpl.sol";
import "../routers/ChronoBankAssetPausableRouter.sol";


contract ChronoBankAssetPausableLib is 
    ChronoBankAssetLibAbstract,
    ChronoBankAssetPausableCore,
    ChronoBankAssetPausableEmitter,
    ChronoBankAssetChainableImpl
{    
    /// @dev Only not paused tokens could go further.
    modifier onlyNotPaused {
        if (!paused()) {
            _;
        }
    }

    function assetType()
    public
    pure
    returns (bytes32)
    {
        return "ChronoBankAssetPausable";
    }

    function paused() 
    public 
    view 
    returns (bool) 
    {
        return store.get(pausedStorage);
    }

    /// @notice called by the owner to pause, triggers stopped state
    /// Only admin is allowed to execute this method.
    function pause() 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        store.set(pausedStorage, true);
        _emitPaused();
        return true;
    }

    /// @notice called by the owner to unpause, returns to normal state
    /// Only admin is allowed to execute this method.
    function unpause() 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        store.set(pausedStorage, false);
        _emitUnpaused();
        return true;
    }

    function _emitPaused() private {
        ChronoBankAssetPausableEmitter(eventsHistory()).emitPaused(proxy().smbl());
    }

    function _emitUnpaused() private {
        ChronoBankAssetPausableEmitter(eventsHistory()).emitUnpaused(proxy().smbl());
    }

    function _beforeTransferWithReference(
        address, 
        uint, 
        string, 
        address
    )
    internal
    onlyNotPaused
    returns (bool)
    {
        return true;
    }

    function _beforeTransferFromWithReference(
        address, 
        address, 
        uint, 
        string, 
        address
    )
    internal
    onlyNotPaused
    returns (bool)
    {
        return true;
    }

    function _beforeApprove(address, uint, address)
    internal
    returns (bool)
    {
        return true;
    }
}