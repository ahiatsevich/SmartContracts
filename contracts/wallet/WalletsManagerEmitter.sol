pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';

contract WalletsManagerEmitter is MultiEventsHistoryAdapter {
    event Error(address indexed self, uint errorCode);
    event WalletAdded(address indexed self, address wallet);
    event WalletCreated(address indexed self, address wallet);

    function emitError(uint errorCode) public {
        Error(_self(), errorCode);
    }

    function emitWalletAdded(address wallet) public {
        WalletAdded(_self(), wallet);
    }

    function emitWalletCreated(address wallet) public {
        WalletCreated(_self(), wallet);
    }
}
