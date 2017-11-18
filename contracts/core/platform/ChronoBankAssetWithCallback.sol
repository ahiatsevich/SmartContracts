pragma solidity ^0.4.11;

import "./ChronoBankAsset.sol";
import "../common/Owned.sol";
import "../erc223/ERC223ReceiverInterface.sol";

contract ChronoBankAssetWithCallbackListener is ERC223ReceiverInterface {

}

/**
 * @title ChronoBank Asset With Callback implementation contract.
 */
contract ChronoBankAssetWithCallback is ChronoBankAsset, Owned {
    uint constant MAX_LISTENERS_COUNT = 16;
    // list of listeners
    address[16] public listeners;
    uint public listenersCount;

    // index on the list of listeners to allow reverse lookup
    mapping(address => uint) listenerIndexs;
    mapping(address => bytes) listenersData;

    /**
    *
    */
    function addListener(address _listener, bytes _data) public onlyContractOwner returns (bool) {
        if (isListener(_listener)) return;

        if (listenersCount >= MAX_LISTENERS_COUNT) {
            reorganizeListeners();
        }

        if (listenersCount >= MAX_LISTENERS_COUNT) {
            return;
        }

        listenersCount++;
        listeners[listenersCount] = _listener;
        listenerIndexs[_listener] = listenersCount;
        listenersData[_listener] = _data;
    }

    /**
    *
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
    *
    */
    function isListener(address _listener) public constant returns (bool) {
        return listenerIndexs[_listener] > 0;
    }

    /**
    *
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
    *
    */
    function notifyOnTransfer(address _from, uint _value) internal {
        for (uint i = 0; i < listenersCount; i++) {
            // Make sure that `listeners` list has no gaps and always reorganized
            address listener = listeners[i];
            bytes memory listenerData = getListenerData(listener);
            ChronoBankAssetWithCallbackListener(listener).tokenFallback(_from, _value, listenerData);
        }
    }

    /**
    *
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
