pragma solidity ^0.4.11;

contract Clock {
    function time() public constant returns (uint) {
        return now;
    }
}
