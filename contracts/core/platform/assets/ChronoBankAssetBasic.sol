/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.24;


import "./ChronoBankAssetAbstract.sol";


/// @title ChronoBank Asset implementation contract.
///
/// Basic asset implementation contract, without any additional logic.
/// Every other asset implementation contracts should derive from this one.
/// Receives calls from the proxy, and calls back immediatly without arguments modification.
///
/// Note: all the non constant functions return false instead of throwing in case if state change
/// didn't happen yet.
contract ChronoBankAssetBasic is ChronoBankAssetAbstract {

    constructor(Storage _platform, bytes32 _crate) ChronoBankAssetAbstract(_platform, _crate) public {
    }

    function assetType()
    public
    pure
    returns (bytes32)
    {
        return "ChronoBankAssetBasic";
    }

    function _beforeTransferWithReference(
        address, 
        uint, 
        string, 
        address
    )
    internal
    returns (bool)
    {
        return true;
    }

    /// @notice Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _afterTransferWithReference(
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    returns (bool)
    {
        return proxy().__transferWithReference(_to, _value, _reference, _sender);
    }

    function _beforeTransferFromWithReference(
        address, 
        address, 
        uint, 
        string, 
        address
    )
    internal
    returns (bool)
    {
        return true;
    }

    /// @notice Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _afterTransferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    returns (bool)
    {
        return proxy().__transferFromWithReference(_from, _to, _value, _reference, _sender);
    }

    function _beforeApprove(address, uint, address)
    internal
    returns (bool)
    {
        return true;
    }

    /// @notice Calls back without modifications.
    /// @dev function is virtual, and meant to be overridden.
    /// @return success.
    function _afterApprove(address _spender, uint _value, address _sender)
    internal
    returns (bool)
    {
        return proxy().__approve(_spender, _value, _sender);
    }
}