import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  IERC4626,
  IPlutusVaultGLP__factory,
  IPlutusVaultGLPFarm, PendleGlp2024Registry, PendleGlp2024WrappedTokenUserVaultFactory,
  PendleGlp2024WrappedTokenUserVaultV1, PendlePtGLPPriceOracle, PendlePtGLPUnwrapperTrader, PendlePtGLPWrapperTrader,
  PlutusVaultGLPPriceOracle,
  PlutusVaultGLPUnwrapperTrader,
  PlutusVaultGLPWrappedTokenUserVaultV1__factory,
  PlutusVaultGLPWrapperTrader,
  PlutusVaultRegistry,
  SimpleWrappedTokenUserVaultFactory,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import {
  createPendleGLP2024WrappedTokenUserVaultFactory,
  createPendleGlp2024WrappedTokenUserVaultV1,
  createPlutusVaultGLPPriceOracle,
  createPlutusVaultGLPUnwrapperTrader,
  createPlutusVaultGLPWrapperTrader,
  createPlutusVaultRegistry,
} from '../../utils/wrapped-token-utils';

const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 plvGLP tokens
const stakedAmountWei = amountWei.mul(2).div(3); // 833.3333 plvGLP tokens
const unstakedAmountWei = amountWei.sub(stakedAmountWei); // 416.6666 plvGLP tokens

const accountNumber = ZERO_BI;

describe('PendleGlp2024WrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let pendleRegistry: PendleGlp2024Registry;
  let unwrapper: PendlePtGLPUnwrapperTrader;
  let wrapper: PendlePtGLPWrapperTrader;
  let priceOracle: PendlePtGLPPriceOracle;
  let factory: PendleGlp2024WrappedTokenUserVaultFactory;
  let vault: PendleGlp2024WrappedTokenUserVaultV1;
  let underlyingMarketId: BigNumber;
  let account: Account.InfoStruct;
  let rewardToken: IERC20;
  let farm: IPlutusVaultGLPFarm;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
    farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
    const userVaultImplementation = await createPendleGlp2024WrappedTokenUserVaultV1();
    pendleRegistry = await createPendleGlp2024Registry(core);
    factory = await createPendleGLP2024WrappedTokenUserVaultFactory(
      core,
      pendleRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createPendleGLP2024UnwrapperTrader(core, pendleRegistry, factory);
    wrapper = await createPendleGLP2024WrapperTrader(core, pendleRegistry, factory);
    priceOracle = await createPendleGLP2024PriceOracle(core, pendleRegistry, factory, unwrapper);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendleGlp2024WrappedTokenUserVaultV1>(
      vaultAddress,
      PlutusVaultGLPWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );
    account = { owner: vault.address, number: accountNumber };

    const usdcAmount = amountWei.div(1e12).mul(8);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.usdc.address, usdcAmount, 0, 0);
    const glpAmount = amountWei.mul(4);
    await core.plutusEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.plutusEcosystem!.plvGlpRouter.address, glpAmount);
    await core.plutusEcosystem!.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
    await core.plutusEcosystem!.plvGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    expect(await vault.underlyingBalanceOf()).to.eq(amountWei);

    const glpProtocolBalance = await core.dolomiteMargin.getAccountWei(account, underlyingMarketId);
    expect(glpProtocolBalance.sign).to.eq(true);
    expect(glpProtocolBalance.value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should work vault params are set to false', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
      const plvGlp = IPlutusVaultGLP__factory.connect(await pendleRegistry.plvGlpToken(), core.hhUser1);
      const owner = await impersonate(await plvGlp.owner(), true);
      const canDoAnything = false;
      await plvGlp.connect(owner).setParams(canDoAnything, canDoAnything, canDoAnything, canDoAnything);
      expect(await vault.isExternalRedemptionPaused()).to.be.true;
    });
  });
});
