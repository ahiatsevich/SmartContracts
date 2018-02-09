pragma solidity ^0.4.9;

contract ERC223ReceiverInterface {
  function tokenFallback(address _from, uint _value, bytes _data) public;
}
