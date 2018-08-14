/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;

import "./ChronoBankAssetAbstract.sol";

contract ChronoBankAssetBlacklistable is ChronoBankAssetAbstract {

    /// @dev banned addresses
    StorageInterface.AddressBoolMapping private blacklistStorage;

    /// @dev restriction/Unrestriction events
    event Restricted(bytes32 indexed symbol, address restricted);
    event Unrestricted(bytes32 indexed symbol, address unrestricted);

    /// @dev Only acceptable (not in blacklist) addresses are allowed to call.
    modifier onlyAcceptable(address _address) {
        if (!blacklist(_address)) {
            _;
        }
    }

    constructor(Storage _platform, bytes32 _crate) ChronoBankAssetAbstract(_platform, _crate) public {
        blacklistStorage.init("blacklist");
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

    function emitRestricted(bytes32 _symbol, address _restricted) public {
        emit Restricted(_symbol, _restricted);
    }

    function emitUnrestricted(bytes32 _symbol, address _unrestricted) public {
        emit Unrestricted(_symbol, _unrestricted);
    }

    function _emitRestricted(address _restricted) private {
        ChronoBankAssetBlacklistable(eventsHistory()).emitRestricted(proxy().smbl(), _restricted);
    }

    function _emitUnrestricted(address _unrestricted) private {
        ChronoBankAssetBlacklistable(eventsHistory()).emitUnrestricted(proxy().smbl(), _unrestricted);
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
