import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import { USDC, WETH, WETH_MARKET_ID } from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { MAX_UINT_256_BI, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot, waitDays } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupGMXBalance,
  setupGmxRegistry,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens
const amountWeiSmall = BigNumber.from('125000000000000000000'); // 125 GLP tokens

const esGmxAmount = BigNumber.from('10000000000000000'); // 0.01 esGMX tokens

describe('GLPWrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let factory: GLPWrappedTokenUserVaultFactory;
  let vault: GLPWrappedTokenUserVaultV1;
  let underlyingMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 56545700,
    });
    const vaultImplementation = await createContractWithAbi<GLPWrappedTokenUserVaultV1>(
      GLPWrappedTokenUserVaultV1__factory.abi,
      GLPWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    const gmxRegistry = await setupGmxRegistry(core);
    factory = await createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
      GLPWrappedTokenUserVaultFactory__factory.abi,
      GLPWrappedTokenUserVaultFactory__factory.bytecode,
      [
        WETH.address,
        WETH_MARKET_ID,
        gmxRegistry.address,
        core.gmxEcosystem.fsGlp.address,
        core.borrowPositionProxyV2.address,
        vaultImplementation.address,
        core.dolomiteMargin.address,
      ],
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
    await setupTestMarket(core, factory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.initialize([]);

    await factory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<GLPWrappedTokenUserVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      GLPWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );

    await setupUSDCBalance(core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
    await core.gmxEcosystem.glpRewardsRouter.mintAndStakeGlp(
      USDC.address,
      usdcAmount,
      ONE_BI,
      ONE_BI,
    );
    // use sGLP for approvals/transfers and fsGLP for checking balances
    await core.gmxEcosystem.sGlp.approve(vault.address, MAX_UINT_256_BI);
    await vault.depositIntoVaultForDolomiteMargin(ZERO_BI, amountWei);
    expect(await core.gmxEcosystem.fsGlp.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);

    await core.gmxEcosystem.esGmxDistributor.setTokensPerInterval('10333994708994708');

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#handleRewards', () => {
    it('should work', async () => {
      expect(await core.gmxEcosystem.esGmx.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.weth.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect(await core.weth.balanceOf(core.hhUser1.address)).to.be.eq(ZERO_BI);

      await waitDays(30);
      await vault.handleRewards(true, false, true, false, true, true, false);

      expect((await core.gmxEcosystem.esGmx.balanceOf(vault.address)).gt(ZERO_BI)).to.eq(true);
      expect(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.gmxEcosystem.gmx.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.weth.balanceOf(vault.address)).to.eq(ZERO_BI);
      expect((await core.weth.balanceOf(core.hhUser1.address)).gt(ZERO_BI)).to.eq(true);
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).handleRewards(false, false, false, false, false, false, false),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#stakeGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core.hhUser1, gmxAmount, vault);
      await vault.stakeGmx(gmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(gmxAmount);
    });
  });

  describe('#unstakeGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core.hhUser1, gmxAmount, vault);
      await vault.stakeGmx(gmxAmount);
      await vault.unstakeGmx(gmxAmount);
      expect(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(gmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(ZERO_BI);
    });
  });

  describe('#stakeEsGmx', () => {
    it('should work when GMX is vesting', async () => {
      await waitDays(30);
      await vault.handleRewards(true, false, true, false, true, true, false);

      const esGmx = core.gmxEcosystem.esGmx;
      const originalBalance = await esGmx.balanceOf(vault.address);
      await vault.stakeEsGmx(esGmxAmount);
      expect(await vault.esGmxBalanceOf()).to.eq(originalBalance);
      expect(await core.gmxEcosystem.sGmx.depositBalances(vault.address, esGmx.address)).to.eq(esGmxAmount);
      expect(await esGmx.balanceOf(vault.address)).to.eq(originalBalance.sub(esGmxAmount));
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(esGmxAmount);
    });
  });

  describe('#unstakeEsGmx', () => {
    it('should work normally', async () => {
      await waitDays(30);
      await vault.handleRewards(true, false, true, false, true, true, false);

      const esGmx = core.gmxEcosystem.esGmx;
      const originalBalance = await esGmx.balanceOf(vault.address);
      await vault.stakeEsGmx(esGmxAmount);

      await vault.unstakeEsGmx(esGmxAmount);
      expect(await vault.esGmxBalanceOf()).to.eq(originalBalance);
      expect(await core.gmxEcosystem.sGmx.depositBalances(vault.address, esGmx.address)).to.eq(ZERO_BI);
      expect(await esGmx.balanceOf(vault.address)).to.eq(originalBalance);
      expect(await core.gmxEcosystem.sbfGmx.balanceOf(vault.address)).to.eq(ZERO_BI);
    });
  });

  describe('#vestGlp', () => {
    it('should ', async () => {
    });
  });

  describe('#unvestGlp', () => {
    it('should ', async () => {
    });
  });

  describe('#vestGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core.hhUser1, gmxAmount, vault);
      await vault.stakeGmx(gmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.sbfGmx. balanceOf(vault.address)).to.eq(gmxAmount);

      await waitDays(30);
      await vault.handleRewards(true, false, true, false, false, true, false);
      await vault.vestGmx(esGmxAmount);
      // the amount of GMX in the vault should be unchanged if some of it moves into vesting
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
    });
  });

  describe('#unvestGmx', () => {
    it('should work when GMX is re-staked', async () => {
      await setupGMXBalance(core.hhUser1, gmxAmount, vault);
      await vault.stakeGmx(gmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.sbfGmx. balanceOf(vault.address)).to.eq(gmxAmount);

      await waitDays(30);
      await vault.handleRewards(true, false, true, false, false, true, false);
      await vault.vestGmx(esGmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);

      await waitDays(366);
      await vault.unvestGmx(true);

      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount.add(esGmxAmount));
    });

    it('should work when vested GMX is withdrawn', async () => {
      await setupGMXBalance(core.hhUser1, gmxAmount, vault);
      await vault.stakeGmx(gmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.sbfGmx. balanceOf(vault.address)).to.eq(gmxAmount);

      await waitDays(30);
      await vault.handleRewards(true, false, true, false, false, true, false);
      await vault.vestGmx(esGmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);

      await waitDays(366);
      await vault.unvestGmx(false);

      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem.gmx.balanceOf(core.hhUser1.address)).to.eq(esGmxAmount);
    });
  });

  describe('#acceptTransfer', () => {
    it('should work when the vault has had no interactions with GMX', async () => {
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should ', async () => {
    });
  });

  describe('#gmxRewardsRouter', () => {
    it('should work normally', async () => {
      expect(await vault.gmxRewardsRouter()).to.equal(core.gmxEcosystem.gmxRewardsRouter.address);
    });
  });

  describe('#underlyingBalanceOf', () => {
    it('should work when funds are only in vault', async () => {
      expect(await vault.underlyingBalanceOf()).to.equal(amountWei);
    });

    it('should work when funds are in vault and vesting', async () => {
    });

    it('should work when funds are only in vesting', async () => {
    });
  });

  describe('#gmxBalanceOf', () => {
    it('should work when GMX is vesting and staked', async () => {
      await setupGMXBalance(core.hhUser1, gmxAmount, vault);
      await vault.stakeGmx(gmxAmount);
      await waitDays(30);
      await vault.handleRewards(true, false, true, false, true, true, false);
      await vault.vestGmx(esGmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
    });

    it('should work when GMX is vesting, staked, and idle', async () => {
      await setupGMXBalance(core.hhUser1, gmxAmount, vault);
      await vault.stakeGmx(gmxAmount);
      await waitDays(30);
      await vault.handleRewards(true, false, true, false, true, true, false);
      await vault.vestGmx(esGmxAmount);
      expect(await vault.gmxBalanceOf()).to.eq(gmxAmount);
    });

    it('should work when no GMX is deposited at all', async () => {
      expect(await vault.gmxBalanceOf()).to.eq(ZERO_BI);
    });
  });
});
