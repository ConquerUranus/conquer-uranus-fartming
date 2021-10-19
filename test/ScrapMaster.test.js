const { accounts, contract } = require('@openzeppelin/test-environment');
const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    time
} = require('@openzeppelin/test-helpers');

const { expect, assert } = require('chai');
const keccak256 = require('keccak256');

const ScrapMaster = contract.fromArtifact('ScrapMaster');
const ShitiumToken = contract.fromArtifact('ShitiumToken');
const MockTokenA = contract.fromArtifact('MockTokenA');
const MockTokenB = contract.fromArtifact('MockTokenB');


describe('ScrapMaster', function () {

    const [owner, alice, bob, feeAddress, ...rest] = accounts;

    context('construction functionalities', function () {

        beforeEach(async function () {
            this.shitiumToken = await ShitiumToken.new({ from: owner });
            this.mockTokenA = await MockTokenA.new({ from: owner });
            this.mockTokenB = await MockTokenB.new({ from: owner });
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '10', '0', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
        });

        it('should not create pool if not owner', async function () {
            await expectRevert(
                this.scrapMaster.add(
                    '10',
                    this.mockTokenA.address,
                    0,
                    { from: alice }
                ),
                "Ownable: caller is not the owner"
            )
        });

        it('should create pool', async function () {
            await this.scrapMaster.add('10', this.mockTokenA.address, 0, { from: owner });
            const poolLength = await this.scrapMaster.poolLength();
            assert.equal(poolLength, '1');
        });
    });

    context('Staking functionalities', async function () {

        beforeEach(async function () {
            this.shitiumToken = await ShitiumToken.new({ from: owner });
            this.mockTokenA = await MockTokenA.new({ from: owner });
            this.mockTokenB = await MockTokenB.new({ from: owner });
            await this.mockTokenA.mint(alice, '1000');
            await this.mockTokenA.mint(bob, '1000');
        });

        it('should deposit and extract deposit fee', async function () {
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '10', '10', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
            await this.scrapMaster.add('100', this.mockTokenA.address, 400, { from: owner });
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: alice });
            await this.scrapMaster.deposit(0, '360', false, { from: alice });
            assert.equal((await this.mockTokenA.balanceOf(this.scrapMaster.address)).toString(), '346');
            assert.equal((await this.mockTokenA.balanceOf(feeAddress)).toString(), '14');
        });

        it('should allow emergency withdraw', async function () {
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '10', '10', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
            await this.scrapMaster.add('100', this.mockTokenA.address, 0, { from: owner });
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: alice });
            await this.scrapMaster.deposit(0, '300', false, { from: alice });
            assert.equal((await this.mockTokenA.balanceOf(alice)).toString(), '700');
            await this.scrapMaster.emergencyWithdraw(0, { from: alice });
            assert.equal((await this.mockTokenA.balanceOf(alice)).toString(), '1000');
        });

        it('should mint SHITIUM when locked for staking', async function () {
            await time.advanceBlockTo('45');
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '1', '50', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
            // Pool creation
            await this.scrapMaster.add('1000', this.mockTokenA.address, 0, { from: owner });
            await this.scrapMaster.add('1000', this.mockTokenB.address, 0, { from: owner });
            // Deposit
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: alice });
            let txReceipt = await this.scrapMaster.deposit(0, '1000', true, { from: alice });
            expectEvent(txReceipt, 'Deposit', { user: alice, amount: '1000' });
            const preBalance = await this.shitiumToken.balanceOf(this.scrapMaster.address);
            assert.equal(preBalance.toString(), '0');
            // Time advance to mint some tokens
            await time.advanceBlockTo('75');
            await this.scrapMaster.updatePool(0);
            const postBalance = await this.shitiumToken.balanceOf(this.scrapMaster.address);
            assert.notEqual(postBalance.toString(), '0');
        });

        it('should mint SHITIUM proportionally with the LP staked', async function () {
            await time.advanceBlockTo('81');
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '10', '82', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
            // Pool creation
            await this.scrapMaster.add('1000', this.mockTokenA.address, 0, { from: owner });

            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: alice });
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: bob });
            await time.advanceBlockTo('88');
            let txReceipt = await this.scrapMaster.deposit(0, '336', true, { from: alice });
            expectEvent(txReceipt, 'Deposit', { user: alice, amount: '336' });
            txReceipt = await this.scrapMaster.deposit(0, '664', true, { from: bob });
            expectEvent(txReceipt, 'Deposit', { user: bob, amount: '664' });
            await time.advanceBlockTo('101');
        });

        it('should allow to claim SHITIUM ', async function () {
            await time.advanceBlockTo('136');
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '1', '140', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
            // Pool creation
            await this.scrapMaster.add('1000', this.mockTokenA.address, 0, { from: owner });
            // Deposit
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: alice });
            let txReceipt = await this.scrapMaster.deposit(0, '1000', true, { from: alice });
            expectEvent(txReceipt, 'Deposit', { user: alice, amount: '1000' });
            const preBalance = await this.shitiumToken.balanceOf(this.scrapMaster.address);
            assert.equal(preBalance.toString(), '0');
            // Time advance to mint some tokens
            await time.advanceBlockTo('170');
            const preClaim = await this.scrapMaster.pendingToken(0, alice);
            assert.notEqual(preClaim.toString(), '0');
            await this.scrapMaster.claim(0, { from: alice });
            const postClaim = await this.scrapMaster.pendingToken(0, alice);
            assert.equal(postClaim.toString(), '0');
        });

        it('should handle multiple stakes independently', async function () {
            await time.advanceBlockTo('176');
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '10', '180', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
            // Pool creation
            await this.scrapMaster.add('1000', this.mockTokenA.address, 0, { from: owner });

            // Deposit 1 Alice
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: alice });
            let txReceipt = await this.scrapMaster.deposit(0, '250', true, { from: alice });
            let pid = txReceipt.logs[0].args.pid.toString();
            await this.scrapMaster.poolInfo(pid)
            let balance = await this.mockTokenA.balanceOf(this.scrapMaster.address);
            assert.equal(balance.toString(), '250');
            await this.scrapMaster.deposit(0, '463', true, { from: alice });
            // 250 + 463 = 713
            balance = await this.mockTokenA.balanceOf(this.scrapMaster.address);
            assert.equal(balance.toString(), '713');
            // Withdraw 1 deposit
            await this.scrapMaster.withdraw(pid, '250', true, { from: alice });
            balance = await this.mockTokenA.balanceOf(this.scrapMaster.address);
            assert.equal(balance.toString(), '463');
            // Withdraw 2 deposit
            await this.scrapMaster.withdraw(pid, '463', true, { from: alice });
            balance = await this.mockTokenA.balanceOf(this.scrapMaster.address);
            assert.equal(balance.toString(), '0');
        });

        it('should handle stakes for multiple users', async function () {
            await time.advanceBlockTo('194');
            this.scrapMaster = await ScrapMaster.new(this.shitiumToken.address, '10', '200', feeAddress, { from: owner });
            this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), this.scrapMaster.address, { from: owner });
            // Pool creation
            await this.scrapMaster.add('1000', this.mockTokenA.address, 0, { from: owner });
            // Deposit Alice
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: alice });
            let txReceiptA = await this.scrapMaster.deposit(0, '1000', true, { from: alice });
            let pidA = txReceiptA.logs[0].args.pid.toString();
            expectEvent(txReceiptA, 'Deposit', { user: alice, amount: '1000' });
            // Deposit Bob
            await this.mockTokenA.approve(this.scrapMaster.address, '1000', { from: bob });
            let txReceiptB = await this.scrapMaster.deposit(0, '1000', true, { from: bob });
            let pidB = txReceiptA.logs[0].args.pid.toString();
            expectEvent(txReceiptB, 'Deposit', { user: bob, amount: '1000' });
            const preBalance = await this.shitiumToken.balanceOf(this.scrapMaster.address);
            // Advance 29 blocks for minting some tokens + update pool = 29 blocks + 1 block => 10 Tokens/block * 30 = 300
            await time.advanceBlockTo('229');
            await this.scrapMaster.updatePool(pidA);
            const balance = await this.shitiumToken.balanceOf(this.scrapMaster.address);
            assert.equal(balance.toString(), '300');
            await this.scrapMaster.claim(pidA, { from: alice });
            const claimA = await this.scrapMaster.pendingToken(pidA, alice);
            assert.equal(claimA.toString(), '0');
            await this.scrapMaster.claim(pidB, { from: bob });
            const postClaimB = await this.scrapMaster.pendingToken(pidB, bob);
            assert.equal(postClaimB.toString(), '0');
        });

    });
});