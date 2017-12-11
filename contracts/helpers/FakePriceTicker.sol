pragma solidity ^0.4.11;

import "../crowdsale/base/PriceTicker.sol";

contract FakePriceTicker is PriceTicker {

    function isPriceAvailable(bytes32, bytes32) public constant returns (bool) {
        return true;
    }

    function price(bytes32, bytes32) public constant returns (uint, uint) {
        return (10, 1);
    }

    function requestPrice(bytes32, bytes32) public payable returns (bytes32, uint) {
        PriceTickerCallback(msg.sender).receivePrice(keccak256(block.number, now), 10, 1);
    }
}
