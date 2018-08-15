/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetLibAbstract.sol";
import "./ChronoBankAssetChainableImpl.sol";
import "../routers/ChronoBankAssetBlacklistableRouter.sol";


contract ChronoBankAssetBlacklistableEmitter {

    /// @dev restriction/Unrestriction events
    event Restricted(bytes32 indexed symbol, address restricted);
    event Unrestricted(bytes32 indexed symbol, address unrestricted);

    function emitRestricted(bytes32 _symbol, address _restricted) public {
        emit Restricted(_symbol, _restricted);
    }

    function emitUnrestricted(bytes32 _symbol, address _unrestricted) public {
        emit Unrestricted(_symbol, _unrestricted);
    }
}


contract ChronoBankAssetBlacklistableLib is 
    ChronoBankAssetLibAbstract,
    ChronoBankAssetBlacklistableCore,
    ChronoBankAssetBlacklistableEmitter,
    ChronoBankAssetChainableImpl
{    
    /// @dev Only acceptable (not in blacklist) addresses are allowed to call.
    modifier onlyAcceptable(address _address) {
        if (!blacklist(_address)) {
            _;
        }
    }

    function assetType()
    public
    pure
    returns (bytes32)
    {
        return "ChronoBankAssetBlacklistable";
    }

    function blacklist(address _account) 
    public 
    view 
    returns (bool) 
    {
        return store.get(blacklistStorage, _account);
    }

    /// @notice Lifts the ban on transfers for given addresses
    function restrict(address[] _restricted) 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        for (uint i = 0; i < _restricted.length; i++) {
            address restricted = _restricted[i];
            store.set(blacklistStorage, restricted, true);
            _emitRestricted(restricted);
        }
        return true;
    }

    /// @notice Revokes the ban on transfers for given addresses
    function unrestrict(address[] _unrestricted) 
    external 
    onlyAuthorized 
    returns (bool) 
    {
        for (uint i = 0; i < _unrestricted.length; i++) {
            address unrestricted = _unrestricted[i];
            store.set(blacklistStorage, unrestricted, false);
            _emitUnrestricted(unrestricted);
        }
        return true;
    }

    function _emitRestricted(address _restricted) private {
        ChronoBankAssetBlacklistableEmitter(eventsHistory()).emitRestricted(proxy().smbl(), _restricted);
    }

    function _emitUnrestricted(address _unrestricted) private {
        ChronoBankAssetBlacklistableEmitter(eventsHistory()).emitUnrestricted(proxy().smbl(), _unrestricted);
    }

    function _beforeTransferWithReference(
        address _to, 
        uint, 
        string, 
        address _sender
    )
    internal
    onlyAcceptable(_to)
    onlyAcceptable(_sender)
    returns (bool)
    {
        return true;
    }

    function _beforeTransferFromWithReference(
        address _from, 
        address _to, 
        uint, 
        string, 
        address _sender
    )
    internal
    onlyAcceptable(_from)
    onlyAcceptable(_to)
    onlyAcceptable(_sender)
    returns (bool)
    {
        return true;
    }

    function _beforeApprove(address _spender, uint, address _sender)
    internal
    onlyAcceptable(_spender)
    onlyAcceptable(_sender)
    returns (bool)
    {
        return true;
    }
}