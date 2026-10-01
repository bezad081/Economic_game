"""Fast deterministic smoke tests for the macro engine.

Run before packaging. The tests intentionally avoid Pygame so they can execute in CI
before the browser build begins.
"""
import math
import random
from economy import EconomyV12


def assert_finite(e, label):
    names = [
        'inflation','expected_inflation','unemployment','gdp_growth','debt_ratio',
        'exchange_rate','bond_yield','sovereign_spread','bank_lending_spread',
        'financial_conditions_index','household_stress_index','macro_risk_score',
        'bank_health','approval','consumer_confidence','business_confidence'
    ]
    for name in names:
        value = getattr(e, name)
        if not math.isfinite(float(value)):
            raise AssertionError(f'{label}: {name} is not finite: {value!r}')
    if not (0 <= e.unemployment <= .40):
        raise AssertionError(f'{label}: unemployment out of bounds: {e.unemployment}')
    if not (-.05 <= e.inflation <= .35):
        raise AssertionError(f'{label}: inflation out of bounds: {e.inflation}')
    if not (0 <= e.bank_health <= 1):
        raise AssertionError(f'{label}: bank health out of bounds: {e.bank_health}')
    if not (0 <= e.financial_conditions_index <= 100):
        raise AssertionError(f'{label}: FCI out of bounds: {e.financial_conditions_index}')


def run_case(seed, actions=(), shock=None):
    random.seed(seed)
    e = EconomyV12()
    e.set_game_mode('sandbox')
    for q in range(20):
        if q < len(actions) and actions[q]:
            e.enact(actions[q])
        if shock and q == 5:
            e.apply_shock(shock)
        e.step_quarter()
        assert_finite(e, f'seed={seed}, q={q}')
    return e


def main():
    cases = [
        (11, ['rate_up', None, None, 'reserve_up'], None),
        (22, ['rate_down', None, 'sme_credit', None, 'infra_up'], None),
        (33, [None, 'vat_up', None, 'anti_corruption'], 'oil'),
        (44, [None, 'bank_recap', 'reserve_down'], 'financial'),
        (55, ['port_upgrade', None, 'export_support'], 'sanctions'),
    ]
    results=[]
    for seed, actions, shock in cases:
        e=run_case(seed, actions, shock)
        results.append((seed,e.macro_regime,e.financial_conditions_index,e.macro_risk_score))
    print('MACROSTATE economic validation passed')
    for seed, regime, fci, risk in results:
        print(f'  seed {seed}: {regime}; FCI={fci:.1f}; macro risk={risk:.1f}')


if __name__ == '__main__':
    main()
