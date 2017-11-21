pragma solidity ^0.4.11;

import "./ChronoBankAssetInterface.sol";
import {ChronoBankAssetProxyInterface as ChronoBankAssetProxy} from "./ChronoBankAssetProxyInterface.sol";
import {ChronoBankPlatformInterface as ChronoBankPlatform} from "./ChronoBankPlatformInterface.sol";

/**
 * @title ChronoBank Asset implementation contract.
 *
 * Basic asset implementation contract, without any additional logic.
 * Every other asset implementation contracts should derive from this one.
 * Receives calls from the proxy, and calls back immediatly without arguments modification.
 *
 * Note: all the non constant functions return false instead of throwing in case if state change
 * didn't happen yet.
 */
contract ChronoBankAsset is ChronoBankAssetInterface {

    // Assigned asset proxy contract, immutable.
    ChronoBankAssetProxy public proxy;

    // banned addresses
    mapping (address => bool) public blacklist;

    // stops asset transfers
    bool public paused = false;

    // restriction/Unrestriction events
    event Restricted(bytes32 indexed symbol, address restricted);
    event Unrestricted(bytes32 indexed symbol, address unrestricted);

    // Paused/Unpaused events
    event Paused(bytes32 indexed symbol);
    event Unpaused(bytes32 indexed symbol);

    /**
     * Only assigned proxy is allowed to call.
     */
    modifier onlyProxy() {
        if (proxy == msg.sender) {
            _;
        }
    }

    modifier onlyNotPaused() {
        if (!paused) {
            _;
        }
    }

    modifier onlyAcceptable(address _address) {
        if (!blacklist[_address]) {
            _;
        }
    }

    /**
    *  Only assets's admins are allowed to execute
    */
    modifier onlyAuthorized() {
        ChronoBankPlatform platform = ChronoBankPlatform(proxy.chronoBankPlatform());
        if (platform.hasAssetRights(msg.sender, proxy.smbl())) {
            _;
        }
    }

    /**
     * Sets asset proxy address.
     *
     * Can be set only once.
     *
     * @param _proxy asset proxy contract address.
     *
     * @return success.
     * @dev function is final, and must not be overridden.
     */
    function init(ChronoBankAssetProxy _proxy) returns(bool) {
        if (address(proxy) != 0x0) {
            return false;
        }
        proxy = _proxy;
        return true;
    }

    /**
    *  @dev Lifts the ban on transfers for given addresses
    */
    function restrict(address [] _restricted) external onlyAuthorized returns (bool) {
        for (uint i = 0; i < _restricted.length; i++) {
            address restricted = _restricted[i];
            blacklist[restricted] = true;
            _emitRestricted(restricted);
        }
        return true;
    }

    /**
    *  @dev Revokes the ban on transfers for given addresses
    */
    function unrestrict(address [] _unrestricted) external onlyAuthorized returns (bool) {
        for (uint i = 0; i < _unrestricted.length; i++) {
            address unrestricted = _unrestricted[i];
            delete blacklist[unrestricted];
            _emitUnrestricted(unrestricted);
        }
        return true;
    }

    /**
    * @dev called by the owner to pause, triggers stopped state
    * Only admin is allowed to execute this method.
    */
    function pause() external onlyAuthorized returns (bool) {
        paused = true;
        _emitPaused();
        return true;
    }

    /**
    * @dev called by the owner to unpause, returns to normal state
    * Only admin is allowed to execute this method.
    */
    function unpause() external onlyAuthorized returns (bool) {
        paused = false;
        _emitUnpaused();
        return true;
    }

    /**
     * Passes execution into virtual function.
     *
     * Can only be called by assigned asset proxy.
     *
     * @return success.
     * @dev function is final, and must not be overridden.
     */
    function __transferWithReference(address _to, uint _value, string _reference, address _sender) onlyProxy() returns(bool) {
        return _transferWithReference(_to, _value, _reference, _sender);
    }

    /**
     * Calls back without modifications if an asset is not stopped.
     * Checks whether _from/_sender are not in blacklist.
     *
     * @return success.
     * @dev function is virtual, and meant to be overridden.
     */
    function _transferWithReference(address _to, uint _value, string _reference, address _sender)
    internal
    onlyNotPaused
    onlyAcceptable(_to)
    onlyAcceptable(_sender)
    returns(bool)
    {
        return proxy.__transferWithReference(_to, _value, _reference, _sender);
    }

    /**
     * Passes execution into virtual function.
     *
     * Can only be called by assigned asset proxy.
     *
     * @return success.
     * @dev function is final, and must not be overridden.
     */
    function __transferFromWithReference(address _from, address _to, uint _value, string _reference, address _sender) onlyProxy() returns(bool) {
        return _transferFromWithReference(_from, _to, _value, _reference, _sender);
    }

    /**
     * Calls back without modifications if an asset is not stopped.
     * Checks whether _from/_sender are not in blacklist.
     *
     * @return success.
     * @dev function is virtual, and meant to be overridden.
     */
    function _transferFromWithReference(address _from, address _to, uint _value, string _reference, address _sender)
    internal
    onlyNotPaused
    onlyAcceptable(_from)
    onlyAcceptable(_to)
    onlyAcceptable(_sender)
    returns(bool)
    {
        return proxy.__transferFromWithReference(_from, _to, _value, _reference, _sender);
    }

    /**
     * Passes execution into virtual function.
     *
     * Can only be called by assigned asset proxy.
     *
     * @return success.
     * @dev function is final, and must not be overridden.
     */
    function __approve(address _spender, uint _value, address _sender) onlyProxy() returns(bool) {
        return _approve(_spender, _value, _sender);
    }

    /**
     * Calls back without modifications.
     *
     * @return success.
     * @dev function is virtual, and meant to be overridden.
     */
    function _approve(address _spender, uint _value, address _sender)
    internal
    onlyAcceptable(_spender)
    onlyAcceptable(_sender)
    returns(bool)
    {
        return proxy.__approve(_spender, _value, _sender);
    }


    function _emitRestricted(address _restricted) private {
        ChronoBankAsset(eventsHistory()).emitRestricted(proxy.smbl(), _restricted);
    }

    function _emitUnrestricted(address _unrestricted) private {
        ChronoBankAsset(eventsHistory()).emitUnrestricted(proxy.smbl(), _unrestricted);
    }

    function _emitPaused() private {
        ChronoBankAsset(eventsHistory()).emitPaused(proxy.smbl());
    }

    function _emitUnpaused() private {
        ChronoBankAsset(eventsHistory()).emitUnpaused(proxy.smbl());
    }

    function emitRestricted(bytes32 _symbol, address _restricted) public {
        Restricted(_symbol, _restricted);
    }

    function emitUnrestricted(bytes32 _symbol, address _unrestricted) public {
        Unrestricted(_symbol, _unrestricted);
    }

    function emitPaused(bytes32 _symbol) public {
        Paused(_symbol);
    }

    function emitUnpaused(bytes32 _symbol) public {
        Unpaused(_symbol);
    }

    function eventsHistory() public view returns (address) {
        ChronoBankPlatform platform = ChronoBankPlatform(proxy.chronoBankPlatform());
        return platform.eventsHistory();
    }
}
