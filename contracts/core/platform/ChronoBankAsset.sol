pragma solidity ^0.4.11;

import "./ChronoBankAssetInterface.sol";
import {ChronoBankAssetProxyInterface as ChronoBankAssetProxy} from "./ChronoBankAssetProxyInterface.sol";
import {ChronoBankPlatformInterface as ChronoBankPlatform} from "./ChronoBankPlatformInterface.sol";

/// @title ChronoBank Asset implementation contract.
///
/// @notice Basic asset implementation contract, without any additional logic.
/// Every other asset implementation contracts should derive from this one.
/// Receives calls from the proxy, and calls back immediatly without arguments modification.
///
/// Note: all the non constant functions return false instead of throwing in case if state change
/// didn't happen yet.
contract ChronoBankAsset is ChronoBankAssetInterface {
    /// Assigned asset proxy contract, immutable.
    ChronoBankAssetProxy public proxy;

    /// banned addresses
    mapping (address => bool) public blacklist;

    /// stops asset transfers
    bool public isStoped;

    /// Only assigned proxy is allowed to call.
    modifier onlyProxy() {
        if (proxy == msg.sender) {
            _;
        }
    }

    /// Only assets's admins are allowed to execute
    modifier onlyAuthorized() {
        ChronoBankPlatform platform = ChronoBankPlatform(proxy.chronoBankPlatform());
        if (platform.hasAssetRights(msg.sender, proxy.smbl())) {
            _;
        }
    }

    /// Sets asset proxy address.
    /// Can be set only once.
    /// @param _proxy asset proxy contract address.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function init(ChronoBankAssetProxy _proxy) public returns(bool) {
        if (address(proxy) != 0x0) {
            return false;
        }
        proxy = _proxy;
        return true;
    }

    /// Restricts a given address to transfer/receive assets.
    function restrict(address _restricted) onlyAuthorized returns (bool) {
        blacklist[_restricted] = true;
        return true;
    }

    /// Lifts the ban on transfers for given address
    function unrestrict(address _unrestricted) onlyAuthorized returns (bool) {
        blacklist[_unrestricted] = false;
        return true;
    }

    /// Stops (or resumes) transfers in case of emergency.
    /// Only admin of an asset is allowed to execute this method.
    /// @param _isStoped tells, will asset be stoped or resumed
    /// @return success.
    function stop(bool _isStoped) onlyAuthorized returns (bool) {
        isStoped = _isStoped;
        return true;
    }

    /// Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function __transferWithReference(address _to, uint _value, string _reference, address _sender) public onlyProxy() returns(bool) {
        return _transferWithReference(_to, _value, _reference, _sender);
    }

    /// Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @return success.
    /// @dev function is virtual, and meant to be overridden.
    function _transferWithReference(address _to, uint _value, string _reference, address _sender) internal returns(bool) {
        if (isStoped) {
            return false;
        }

        if (blacklist[_to] || blacklist[_sender]) {
            return false;
        }

        return proxy.__transferWithReference(_to, _value, _reference, _sender);
    }

    /// Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function __transferFromWithReference(address _from, address _to, uint _value, string _reference, address _sender) public onlyProxy() returns(bool) {
        return _transferFromWithReference(_from, _to, _value, _reference, _sender);
    }

    /// Calls back without modifications if an asset is not stopped.
    /// Checks whether _from/_sender are not in blacklist.
    /// @return success.
    /// @dev function is virtual, and meant to be overridden.
    function _transferFromWithReference(address _from, address _to, uint _value, string _reference, address _sender) internal returns(bool) {
        if (isStoped) {
            return false;
        }

        if (blacklist[_to] || blacklist[_sender]) {
            return false;
        }

        return proxy.__transferFromWithReference(_from, _to, _value, _reference, _sender);
    }

    /// Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function __approve(address _spender, uint _value, address _sender) public onlyProxy() returns(bool) {
        return _approve(_spender, _value, _sender);
    }

    /// Calls back without modifications.
    /// @return success.
    /// @dev function is virtual, and meant to be overridden.
    function _approve(address _spender, uint _value, address _sender) internal returns(bool) {
        return proxy.__approve(_spender, _value, _sender);
    }

    /// Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function __totalSupply() public view returns(uint) {
        return _totalSupply();
    }

    /// Calls back without modifications.
    /// @return success.
    /// @dev function is virtual, and meant to be overridden.
    function _totalSupply() public view returns(uint) {
        return proxy.__totalSupply();
    }

    /// Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function __balanceOf(address _owner) public view returns(uint) {
        return _balanceOf(_owner);
    }

    /// Calls back without modifications.
    /// @return success.
    /// @dev function is virtual, and meant to be overridden.
    function _balanceOf(address _owner) public view returns(uint) {
        return proxy.__balanceOf(_owner);
    }

    /// Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function __allowance(address _from, address _spender) public view returns(uint) {
        return _allowance(_from, _spender);
    }

    /// Calls back without modifications.
    /// @return success.
    /// @dev function is virtual, and meant to be overridden.
    function _allowance(address _from, address _spender) public view returns(uint) {
        return proxy.__allowance(_from, _spender);
    }

    /// Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @return success.
    /// @dev function is final, and must not be overridden.
    function __baseUnit() public view returns(uint8) {
        return _baseUnit();
    }

    /// Calls back without modifications.
    /// @return success.
    /// @dev function is virtual, and meant to be overridden.
    function _baseUnit() public view returns(uint8) {
        return proxy.__baseUnit();
    }
}
