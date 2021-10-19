// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockTokenA is ERC20("TokenA", "TokA"), Ownable{
    
    using SafeMath for uint256;
    
    event Minted(
        address indexed minter,
        address indexed receiver,
        uint256 mintAmount
    );
    
    event Burned(address indexed burner, uint256 burnAmount);
    
    function burn(uint256 _amount) public {
        _burn(msg.sender, _amount);
        emit Burned(msg.sender, _amount);
    }
    
    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
        emit Minted(owner(), _to, _amount);
    }
    
}