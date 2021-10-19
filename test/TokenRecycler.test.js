const { accounts, contract } = require('@openzeppelin/test-environment');
const keccak256 = require('keccak256');

const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    time
} = require('@openzeppelin/test-helpers');

const { expect, assert } = require('chai');

const TokenRecycler = contract.fromArtifact('TokenRecycler');
const MockERC20 = contract.fromArtifact('MockERC20');
const ShitiumToken = contract.fromArtifact('ShitiumToken');
const WBNB = contract.fromArtifact('WBNB');
const UniswapV2Pair = contract.fromArtifact('UniswapV2Pair');
const UniswapV2Factory = contract.fromArtifact('UniswapV2Factory');

describe('ScrapMaster', function () {

    const [owner, minter, bob, vaultAddress, ...rest] = accounts;

    context('token recycler', function () {
        beforeEach(async function () {
            this.mainToken = await ShitiumToken.new({ from: owner });
            await this.mainToken.grantRole(keccak256("MINTER_ROLE"), minter, { from: owner });
            await this.mainToken.mint(owner, '1000000000000', { from: minter });
            this.mockTokenA = await MockERC20.new('MockTokenA', 'TOKA', '1000000000000', { from: owner });
            this.mockTokenB = await MockERC20.new('MockTokenB', 'TOKB', '1000000000000', { from: owner });
            this.wbnb = await MockERC20.new('Wrapped BNB', 'WBNB', '1000000000000', { from: owner });
            this.factory = await UniswapV2Factory.new(owner, { from: owner });
            this.tokenRecycler = await TokenRecycler.new(
                this.factory.address,
                this.mainToken.address,
                this.wbnb.address,
                { from: owner }
            );
            await this.tokenRecycler.setVault(vaultAddress, { from: owner });
            // Pairs creation
            this.mainTokenWBNB = await UniswapV2Pair.at(
                (await this.factory.createPair(this.mainToken.address, this.wbnb.address, 1, { from: owner })
            ).logs[0].args.pair);
            this.mockAMockB = await UniswapV2Pair.at(
                (await this.factory.createPair(this.mockTokenA.address, this.mockTokenB.address, 1, { from: owner })
            ).logs[0].args.pair);
            this.mockAWBNB = await UniswapV2Pair.at(
                (await this.factory.createPair(this.mockTokenA.address, this.wbnb.address, 1, { from: owner })
            ).logs[0].args.pair);
            
            this.mockBWBNB = await UniswapV2Pair.at(
                (await this.factory.createPair(this.mockTokenB.address, this.wbnb.address, 1, { from: owner })
            ).logs[0].args.pair);
        });

        it('should make Tokens successfully', async function() {
            await this.factory.setFeeTo(this.tokenRecycler.address, { from: owner });
            await this.wbnb.transfer(this.mainTokenWBNB.address, '10000000', { from: owner });
            await this.mainToken.transfer(this.mainTokenWBNB.address, '10000000', { from: owner });
            await this.mainTokenWBNB.mint(owner);
            
            await this.mockTokenA.transfer(this.mockAMockB.address, '10000000', { from: owner });
            await this.mockTokenB.transfer(this.mockAMockB.address, '10000000', { from: owner });
            await this.mockAMockB.mint(owner);

            await this.wbnb.transfer(this.mockAWBNB.address, '10000000', { from: owner });
            await this.mockTokenA.transfer(this.mockAWBNB.address, '10000000', { from: owner });
            await this.mockAWBNB.mint(owner);
            
            await this.wbnb.transfer(this.mockBWBNB.address, '10000000', { from: owner });
            await this.mockTokenB.transfer(this.mockBWBNB.address, '10000000', { from: owner });
            await this.mockBWBNB.mint(owner);
            
            console.log('[*]TOKEN A - WBNB');            
            await this.mockTokenA.transfer(this.mockAWBNB.address, '100000', { from: owner });
            await this.wbnb.transfer(this.mockAWBNB.address, '100000', { from: owner });
            await this.mockAWBNB.sync();
            await this.mockTokenA.transfer(this.mockAWBNB.address, '10000000', { from: owner });
            await this.wbnb.transfer(this.mockAWBNB.address, '10000000', { from: owner });
            await this.mockAWBNB.mint(owner);

            console.log('VAULT 0 SHITIUM:',await this.mainToken.balanceOf(vaultAddress));
            console.log('VAULT 0 WBNB:',await this.wbnb.balanceOf(vaultAddress));
            console.log('CONTRACT 0 SHITIUM:',await this.mainToken.balanceOf(this.tokenRecycler.address));
            console.log('CONTRACT 0 WBNB:',await this.wbnb.balanceOf(this.tokenRecycler.address));
            await this.tokenRecycler.recycle(this.mockTokenA.address, this.wbnb.address, { from: owner });
            console.log('VAULT 1 SHITIUM:',await this.mainToken.balanceOf(vaultAddress));
            console.log('VAULT 1 WBNB:',await this.wbnb.balanceOf(vaultAddress));
            console.log('CONTRACT 1 SHITIUM:',await this.mainToken.balanceOf(this.tokenRecycler.address));
            console.log('CONTRACT 1 WBNB:',await this.wbnb.balanceOf(this.tokenRecycler.address));
            
        });
    });
});
