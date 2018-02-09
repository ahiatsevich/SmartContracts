pragma solidity ^0.4.9;

/// @title New ERC23 contract interface
contract ERC223 {
    event Transfer(address indexed from, address indexed to, uint value, bytes indexed data);

    uint public totalSupply;

    function balanceOf(address who) public constant returns (uint);

    function name() public constant returns (string _name);
    function symbol() public constant returns (string _symbol);
    function decimals() public constant returns (uint8 _decimals);
    function totalSupply() public constant returns (uint256 _supply);

    function transfer(address to, uint value) public returns (bool ok);
    function transfer(address to, uint value, bytes data) public returns (bool ok);
    function transfer(address to, uint value, bytes data, string custom_fallback) public returns (bool ok);
}
