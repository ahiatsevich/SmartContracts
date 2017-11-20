pragma solidity ^0.4.11;

import "./ChronoBankAsset.sol";
import "../common/Owned.sol";
import "./ChronoBankAssetWithCallbackListener.sol";

/**
 * @title ChronoBank Asset With Callback implementation contract.
 */
contract ChronoBankAssetWithCallback is ChronoBankAsset, Owned {
    // max allowed number of listeners
    uint constant MAX_LISTENERS_COUNT = 16;
    // list of listeners
    address[16] public listeners;
    // listeners count
    uint public listenersCount;

    // index on the list of listeners to allow reverse lookup
    mapping(address => uint) listenerIndexs;
    // each listener could be notified with personal(isolated) data
    mapping(address => bytes) listenersData;

    /**
    *  Add given address to listeners.
    *
    *  _listener must implement ChronoBankAssetWithCallbackListener interface.
    *  Note, no compatibility checks are performed at this method.
    *
    *  _listener will be notified with given _data
    *
    *  This method can be executed only by contractOwner.
    *
    *  @param _listener contract address
    *  @param _data which will be used as an additional param in notification
    *
    *  @return success.
    */
    function addListener(address _listener, bytes _data) public onlyContractOwner returns (bool) {
        if (isListener(_listener)) return;

        if (listenersCount >= MAX_LISTENERS_COUNT) {
            reorganizeListeners();
        }

        if (listenersCount >= MAX_LISTENERS_COUNT) {
            return;
        }

        listeners[listenersCount] = _listener;
        listenerIndexs[_listener] = listenersCount;
        listenersData[_listener] = _data;

        listenersCount++;
    }

    /**
    *  Removed address from listeners.
    *
    *  This method can be executed only by contractOwner.
    *
    *  @param _listener contract address
    *
    *  @return success.
    */
    function removeListener(address _listener) public onlyContractOwner returns (bool) {
        uint listenerIndex = listenerIndexs[_listener];

        if (listenerIndex == 0) {
            return false;
        }

        delete listeners[listenerIndex];
        delete listenerIndexs[_listener];
        delete listenersData[_listener];
        listenersCount--;

        reorganizeListeners();
        return true;
    }

    /**
    *  Tells whether given address is listener or not.
    *
    *  @param _listener contract address
    *
    *  @return is listener or not.
    */
    function isListener(address _listener) public constant returns (bool) {
        return listenerIndexs[_listener] > 0;
    }

    /**
    *  Returns data assigned to used for listener notification
    */
    function getListenerData(address _listener) public constant returns (bytes) {
        return listenersData[_listener];
    }

    /**
    *  Override ChronoBankAsset#_transferWithReference()
    *
    *  Call super#_transferWithReference() and notify listeners
    *  that a transfer has been performed.
    */
    function _transferWithReference(address _to, uint _value, string _reference, address _sender)
    internal
    returns (bool result)
    {
        result = super._transferWithReference(_to, _value, _reference, _sender);
        if (result) {
            notifyOnTransfer(_sender, _value);
        }
    }

    /**
    *  Notify listener that Transfer has been performed.
    */
    function notifyOnTransfer(address _from, uint _value) internal {
        for (uint i = 0; i < listenersCount; i++) {
            // Make sure that `listeners` list has no gaps and always reorganized
            address listener = listeners[i];
            ChronoBankAssetWithCallbackListener(listener).tokenFallback(_from, _value, listenersData[listener]);
        }
    }

    /**
    *  Reorganize listeners, get rid of empty gaps.
    */
    function reorganizeListeners() private {
        uint free = 1;
        while (free < listenersCount) {
            while (free < listenersCount && listeners[free] != 0) free++;
            while (listenersCount > 1 && listeners[listenersCount] == 0) listenersCount--;
            if (free < listenersCount && listeners[listenersCount] != 0 && listeners[free] == 0) {
                listeners[free] = listeners[listenersCount];
                listenerIndexs[listeners[free]] = free;
                listeners[listenersCount] = 0;
            }
        }
    }
}
