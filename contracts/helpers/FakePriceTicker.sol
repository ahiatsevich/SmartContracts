pragma solidity ^0.4.11;

import "../crowdsale/base/PriceTicker.sol";

contract FakePriceTicker is PriceTicker {

    function isPriceAvailable(bytes32 fsym, bytes32 tsym) public constant returns (bool) {
        fsym.length == 0;
        tsym.length == 0;

        return true;
    }

    function price(bytes32 fsym, bytes32 tsym) public constant returns (uint, uint) {
        fsym.length == 0;
        tsym.length == 0;

        return (10, 1);
    }

    function requestPrice(bytes32 fsym, bytes32 tsym) public payable returns (bytes32, uint) {
        fsym.length == 0;
        tsym.length == 0;

        PriceTickerCallback(msg.sender).receivePrice(keccak256(block.number, now), 10, 1);
    }
}
