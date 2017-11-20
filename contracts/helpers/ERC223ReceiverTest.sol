pragma solidity ^0.4.9;

import "../core/platform/ChronoBankAssetWithCallbackListener.sol";

contract ERC223ReceiverTest {
    address eventsHistory;

    event TokenFallbackEvent(address _from, uint _value, bytes _data);

    function ERC223ReceiverTest(address _eventsHistory) public {
        require(_eventsHistory != 0x0);
        eventsHistory = _eventsHistory;
    }

    function tokenFallback(address _from, uint _value, bytes _data) public {
        ERC223ReceiverTest(eventsHistory).emitEvent(_from, _value, _data);
    }

    function emitEvent(address _from, uint _value, bytes _data) {
        TokenFallbackEvent(_from, _value, _data);
    }
}
