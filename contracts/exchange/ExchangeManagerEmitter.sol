pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';

/// @title ExchangeManagerEmitter.
contract ExchangeManagerEmitter is MultiEventsHistoryAdapter {
    event ExchangeCreated(
        address indexed self,
        address indexed user,
        address exchange,
        bytes32 symbol);
    event ExchangeAdded(address indexed self, address indexed user, address exchange, bytes32 symbol);
    event ExchangeRemoved(address indexed self, address exchange, bytes32 symbol);
    event Error(address indexed self, uint errorCode);

    function emitExchangeCreated(
        address user,
        address exchange,
        bytes32 symbol)
    public
    {
        ExchangeCreated(_self(), user, exchange, symbol);
    }

    function emitExchangeRemoved(address exchange, bytes32 symbol) public {
        ExchangeRemoved(_self(), exchange, symbol);
    }

    function emitExchangeAdded(address user, address exchange, bytes32 symbol) public {
        ExchangeAdded(_self(), user, exchange, symbol);
    }

    function emitError(uint errorCode) public {
        Error(_self(), errorCode);
    }
}
