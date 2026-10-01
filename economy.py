import math
import random
import copy
from dataclasses import dataclass, field
from collections import deque
from typing import Dict, List, Tuple, Optional

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def pct(x):
    return f"{x * 100:.1f}%"

def money(x):
    sign = "-" if x < 0 else ""
    return f"{sign}${abs(x):,.0f}B"

def lerp(a, b, t):
    return a + (b - a) * t

@dataclass
class PolicySettings:
    income_tax: float = 0.22
    corporate_tax: float = 0.21
    vat: float = 0.10
    policy_rate: float = 0.045
    reserve_requirement: float = 0.10
    welfare_spending: float = 0.08
    health_spending: float = 0.07
    education_spending: float = 0.06
    infrastructure_spending: float = 0.055
    defense_spending: float = 0.035
    green_spending: float = 0.025
    tariff_rate: float = 0.05
    export_subsidy: float = 0.01
    minimum_wage: float = 1.00
    capital_controls: float = 0.0
    exchange_intervention: float = 0.0
    carbon_tax: float = 0.0

@dataclass(frozen=True)
class PolicyActionSpec:
    capacity_cost: float
    political_cost: float = 0.0
    cooldown: int = 1
    minimum_treasury: float = -20.0


# Policy capacity prevents button-spamming and turns policy making into a scarce-resource game.
# Political cost represents coalition/legislative difficulty; capacity refreshes each quarter.
POLICY_ACTION_RULES: Dict[str, PolicyActionSpec] = {
    'rate_up': PolicyActionSpec(14, 0, 1), 'rate_down': PolicyActionSpec(14, 0, 1),
    'reserve_up': PolicyActionSpec(12, 0, 1), 'reserve_down': PolicyActionSpec(12, 0, 1),
    'bank_recap': PolicyActionSpec(22, 4, 2), 'support_fx': PolicyActionSpec(16, 1, 1, 5),
    'qe': PolicyActionSpec(24, 2, 2), 'debt_restructure': PolicyActionSpec(36, 12, 8),
    'income_tax_up': PolicyActionSpec(18, 4, 2), 'income_tax_down': PolicyActionSpec(18, 4, 2),
    'corp_tax_up': PolicyActionSpec(18, 4, 2), 'corp_tax_down': PolicyActionSpec(18, 4, 2),
    'stimulus': PolicyActionSpec(28, 7, 2), 'austerity': PolicyActionSpec(26, 8, 3),
    'welfare_up': PolicyActionSpec(20, 5, 2), 'infra_up': PolicyActionSpec(24, 6, 3),
    'education_up': PolicyActionSpec(24, 6, 3), 'health_up': PolicyActionSpec(22, 5, 3),
    'green_up': PolicyActionSpec(22, 5, 3), 'min_wage_up': PolicyActionSpec(18, 4, 2),
    'anti_corruption': PolicyActionSpec(30, 10, 5), 'carbon_tax': PolicyActionSpec(22, 7, 3),
    'tariff_up': PolicyActionSpec(18, 5, 2), 'tariff_down': PolicyActionSpec(16, 3, 2),
    'export_support': PolicyActionSpec(20, 4, 2), 'devalue': PolicyActionSpec(24, 7, 3),
    'capital_controls': PolicyActionSpec(28, 9, 4), 'port_upgrade': PolicyActionSpec(24, 6, 3),
    'sanction_relief': PolicyActionSpec(28, 10, 4), 'intel_espionage': PolicyActionSpec(26, 8, 4, 8),
    'food_subsidy': PolicyActionSpec(18, 4, 2), 'security_package': PolicyActionSpec(18, 5, 2),
    'housing_support': PolicyActionSpec(22, 5, 3), 'public_transport': PolicyActionSpec(22, 5, 3),
    'research_grant': PolicyActionSpec(22, 5, 3), 'imf_bailout': PolicyActionSpec(35, 14, 8),
    'vat_up': PolicyActionSpec(16, 3, 2), 'vat_down': PolicyActionSpec(16, 3, 2),
    'job_training': PolicyActionSpec(22, 6, 3), 'sme_credit': PolicyActionSpec(20, 5, 2),
    'energy_subsidy': PolicyActionSpec(18, 5, 2), 'macroprudential_up': PolicyActionSpec(16, 2, 2),
    'mortgage_tighten': PolicyActionSpec(16, 4, 2), 'wealth_tax_up': PolicyActionSpec(20, 7, 3),
    'payroll_tax_cut': PolicyActionSpec(20, 5, 2), 'fdi_incentives': PolicyActionSpec(22, 6, 3),
    'business_reform': PolicyActionSpec(26, 9, 4), 'food_reserve': PolicyActionSpec(16, 4, 3),
    'childcare_support': PolicyActionSpec(20, 6, 3),
}


# Combined policy packages give players strategic presets without taking away control over
# the individual policy levers. Packages use one cabinet decision, have a discounted
# administrative cost, and put their component policies on cooldown.
POLICY_PACKAGES = {
    'soft_landing': {
        'name': 'Soft Landing Mix',
        'actions': ('rate_up', 'infra_up', 'anti_corruption'),
        'capacity_cost': 72, 'political_cost': 13, 'cooldown': 4,
        'description': 'Cool demand while protecting supply capacity and institutional confidence.',
        'tradeoff': 'Short-term investment and consumption soften; medium-term credibility and capacity improve.',
    },
    'recovery_jobs': {
        'name': 'Recovery & Jobs',
        'actions': ('rate_down', 'stimulus', 'infra_up'),
        'capacity_cost': 68, 'political_cost': 12, 'cooldown': 4,
        'description': 'Coordinated monetary and fiscal support for a weak economy.',
        'tradeoff': 'Faster growth and hiring, but higher inflation and public debt risk.',
    },
    'supply_productivity': {
        'name': 'Productivity Push',
        'actions': ('infra_up', 'education_up', 'research_grant', 'port_upgrade'),
        'capacity_cost': 82, 'political_cost': 18, 'cooldown': 5,
        'description': 'Invest in logistics, skills, R&D and infrastructure to raise potential output.',
        'tradeoff': 'Expensive and slow to mature, but creates durable growth with less inflation pressure.',
    },
    'export_competitiveness': {
        'name': 'Export Competitiveness',
        'actions': ('tariff_down', 'export_support', 'port_upgrade'),
        'capacity_cost': 60, 'political_cost': 11, 'cooldown': 4,
        'description': 'Open input markets, finance exporters and remove logistics bottlenecks.',
        'tradeoff': 'Domestic protected sectors face more competition while exporters gain market share.',
    },
    'green_transition': {
        'name': 'Green Industrial Deal',
        'actions': ('green_up', 'public_transport', 'carbon_tax', 'research_grant'),
        'capacity_cost': 78, 'political_cost': 20, 'cooldown': 5,
        'description': 'Combine clean infrastructure, transit, carbon pricing and innovation support.',
        'tradeoff': 'Near-term industrial costs rise, while energy security, productivity and emissions improve later.',
    },
    'financial_rescue': {
        'name': 'Financial Stabilization',
        'actions': ('bank_recap', 'support_fx', 'reserve_down'),
        'capacity_cost': 66, 'political_cost': 10, 'cooldown': 4,
        'description': 'Restore bank solvency, defend the currency and release emergency credit.',
        'tradeoff': 'Can stop a credit freeze but may add debt and reignite inflation if used too early.',
    },
    'fiscal_repair': {
        'name': 'Fiscal Repair',
        'actions': ('austerity', 'anti_corruption', 'income_tax_up'),
        'capacity_cost': 72, 'political_cost': 22, 'cooldown': 5,
        'description': 'Rebuild fiscal credibility through spending restraint, revenue and governance reform.',
        'tradeoff': 'Debt dynamics improve, but demand, employment and approval can weaken in the short run.',
    },
    'cost_of_living': {
        'name': 'Cost-of-Living Shield',
        'actions': ('food_subsidy', 'energy_subsidy', 'welfare_up'),
        'capacity_cost': 58, 'political_cost': 12, 'cooldown': 4,
        'description': 'Temporarily protect vulnerable households from food and energy price shocks.',
        'tradeoff': 'Relieves poverty and headline inflation, but costs money and can delay needed price adjustment.',
    },
    'housing_affordability': {
        'name': 'Housing Affordability Plan',
        'actions': ('housing_support', 'infra_up', 'mortgage_tighten'),
        'capacity_cost': 64, 'political_cost': 14, 'cooldown': 4,
        'description': 'Expand supply while limiting speculative credit and improving infrastructure.',
        'tradeoff': 'Construction improves affordability, but tighter mortgage standards can cool demand quickly.',
    },
    'sme_jobs': {
        'name': 'SME & Jobs Compact',
        'actions': ('sme_credit', 'payroll_tax_cut', 'job_training'),
        'capacity_cost': 60, 'political_cost': 13, 'cooldown': 4,
        'description': 'Support small firms, hiring and worker skills without relying on a very broad stimulus.',
        'tradeoff': 'Creates jobs and activity, but costs fiscal revenue and may add inflation if the economy is already hot.',
    },
    'resilience': {
        'name': 'Economic Resilience Package',
        'actions': ('food_reserve', 'port_upgrade', 'business_reform', 'fdi_incentives'),
        'capacity_cost': 76, 'political_cost': 18, 'cooldown': 5,
        'description': 'Strengthen supply chains, institutions, investment and strategic reserves.',
        'tradeoff': 'Expensive and slow, but reduces vulnerability to external and supply shocks.',
    },
}


@dataclass
class LaggedImpulse:
    name: str
    remaining: int
    duration: int
    effects: Dict[str, float]
    description: str
    flow_type: str = "Liquidity"

    def step(self):
        if self.remaining <= 0:
            return None
        age = self.duration - self.remaining
        phase = (age + 1) / max(1, self.duration)
        weight = math.sin(math.pi * phase)
        self.remaining -= 1
        return {k: v * weight / max(1, self.duration * 0.62) for k, v in self.effects.items()}

@dataclass
class StartupSector:
    count: int = 14
    unicorns: int = 1
    valuation: float = 35.0
    failure_rate: float = 0.08

    def step(self, credit_growth, gdp_growth, tech_index):
        venture_climate = credit_growth * 1.5 + gdp_growth * 2.0 + (tech_index - 70) * 0.01
        self.count = max(4, int(self.count * (1 + clamp(venture_climate, -0.2, 0.3))))
        if venture_climate > 0.12 and random.random() < 0.35:
            self.unicorns += 1
        elif venture_climate < -0.08 and self.unicorns > 0 and random.random() < 0.25:
            self.unicorns -= 1
        self.valuation = max(8.0, self.valuation * (1 + venture_climate * 0.8))

@dataclass
class Economy:
    potential_gdp: float = 1000.0
    consumption: float = 610.0
    investment: float = 180.0
    government_spending: float = 190.0
    exports: float = 115.0
    imports: float = 105.0
    price_index: float = 100.0
    previous_price_index: float = 99.4
    inflation: float = 0.024
    expected_inflation: float = 0.025
    unemployment: float = 0.055
    natural_unemployment: float = 0.045
    productivity_growth: float = 0.018
    wage_growth: float = 0.028
    nominal_wage_index: float = 100.0
    exchange_rate: float = 1.00
    previous_exchange_rate: float = 1.00
    debt: float = 520.0
    treasury: float = 45.0
    bank_health: float = 0.82
    credit_growth: float = 0.055
    housing_index: float = 100.0
    stock_index: float = 100.0
    consumer_confidence: float = 0.64
    business_confidence: float = 0.62
    inequality: float = 0.34
    poverty: float = 0.105
    emissions: float = 100.0
    energy_security: float = 0.66
    approval: float = 0.56
    political_capital: float = 72.0
    central_bank_credibility: float = 0.74
    corruption: float = 0.12
    external_risk: float = 0.16
    population_m: float = 52.0
    quarter: int = 1
    year: int = 2026
    recession_quarters: int = 0
    last_real_gdp: float = 1000.0
    gdp_growth: float = 0.02
    budget_balance: float = -12.0
    current_account: float = 10.0
    primary_balance: float = -2.0
    micro_consumption_multiplier: float = 1.0
    bubble_risk: float = 0.0
    bond_yield: float = 0.048
    bank_run: bool = False
    active_factory_fire: bool = False
    stock_return: float = 0.0
    inflation_drivers: Dict[str, float] = field(default_factory=dict)
    gdp_drivers: Dict[str, float] = field(default_factory=dict)
    startups: StartupSector = field(default_factory=StartupSector)
    policy: PolicySettings = field(default_factory=PolicySettings)
    impulses: List[LaggedImpulse] = field(default_factory=list)
    news: deque = field(default_factory=lambda: deque(maxlen=8))
    chirps: deque = field(default_factory=lambda: deque(maxlen=6))
    histories: Dict[str, deque] = field(default_factory=dict)

    def __post_init__(self):
        for key in ["gdp", "inflation", "unemployment", "approval", "debt_ratio", "fx", "stock"]:
            self.histories[key] = deque(maxlen=80)
        self.news.appendleft("National cabinet and economic war-room established.")
        self.chirps.appendleft("@market_watcher: Markets watch opening policy statements carefully.")
        self.record_history()

    @property
    def real_gdp(self):
        # C, I, G, X and M are modeled as real volume components. Inflation should not
        # mechanically destroy real GDP just because the price level rises.
        return self.consumption + self.investment + self.government_spending + self.exports - self.imports

    @property
    def nominal_gdp(self):
        return self.real_gdp * max(0.2, self.price_index / 100.0)

    @property
    def output_gap(self):
        return (self.real_gdp - self.potential_gdp) / max(1, self.potential_gdp)

    @property
    def debt_ratio(self):
        return self.debt / max(1, self.nominal_gdp)

    @property
    def real_rate(self):
        return self.policy.policy_rate - self.expected_inflation

    def add_news(self, text):
        self.news.appendleft(text)

    def add_chirp(self, text):
        self.chirps.appendleft(text)

    def add_impulse(self, name, quarters, effects, description, flow_type="Liquidity"):
        effective_quarters = max(2, int(round(quarters * 0.55)))
        self.impulses.append(LaggedImpulse(name, effective_quarters, effective_quarters, effects, description, flow_type))
        self.add_news(description)

    def apply_shock(self, kind):
        if kind == "oil":
            self.add_impulse("Oil Shock", 8, {"inflation": 0.055, "potential": -0.04, "confidence": -0.08, "imports": 0.10, "emissions": 0.04}, "Global oil shock pushes production costs higher.", "Cost-Push")
            self.add_chirp("@fuel_hub: Gas stations raise prices overnight! Logistics margins crushed.")
        elif kind == "financial":
            self.bank_health = clamp(self.bank_health - 0.34, 0.10, 1.0)
            self.stock_index *= 0.72
            self.housing_index *= 0.82
            self.add_impulse("Credit Freeze", 10, {"investment": -0.22, "consumption": -0.09, "unemployment": 0.045, "confidence": -0.16, "credit": -0.16}, "Interbank lending freezes following credit losses.", "Credit Drain")
            self.add_chirp("@fin_insider: Commercial paper market frozen. Cash is king.")
        elif kind == "pandemic":
            self.add_impulse("Pandemic Shock", 10, {
                "consumption": -0.10, "investment": -0.08, "government": 0.045,
                "unemployment": 0.035, "potential": -0.025, "confidence": -0.12,
                "imports": -0.035, "inflation": 0.008
            }, "Pandemic restrictions disrupt labor supply and face-to-face demand.", "Public Health Shock")
            self.add_chirp("@health_watch: Mobility falls as hospitals activate emergency capacity.")
        elif kind == "boom":
            self.add_impulse("Global Boom", 8, {"exports": 0.18, "investment": 0.08, "confidence": 0.08, "inflation": 0.02}, "Global boom: trade orders accelerate.", "External Trade")
            self.add_chirp("@exporter_daily: Ports breaking shipping records this quarter!")
        elif kind == "acid_rain":
            self.add_impulse("Acid Rain Disaster", 6, {"potential": -0.03, "government": 0.025, "confidence": -0.06, "emissions": -0.05}, "High industrial smog precipitates severe acid rain and infrastructure damage.", "Environmental Crisis")
            self.add_chirp("@eco_alert: Acid rain damages crops in the agricultural greenbelt!")
        elif kind == "bubble_burst":
            self.stock_index *= 0.60
            self.housing_index *= 0.70
            self.bank_health = clamp(self.bank_health - 0.25, 0.1, 1.0)
            self.add_impulse("Asset Bubble Collapse", 9, {"investment": -0.20, "consumption": -0.10, "confidence": -0.18, "credit": -0.15}, "Asset bubble pops! Real estate and stock values tumble.", "Wealth Shock")
            self.add_chirp("@trader_jack: Portfolios wiped out! Margin calls everywhere.")

    def enact(self, action: str):
        p = self.policy
        if action == "rate_up":
            p.policy_rate = clamp(p.policy_rate + 0.005, 0.0, 0.25)
            self.add_impulse("Rate Hike +50bp", 8, {"investment": -0.06, "consumption": -0.028, "inflation": -0.018, "fx": -0.03}, "Policy interest rate raised to counter price pressure.", "Monetary Flow")
            self.add_chirp("@central_watch: Central Bank hikes policy rate to preserve real purchasing power.")
        elif action == "rate_down":
            p.policy_rate = clamp(p.policy_rate - 0.005, 0.0, 0.25)
            self.add_impulse("Rate Cut -50bp", 8, {"investment": 0.06, "consumption": 0.028, "inflation": 0.018, "fx": 0.03}, "Policy interest rate cut to stimulate credit growth.", "Liquidity Injection")
            self.add_chirp("@borrowers_club: Cheaper mortgage terms expected as policy rate drops.")
        elif action == "reserve_up":
            p.reserve_requirement = clamp(p.reserve_requirement + 0.02, 0.04, 0.30)
            self.add_impulse("Reserve Tightening", 6, {"credit": -0.08, "investment": -0.04, "inflation": -0.01}, "Bank reserve requirement increased.", "Credit Restraint")
        elif action == "reserve_down":
            p.reserve_requirement = clamp(p.reserve_requirement - 0.02, 0.04, 0.30)
            self.add_impulse("Reserve Easing", 6, {"credit": 0.08, "investment": 0.04, "inflation": 0.012}, "Reserve requirements relaxed to stimulate lending.", "Credit Release")
        elif action == "qe":
            # QE is a central-bank balance-sheet operation, not a direct fiscal windfall.
            self.bond_yield = max(self.policy.policy_rate, self.bond_yield * 0.94)
            if self.inflation > 0.05:
                self.central_bank_credibility = clamp(self.central_bank_credibility - 0.02, 0.2, 1.0)
            self.add_impulse("Quantitative Easing", 8, {"investment": 0.07, "inflation": 0.018, "confidence": 0.045, "credit": 0.10}, "Central bank bond purchases compress long yields and support credit creation.", "Asset Purchases")
            self.add_chirp("@macro_roundup: Central bank balance sheet expands; long-term yields move lower.")
        elif action == "debt_restructure":
            relief = self.debt * 0.22
            self.debt -= relief
            self.bank_health = clamp(self.bank_health - 0.08, 0.1, 1.0)
            self.central_bank_credibility = clamp(self.central_bank_credibility - 0.07, 0.2, 1.0)
            self.approval = clamp(self.approval - 0.04, 0.05, 0.95)
            self.add_impulse("Debt Restructuring", 8, {"confidence": -0.055, "investment": -0.035, "credit": -0.025}, f"Debt exchange reduces face value by ${relief:.0f}B but imposes losses on bondholders.", "Debt Exchange")
        elif action == "imf_bailout":
            self.treasury += 40
            self.debt += 40
            self.policy.welfare_spending = clamp(self.policy.welfare_spending - 0.01, 0.02, 0.20)
            self.policy.income_tax = clamp(self.policy.income_tax + 0.02, 0.05, 0.60)
            self.central_bank_credibility = clamp(self.central_bank_credibility + 0.035, 0.2, 1.0)
            self.approval = clamp(self.approval - 0.08, 0.05, 0.95)
            self.add_impulse("External Stabilization Program", 12, {"government": -0.035, "consumption": -0.025, "confidence": -0.025, "inflation": -0.012, "fx": -0.025}, "Emergency external financing arrives with a negotiated fiscal and monetary stabilization program.", "External Financing")
            self.add_chirp("@macro_roundup: External financing restores reserve buffers, but adjustment conditions tighten near-term policy.")
        elif action == "intel_espionage":
            # Kept under the legacy action id so old UI/save data remains compatible.
            # Gameplay semantics are now a legal strategic technology-acquisition program.
            cost = 8.0
            self.treasury = max(-20.0, self.treasury - cost)
            success = random.random() < clamp(0.58 + 0.25 * self.business_confidence - 0.20 * self.external_risk, 0.35, 0.82)
            if success:
                tech_gain = random.uniform(2.5, 6.5)
                setattr(self, 'technology_index', clamp(getattr(self, 'technology_index', 70) + tech_gain, 40, 100))
                self.add_news(f"Technology Acquisition: licensing and joint ventures lifted technology +{tech_gain:.1f} pts.")
                self.add_chirp("@industry_wire: New licensing deals accelerate domestic semiconductor and robotics capability.")
            else:
                self.external_risk = clamp(self.external_risk + 0.04, 0, 1)
                self.add_news("Technology Acquisition Delayed: negotiations failed and the treasury absorbed due-diligence costs.")
                self.add_chirp("@industry_wire: Strategic technology talks end without an agreement.")
        elif action == "carbon_tax":
            p.carbon_tax = clamp(p.carbon_tax + 0.03, 0.0, 0.25)
            self.add_impulse("Carbon Tax Mandate", 8, {"emissions": -0.16, "revenue": 0.022, "investment": -0.025, "inflation": 0.008}, "Industrial carbon tax implemented.", "Green Levy")
            self.add_chirp("@heavy_industry: Carbon fees force factories to adopt cleaner filters or cut output.")
        elif action == "income_tax_up":
            p.income_tax = clamp(p.income_tax + 0.02, 0.05, 0.60)
            self.add_impulse("Income Tax Rise", 5, {"consumption": -0.035, "inequality": -0.01, "revenue": 0.025}, "Income tax raised +2pp.", "Fiscal Absorption")
        elif action == "income_tax_down":
            p.income_tax = clamp(p.income_tax - 0.02, 0.05, 0.60)
            self.add_impulse("Income Tax Cut", 5, {"consumption": 0.038, "inequality": 0.01, "revenue": -0.025}, "Income tax reduced -2pp.", "Disposable Income")
        elif action == "corp_tax_up":
            p.corporate_tax = clamp(p.corporate_tax + 0.02, 0.05, 0.55)
            self.add_impulse("Corp Tax Rise", 7, {"investment": -0.045, "revenue": 0.022, "inequality": -0.005}, "Corporate tax raised +2pp.", "Corporate Tax")
        elif action == "corp_tax_down":
            p.corporate_tax = clamp(p.corporate_tax - 0.02, 0.05, 0.55)
            self.add_impulse("Corp Tax Cut", 7, {"investment": 0.05, "revenue": -0.022, "inequality": 0.005}, "Corporate tax reduced -2pp.", "Business Relief")
        elif action == "vat_up":
            p.vat = clamp(p.vat + 0.01, 0.0, 0.30)
            self.add_impulse("VAT Increase", 5, {"consumption": -0.018, "revenue": 0.018, "inflation": 0.004}, "VAT increased by 1 percentage point.", "Consumption Tax")
        elif action == "vat_down":
            p.vat = clamp(p.vat - 0.01, 0.0, 0.30)
            self.add_impulse("VAT Relief", 5, {"consumption": 0.020, "revenue": -0.018, "inflation": -0.003}, "VAT reduced by 1 percentage point.", "Consumption Relief")
        elif action == "job_training":
            self.debt += 4
            self.natural_unemployment = clamp(self.natural_unemployment - 0.002, 0.025, 0.09)
            self.add_impulse("National Skills Program", 10, {"potential": 0.018, "productivity": 0.012, "unemployment": -0.008, "government": 0.008}, "Workforce retraining and apprenticeship program launched.", "Labor Reform")
        elif action == "sme_credit":
            self.debt += 4
            self.add_impulse("SME Credit Guarantee", 7, {"investment": 0.032, "credit": 0.045, "unemployment": -0.006, "confidence": 0.015}, "Government guarantees expand credit to small and medium enterprises.", "SME Finance")
        elif action == "stimulus":
            self.debt += 18
            self.add_impulse("Fiscal Stimulus", 7, {"consumption": 0.060, "investment": 0.028, "government": 0.050, "inflation": 0.018, "unemployment": -0.016}, "Temporary deficit-financed fiscal package supports household demand and investment.", "Fiscal Expansion")
        elif action == "austerity":
            self.add_impulse("Fiscal Austerity", 8, {"government": -0.07, "consumption": -0.024, "inflation": -0.012, "unemployment": 0.016, "debt": -0.035}, "Fiscal austerity implemented.", "Fiscal Consolidation")
        elif action == "welfare_up":
            p.welfare_spending = clamp(p.welfare_spending + 0.01, 0.02, 0.20)
            self.add_impulse("Welfare Expansion", 5, {"consumption": 0.03, "inequality": -0.02, "poverty": -0.02, "government": 0.02}, "Social welfare spending expanded.", "Welfare Safety")
        elif action == "infra_up":
            p.infrastructure_spending = clamp(p.infrastructure_spending + 0.01, 0.02, 0.18)
            self.add_impulse("Infrastructure Plan", 12, {"government": 0.025, "investment": 0.03, "potential": 0.04, "unemployment": -0.012}, "Infrastructure modernizations initiated.", "Infrastructure")
        elif action == "education_up":
            p.education_spending = clamp(p.education_spending + 0.01, 0.02, 0.16)
            self.add_impulse("Education Reform", 16, {"government": 0.015, "potential": 0.03, "inequality": -0.015, "productivity": 0.015}, "Education funding approved.", "Human Capital")
        elif action == "health_up":
            p.health_spending = clamp(p.health_spending + 0.01, 0.02, 0.16)
            self.add_impulse("Healthcare Boost", 10, {"government": 0.015, "potential": 0.012, "confidence": 0.02, "poverty": -0.01}, "Public healthcare investments expanded.", "Healthcare")
        elif action == "green_up":
            p.green_spending = clamp(p.green_spending + 0.01, 0.0, 0.14)
            self.add_impulse("Green Transition", 14, {"government": 0.012, "investment": 0.02, "potential": 0.015, "emissions": -0.12, "energy": 0.08}, "Clean power infrastructure funded.", "Green Capital")
        elif action == "min_wage_up":
            p.minimum_wage = clamp(p.minimum_wage + 0.05, 0.65, 1.75)
            effect_u = 0.006 if p.minimum_wage > 1.25 else -0.002
            self.add_impulse("Minimum Wage", 5, {"consumption": 0.016, "inequality": -0.012, "inflation": 0.008, "unemployment": effect_u}, "Minimum wage increased +5%.", "Wage Push")
        elif action == "tariff_up":
            p.tariff_rate = clamp(p.tariff_rate + 0.025, 0, 0.50)
            self.add_impulse("Import Tariffs", 6, {"imports": -0.07, "inflation": 0.012, "exports": -0.02, "revenue": 0.008}, "Import tariff increased +2.5%.", "Protectionism")
            if hasattr(self, 'rival'):
                self.rival.enact_retaliatory_tariff(self)
        elif action == "tariff_down":
            p.tariff_rate = clamp(p.tariff_rate - 0.025, 0, 0.50)
            self.add_impulse("Tariff Relief", 6, {"imports": 0.07, "inflation": -0.009, "exports": 0.015, "revenue": -0.006}, "Import tariffs eased.", "Open Trade")
        elif action == "export_support":
            p.export_subsidy = clamp(p.export_subsidy + 0.01, 0, 0.15)
            self.add_impulse("Export Credit", 8, {"exports": 0.08, "government": 0.01, "investment": 0.015}, "Export subsidy expanded.", "Export Liquidity")
        elif action == "devalue":
            self.exchange_rate *= 1.06
            self.add_impulse("FX Devaluation", 7, {"exports": 0.065, "imports": -0.05, "inflation": 0.024}, "Currency devalued by 6%.", "FX Competitiveness")
        elif action == "support_fx":
            if self.treasury >= 5:
                self.treasury -= 5
                self.exchange_rate *= 0.965
                self.add_impulse("FX Defense", 5, {"inflation": -0.009, "confidence": 0.015}, "Reserves utilized for currency stabilization.", "FX Reserves")
        elif action == "capital_controls":
            p.capital_controls = clamp(p.capital_controls + 0.15, 0, 0.9)
            self.add_impulse("Capital Controls", 6, {"fx": -0.02, "investment": -0.02, "confidence": -0.02}, "Cross-border capital restrictions tightened.", "Capital Barrier")
        elif action == "bank_recap":
            self.debt += 12
            self.bank_health = clamp(self.bank_health + 0.25, 0, 1)
            self.add_impulse("Bank Recapitalization", 6, {"credit": 0.10, "investment": 0.03, "confidence": 0.03}, "State bank recapitalization.", "Solvency Support")
        elif action == "anti_corruption":
            cost = 5.0
            self.debt += cost
            self.corruption = clamp(self.corruption - 0.03, 0.01, 0.6)
            self.add_impulse("Governance Reform", 12, {"potential": 0.02, "revenue": 0.012, "confidence": 0.025}, "Institutional governance reform enacted.", "Structural Efficiency")

    def _collect_impulses(self):
        total = {k: 0.0 for k in ["consumption", "investment", "government", "exports", "imports", "inflation",
                                  "unemployment", "potential", "confidence", "credit", "fx", "inequality",
                                  "poverty", "revenue", "debt", "emissions", "energy", "productivity"]}
        alive = []
        for impulse in self.impulses:
            eff = impulse.step()
            if eff:
                for k, v in eff.items():
                    total[k] = total.get(k, 0.0) + v
            if impulse.remaining > 0:
                alive.append(impulse)
        self.impulses = alive
        return total

    def step_quarter(self):
        p = self.policy
        e = self._collect_impulses()
        prev_components = {
            "Consumption": self.consumption, "Investment": self.investment,
            "Government": self.government_spending, "Exports": self.exports, "Imports": self.imports
        }
        prev_fx = self.exchange_rate
        prev_stock = self.stock_index

        # بازدهی اوراق قرضه بر اساس ریسک بدهی
        sovereign_risk_spread = max(0.0, (self.debt_ratio - 0.75) * 0.045)
        self.bond_yield = clamp(p.policy_rate + 0.018 + sovereign_risk_spread, 0.01, 0.22)

        # بحران نقدینگی و هجوم بانکی
        if self.bank_health < 0.40 and not self.bank_run:
            self.bank_run = True
            self.add_news("Bank Run Alert: Depositors queuing at commercial banks to withdraw savings!")
            self.add_chirp("@city_watch: Panic outside downtown commercial bank branch! ATMs out of cash.")
        elif self.bank_health >= 0.55:
            self.bank_run = False

        # آتش‌سوزی تصادفی در تأسیسات صنعتی
        if random.random() < 0.06 and not self.active_factory_fire:
            self.active_factory_fire = True
            self.add_news("Emergency: Industrial fire reported at production facilities!")
            self.add_chirp("@fire_patrol: Four-alarm blaze near manufacturing plants. Fire brigades dispatched.")
        elif self.active_factory_fire and random.random() < 0.65:
            self.active_factory_fire = False

        # فجایع اقلیمی بر اثر آلایندگی
        if self.emissions > 125.0 and random.random() < 0.16:
            self.apply_shock("acid_rain")

        # ارزیابی ریسک حباب دارایی
        if self.stock_index > 230 or self.housing_index > 200:
            self.bubble_risk = clamp(self.bubble_risk + 0.16, 0, 1.0)
            if self.bubble_risk > 0.60 and random.random() < 0.28:
                self.apply_shock("bubble_burst")
                self.bubble_risk = 0.0
        else:
            self.bubble_risk = clamp(self.bubble_risk - 0.06, 0, 1.0)

        # چرخه‌های اقتصادی و تمایلات
        cycle_shock = random.uniform(-0.012, 0.012)
        inflation_miss = abs(self.inflation - 0.025)
        confidence_anchor = 0.70 - 1.1 * inflation_miss - 0.85 * max(0, self.unemployment - 0.045) \
                            - 0.16 * max(0, self.debt_ratio - 0.85) + 0.12 * self.bank_health - 0.18 * self.corruption
        self.consumer_confidence = clamp(0.80 * self.consumer_confidence + 0.20 * confidence_anchor + e["confidence"], 0.15, 0.95)
        self.business_confidence = clamp(0.78 * self.business_confidence + 0.22 * (confidence_anchor + 0.08 - 0.7 * max(0, self.real_rate - 0.025)) + e["confidence"] * 0.8, 0.12, 0.95)

        target_credit = 0.07 + 0.18 * (self.bank_health - 0.7) - 0.85 * self.real_rate - 0.30 * (p.reserve_requirement - 0.10)
        self.credit_growth = clamp(0.70 * self.credit_growth + 0.30 * target_credit + e["credit"], -0.18, 0.28)

        scale_ratio = max(0.75, self.potential_gdp / 1000.0)
        disposable_factor = 1.0 - 0.30 * (p.income_tax - 0.22) - 0.18 * (p.vat - 0.10)
        c_target = 620 * scale_ratio * disposable_factor * (0.75 + 0.45 * self.consumer_confidence) * (1 - 1.1 * max(-0.04, self.real_rate))
        c_target *= (1 + e["consumption"] + cycle_shock) * self.micro_consumption_multiplier
        self.consumption = max(350, lerp(self.consumption, c_target, 0.22))

        invest_tax_factor = 1.0 - 0.55 * (p.corporate_tax - 0.21) - 0.35 * p.carbon_tax
        i_target = 185 * scale_ratio * invest_tax_factor * (0.68 + 0.56 * self.business_confidence) * (1 + 1.35 * self.credit_growth)
        i_target *= (1 - 2.2 * max(0, self.real_rate - 0.01)) * (1 + e["investment"])
        self.investment = max(55, lerp(self.investment, i_target, 0.20))

        fiscal_share = p.welfare_spending + p.health_spending + p.education_spending + p.infrastructure_spending + p.defense_spending + p.green_spending
        g_target = (105 + 260 * fiscal_share) * scale_ratio
        self.government_spending = max(110, lerp(self.government_spending, g_target * (1 + e["government"]), 0.22))

        competitiveness = (self.exchange_rate ** 0.35) * (1 + p.export_subsidy * 0.9)
        x_target = 115 * scale_ratio * competitiveness * (1 - 0.40 * p.tariff_rate) * (1 + e["exports"])
        m_target = 105 * scale_ratio * (1.0 / max(0.65, self.exchange_rate) ** 0.28) * (1 - 0.50 * p.tariff_rate) * (self.consumption / (620 * scale_ratio)) ** 0.35
        m_target *= (1 + e["imports"])
        self.exports = max(45, lerp(self.exports, x_target, 0.20))
        self.imports = max(40, lerp(self.imports, m_target, 0.20))

        structural_growth = self.productivity_growth / 4 + 0.0012 * (p.infrastructure_spending / 0.055 - 1) + 0.0007 * (p.education_spending / 0.06 - 1)
        structural_growth += e["potential"] / 8 + e["productivity"] / 8
        self.potential_gdp *= 1 + clamp(structural_growth, -0.02, 0.025)

        gdp_now = self.real_gdp
        gap = self.output_gap
        # Inflation pass-through depends on the CHANGE in the exchange rate, not its level.
        fx_change = self.exchange_rate / max(0.05, self.previous_exchange_rate) - 1.0
        fx_inflation = 0.14 * fx_change
        wage_pressure = 0.25 * max(-0.02, self.wage_growth - self.productivity_growth)
        noise = random.uniform(-0.003, 0.004)
        inflation_parts_q = {
            "Expectations": 0.52 * (self.expected_inflation / 4),
            "Demand gap": 0.035 * gap,
            "Exchange rate": fx_inflation,
            "Wages": wage_pressure / 4,
            "Credit": 0.06 * (self.credit_growth / 4),
            "Policy / shocks": e["inflation"] / 4,
            "Other": noise,
        }
        quarterly_infl = clamp(sum(inflation_parts_q.values()), -0.03, 0.08)
        # Annualized contribution displayed to the player; sum approximately explains headline inflation.
        self.inflation_drivers = {k: v * 4 for k, v in inflation_parts_q.items()}
        self.previous_price_index = self.price_index
        self.price_index *= 1 + quarterly_infl
        self.inflation = clamp((self.price_index / max(1, self.previous_price_index) - 1) * 4, -0.08, 0.35)
        
        credibility_pull = self.central_bank_credibility * 0.18
        self.expected_inflation = clamp((1 - credibility_pull) * self.expected_inflation + credibility_pull * 0.025 + 0.25 * (self.inflation - self.expected_inflation), -0.04, 0.30)

        growth = (gdp_now / max(1, self.last_real_gdp) - 1) * 4
        self.gdp_growth = clamp(growth, -0.28, 0.32)
        growth_den = max(1.0, self.last_real_gdp)
        self.gdp_drivers = {
            "Consumption": 4 * (self.consumption - prev_components["Consumption"]) / growth_den,
            "Investment": 4 * (self.investment - prev_components["Investment"]) / growth_den,
            "Government": 4 * (self.government_spending - prev_components["Government"]) / growth_den,
            "Exports": 4 * (self.exports - prev_components["Exports"]) / growth_den,
            "Imports": -4 * (self.imports - prev_components["Imports"]) / growth_den,
        }
        okun_change = -0.15 * (self.gdp_growth - 0.02) / 4
        self.unemployment = clamp(self.unemployment + okun_change + e["unemployment"] / 4 + 0.08 * (self.natural_unemployment - self.unemployment), 0.02, 0.25)
        
        self.wage_growth = clamp(0.016 + 0.05 * max(0, 0.060 - self.unemployment) + 0.45 * self.expected_inflation, -0.02, 0.18)
        self.nominal_wage_index *= 1 + self.wage_growth / 4

        taxable_income = self.nominal_gdp * 0.58
        corporate_base = max(0, self.nominal_gdp * 0.16)
        price_level = max(0.2, self.price_index / 100.0)
        consumption_base = self.consumption * price_level * 0.74
        carbon_revenue = self.emissions * p.carbon_tax * 0.42
        revenue = p.income_tax * taxable_income + p.corporate_tax * corporate_base + p.vat * consumption_base + p.tariff_rate * (self.imports * price_level) * 0.40 + carbon_revenue
        revenue *= (1 - self.corruption * 0.30) * (1 + e["revenue"])
        interest_bill = self.debt * self.bond_yield
        annual_spending = self.government_spending * price_level + interest_bill
        self.budget_balance = revenue - annual_spending
        self.primary_balance = revenue - self.government_spending * price_level
        
        self.debt = max(100, self.debt - self.budget_balance / 4)
        if e["debt"] != 0:
            self.debt *= max(0.5, 1 + e["debt"] / 4)
        self.treasury = clamp(self.treasury + self.budget_balance / 16, -20, 150)

        self.current_account = self.exports - self.imports
        debt_fx_pressure = max(0, self.debt_ratio - 0.90) * 0.012
        ca_support = clamp(self.current_account / max(1, self.nominal_gdp), -0.08, 0.08) * 0.08
        rate_support = clamp(self.real_rate - 0.01, -0.05, 0.10) * 0.10
        flow_pressure = debt_fx_pressure - ca_support - rate_support - p.capital_controls * 0.002
        self.exchange_rate = clamp(self.exchange_rate * (1 + flow_pressure + e["fx"] / 4 + random.uniform(-0.004, 0.004)), 0.65, 2.8)
        self.previous_exchange_rate = prev_fx

        self.stock_index = clamp(self.stock_index * (1 + self.gdp_growth / 12 - 0.60 * max(0, self.real_rate) / 4 + random.uniform(-0.015, 0.015)), 35, 450)
        self.stock_return = self.stock_index / max(1.0, prev_stock) - 1.0
        self.housing_index = clamp(self.housing_index * (1 + self.credit_growth / 8 - 0.45 * max(0, self.real_rate) / 4), 50, 350)
        bank_target = 0.85 - 0.85 * max(0, self.unemployment - 0.065) - 0.75 * max(0, -self.credit_growth - 0.04)
        self.bank_health = clamp(0.90 * self.bank_health + 0.10 * bank_target, 0.15, 0.98)

        self.inequality = clamp(self.inequality + 0.007 * max(0, self.unemployment - 0.05) - 0.010 * (p.welfare_spending / 0.08 - 1) + e["inequality"] / 4, 0.20, 0.60)
        self.poverty = clamp(self.poverty + 0.09 * (self.unemployment - 0.05) + 0.04 * max(0, self.inflation - 0.045) - 0.04 * (p.welfare_spending / 0.08 - 1) + e["poverty"] / 4, 0.02, 0.38)
        self.emissions = clamp(self.emissions * (1 + self.gdp_growth / 30) * (1 - p.green_spending * 0.018 - p.carbon_tax * 0.08) * (1 + e["emissions"] / 4), 30, 180)
        self.energy_security = clamp(self.energy_security + 0.003 * (p.green_spending / 0.025 - 1) + e["energy"] / 4, 0.25, 0.98)

        real_wage_growth = self.wage_growth - self.inflation
        approval_target = 0.58 + 0.55 * self.gdp_growth - 1.25 * (self.unemployment - 0.05) - 0.65 * max(0, self.inflation - 0.025)
        approval_target += 0.35 * real_wage_growth - 0.28 * (self.inequality - 0.33) - 0.20 * self.corruption - 0.08 * max(0, self.debt_ratio - 0.9)
        self.approval = clamp(0.85 * self.approval + 0.15 * approval_target, 0.08, 0.94)
        self.political_capital = clamp(self.political_capital + (self.approval - 0.50) * 3.5, 0, 100)

        self.startups.step(self.credit_growth, self.gdp_growth, getattr(self, 'technology_index', 70))

        if self.gdp_growth < 0: self.recession_quarters += 1
        else: self.recession_quarters = 0

        if abs(self.inflation - 0.025) > 0.045:
            self.central_bank_credibility = clamp(self.central_bank_credibility - 0.008, 0.2, 0.95)
        else:
            self.central_bank_credibility = clamp(self.central_bank_credibility + 0.003, 0.2, 0.95)

        self.last_real_gdp = gdp_now
        self.advance_calendar()
        self.record_history()
        self.generate_periodic_news()

    def advance_calendar(self):
        self.quarter += 1
        if self.quarter > 4:
            self.quarter = 1
            self.year += 1

    def record_history(self):
        self.histories["gdp"].append(self.real_gdp)
        self.histories["inflation"].append(self.inflation * 100)
        self.histories["unemployment"].append(self.unemployment * 100)
        self.histories["approval"].append(self.approval * 100)
        self.histories["debt_ratio"].append(self.debt_ratio * 100)
        self.histories["fx"].append(self.exchange_rate)
        self.histories["stock"].append(self.stock_index)

    def generate_periodic_news(self):
        if self.recession_quarters >= 2:
            self.add_news("Technical recession confirmed as real activity contracts.")
        elif self.inflation > 0.08:
            self.add_news("Severe cost-of-living squeeze reported across households.")
        elif self.bubble_risk > 0.5:
            self.add_news("Asset price warning: Regulators detect speculative exuberance.")
        if self.debt_ratio > 1.20:
            self.add_news("Fiscal alarm: Debt-to-GDP crosses 120%; debt servicing rises.")
        if self.bank_health < 0.45:
            self.add_news("Banking fragility: Credit losses rise; lending curtailed.")

ACTION_TAB = {
    'rate_up':'Monetary','rate_down':'Monetary','reserve_up':'Monetary','reserve_down':'Monetary','bank_recap':'Monetary','support_fx':'Monetary','qe':'Monetary','debt_restructure':'Monetary','macroprudential_up':'Monetary',
    'income_tax_up':'Fiscal','income_tax_down':'Fiscal','corp_tax_up':'Fiscal','corp_tax_down':'Fiscal','stimulus':'Fiscal','austerity':'Fiscal','welfare_up':'Fiscal','min_wage_up':'Fiscal','vat_up':'Fiscal','vat_down':'Fiscal','wealth_tax_up':'Fiscal','payroll_tax_cut':'Fiscal',
    'infra_up':'Structural','education_up':'Structural','health_up':'Structural','green_up':'Structural','carbon_tax':'Structural','housing_support':'Structural','public_transport':'Structural','research_grant':'Structural','job_training':'Structural','sme_credit':'Structural','mortgage_tighten':'Structural','business_reform':'Structural','childcare_support':'Structural',
    'tariff_up':'Trade','tariff_down':'Trade','export_support':'Trade','devalue':'Trade','capital_controls':'Trade','port_upgrade':'Trade','sanction_relief':'Trade','intel_espionage':'Trade','fdi_incentives':'Trade','anti_corruption':'Trade',
    'food_subsidy':'Emergency','energy_subsidy':'Emergency','food_reserve':'Emergency','security_package':'Emergency','imf_bailout':'Emergency'
}
ACTION_LABEL = {
    'rate_up':'Raise policy rate +50bp','rate_down':'Cut policy rate -50bp','reserve_up':'Raise reserve requirement','reserve_down':'Lower reserve requirement',
    'bank_recap':'Recapitalize banks','support_fx':'Support the currency','qe':'Quantitative Easing (QE)','debt_restructure':'Debt Restructuring / Relief',
    'infra_up':'Increase infrastructure spending','education_up':'Increase education spending',
    'health_up':'Increase health spending','welfare_up':'Increase targeted welfare','anti_corruption':'Governance / anti-corruption reform','austerity':'Gradual fiscal consolidation',
    'export_support':'Export finance/support','port_upgrade':'Upgrade port/logistics','sanction_relief':'Pursue sanctions relief','food_subsidy':'Target food subsidy',
    'security_package':'Emergency security package','stimulus':'Temporary fiscal stimulus','min_wage_up':'Raise minimum wage carefully','housing_support':'Targeted housing support',
    'public_transport':'Public transport investment','research_grant':'Research & innovation grants','imf_bailout':'External Stabilization Program','intel_espionage':'Strategic Technology Acquisition',
    'carbon_tax':'Carbon Tax Mandate','vat_up':'VAT +1pp','vat_down':'VAT -1pp','job_training':'National Skills Program','sme_credit':'SME Credit Guarantee',
    'energy_subsidy':'Targeted Energy Relief','macroprudential_up':'Tighten Macroprudential Rules','mortgage_tighten':'Tighten Mortgage Standards',
    'wealth_tax_up':'Temporary Wealth Surcharge','payroll_tax_cut':'Employer Payroll Tax Cut','fdi_incentives':'FDI Incentives',
    'business_reform':'Business Climate Reform','food_reserve':'Strategic Food Reserve','childcare_support':'Childcare & Labor Participation'
}

def advisor_route(action):
    return ACTION_TAB.get(action,'Advisor'), ACTION_LABEL.get(action,action.replace('_',' ').title())

class Advisor:
    """State-aware decision support rather than a fixed opening script."""

    def analyze(self, e: Economy):
        items = []
        def add(sev, title, diagnosis, policy, tradeoff, confidence, actions=()):
            items.append((sev, title, diagnosis, policy, tradeoff, confidence, tuple(actions)))

        gap = e.output_gap
        fx_stress = e.exchange_rate > 1.18 or getattr(e, 'trade_disruption', 0) > .25
        recession = e.gdp_growth < -.005 or gap < -.025
        jobs_stress = e.unemployment > .075
        inflation_high = e.inflation > .055
        inflation_very_high = e.inflation > .085
        deflation = e.inflation < .010 and e.gdp_growth < .015
        debt_stress = e.debt_ratio > 1.0
        bank_stress = e.bank_health < .58
        housing_stress = getattr(getattr(e, 'housing', None), 'affordability', 1.0) < .55
        sanctions = getattr(e, 'sanction_level', 0) > .22
        poverty_stress = e.poverty > .15
        bubble = getattr(e, 'bubble_risk', 0) > .35 or e.housing_index > 165
        green_stress = e.emissions > 125
        weak_productivity = getattr(e, 'technology_index', 70) < 68 or getattr(e, 'productivity_level', 1.0) < .96

        impulse_names = [getattr(imp,'name','').lower() for imp in getattr(e,'impulses',()) if getattr(imp,'remaining',0) > 0]
        fiscal_expansion = any(any(k in name for k in ('stimulus','infrastructure','welfare','housing supply','transit expansion')) for name in impulse_names)
        monetary_tightening = any(any(k in name for k in ('rate hike','reserve requirement increase','macroprudential tightening')) for name in impulse_names)
        fiscal_tightening = any(any(k in name for k in ('austerity','income tax increase','vat increase')) for name in impulse_names)
        monetary_easing = any(any(k in name for k in ('rate cut','quantitative easing','reserve requirement decrease')) for name in impulse_names)
        if fiscal_expansion and monetary_tightening:
            add(2, 'Policy Mix Tension',
                'Fiscal demand support is arriving while monetary/credit policy is tightening. The two levers are partly offsetting each other.',
                'Decide which objective has priority. Keep fiscal measures targeted to supply capacity if disinflation is the main goal.',
                'Conflicting tools consume policy capacity and can produce higher debt with less growth.', .96,
                ('infra_up','macroprudential_up','anti_corruption'))
        elif fiscal_tightening and monetary_easing:
            add(2, 'Policy Mix Tension',
                'Fiscal consolidation and monetary easing are pulling demand in opposite directions.',
                'Use the mix deliberately: easing can cushion consolidation, but avoid repeatedly reversing the stance each quarter.',
                'Rapid policy reversals reduce predictability and can weaken confidence.', .92,
                ('business_reform','sme_credit','anti_corruption'))

        # Diagnose inflation by likely channel so advice is not always "raise rates".
        if inflation_high:
            supply_like = gap <= .01 or getattr(e, 'trade_disruption', 0) > .15 or e.exchange_rate > 1.12
            if supply_like:
                acts = ['port_upgrade', 'energy_subsidy', 'support_fx', 'rate_up']
                add(3 if inflation_very_high else 2, 'Supply / FX Inflation',
                    'Inflation is high without clear demand overheating. External costs, logistics or the currency are likely important.',
                    'Relieve supply bottlenecks and FX stress first; use monetary tightening carefully if expectations remain unanchored.',
                    'Subsidies and FX defense consume fiscal/reserve buffers; aggressive rate hikes can deepen weak growth.', .93, acts)
            else:
                add(3 if inflation_very_high else 2, 'Demand Overheating',
                    'Demand is running ahead of productive capacity and price pressure is broadening.',
                    'Tighten monetary and credit conditions; avoid broad untargeted stimulus until inflation expectations cool.',
                    'Disinflation can temporarily weaken investment, housing and employment.', .94,
                    ('rate_up','reserve_up','macroprudential_up','austerity'))

        if recession or jobs_stress:
            acts = ['sme_credit','job_training','infra_up']
            if e.inflation < .05:
                acts = ['rate_down','sme_credit','infra_up','payroll_tax_cut','stimulus']
            add(3 if e.gdp_growth < -.025 or e.unemployment > .10 else 2, 'Growth & Jobs Weakness',
                'Output or employment is weak enough to threaten household incomes and business balance sheets.',
                'Use targeted credit, hiring support and supply-enhancing investment; add broad stimulus only when inflation allows it.',
                'Demand support can lift inflation and debt if maintained after the recovery begins.', .91, acts)

        if bank_stress:
            add(3 if e.bank_health < .42 else 2, 'Financial Stability Risk',
                'Bank balance sheets are weak and credit transmission may fail even if headline interest rates are reduced.',
                'Restore solvency first, then normalize liquidity. Tighten speculative lending only after the system is stable.',
                'Recapitalization can raise public debt and create moral-hazard concerns.', .94,
                ('bank_recap','reserve_down','sme_credit','macroprudential_up'))

        if fx_stress:
            add(2, 'External / Currency Pressure',
                'The currency or trade channel is amplifying domestic instability.',
                'Combine temporary FX defense with export/logistics measures and, where relevant, sanctions diplomacy.',
                'Reserve defense cannot permanently offset weak fundamentals.', .88,
                ('support_fx','export_support','port_upgrade','sanction_relief','rate_up'))

        if debt_stress:
            add(3 if e.debt_ratio > 1.25 else 2, 'Fiscal Sustainability Risk',
                'Debt service is reducing future policy space and can lift sovereign borrowing costs.',
                'Improve revenue quality and governance before relying on abrupt austerity; consolidate faster when growth is healthy.',
                'Too much consolidation during recession can shrink GDP and worsen the debt ratio initially.', .92,
                ('anti_corruption','vat_up','wealth_tax_up','austerity','debt_restructure'))

        if housing_stress:
            acts = ['housing_support','infra_up','mortgage_tighten'] if bubble else ['housing_support','infra_up','public_transport']
            add(2, 'Housing Affordability',
                'Housing costs are becoming disconnected from household purchasing power.',
                'Expand supply and infrastructure; if credit speculation is driving prices, tighten mortgage standards.',
                'Demand subsidies without new supply can make housing even more expensive.', .90, acts)

        if sanctions:
            add(2, 'Sanctions & Trade Friction',
                'External restrictions are damaging trade, investment and the currency channel.',
                'Pursue diplomatic relief while improving logistics, reserves and alternative investment channels.',
                'Trade adaptation is gradual and may not fully replace lost external markets.', .90,
                ('sanction_relief','port_upgrade','food_reserve','fdi_incentives','support_fx'))

        if poverty_stress:
            add(2, 'Household Cost Pressure',
                'Poverty is elevated and vulnerable households are absorbing a disproportionate share of the adjustment.',
                'Use targeted food/energy relief and employment programs instead of a permanent blanket subsidy.',
                'Poorly targeted transfers raise fiscal costs and can preserve inefficient prices.', .88,
                ('food_subsidy','energy_subsidy','welfare_up','job_training','childcare_support'))

        if bubble:
            add(2, 'Asset / Housing Bubble Risk',
                'Asset prices and leverage are creating financial-stability risk even if headline GDP looks strong.',
                'Use macroprudential and mortgage tools before relying exclusively on economy-wide interest-rate hikes.',
                'Credit controls can cool construction and asset markets quickly.', .89,
                ('macroprudential_up','mortgage_tighten','reserve_up','rate_up'))

        if green_stress:
            add(1, 'Energy & Emissions Transition',
                'High emissions increase long-run environmental and energy-security risks.',
                'Sequence clean infrastructure, public transport and carbon pricing with innovation support.',
                'Carbon pricing can temporarily increase industrial costs.', .80,
                ('green_up','public_transport','research_grant','carbon_tax'))

        if weak_productivity:
            add(1, 'Productivity / Investment Gap',
                'The economy needs stronger productivity and private investment rather than only short-run demand management.',
                'Improve the business climate, skills, R&D and FDI conditions.',
                'Structural reforms mature slowly and some incumbents will resist them.', .82,
                ('business_reform','research_grant','job_training','fdi_incentives','education_up'))

        if deflation:
            add(3, 'Deflationary Slump',
                'Inflation and growth are too low, raising real debt burdens and discouraging investment.',
                'Ease rates and credit, then use temporary fiscal support while demand recovers.',
                'Exit stimulus as inflation expectations normalize.', .93,
                ('rate_down','qe','sme_credit','stimulus','infra_up'))

        if not items:
            add(1, 'Economy Near Balance',
                'No single emergency dominates the dashboard. This is a chance to choose your own development strategy.',
                'Pick a medium-term priority: productivity, exports, housing, resilience, green transition or fiscal buffers.',
                'Structural policies take time and should fit your chosen strategy rather than being stacked indiscriminately.', .78,
                ('business_reform','fdi_incentives','housing_support','green_up','anti_corruption'))

        items.sort(key=lambda x: (x[0], x[5]), reverse=True)
        return items[:6]

    def action_plan(self, e, limit=6):
        plan, seen = [], set()
        for sev, title, diag, policy, trade, conf, actions in self.analyze(e):
            for rank, action in enumerate(actions):
                if action in seen:
                    continue
                seen.add(action)
                allowed, reason = e.can_enact(action) if hasattr(e, 'can_enact') else (True, 'Ready')
                if not allowed:
                    continue
                timing = 'NOW' if sev >= 3 and rank == 0 else ('NEXT' if rank <= 1 else 'OPTION')
                tab, label = advisor_route(action)
                plan.append({'timing': timing, 'action': action, 'tab': tab, 'label': label,
                             'problem': title, 'why': diag, 'watch': self._watch_for(action),
                             'confidence': conf, 'severity': sev})
                if len(plan) >= limit:
                    return plan
        return plan

    def _watch_for(self, action):
        if action in {'rate_up','rate_down','reserve_up','reserve_down','qe','macroprudential_up'}:
            return 'Inflation, credit growth, unemployment, bank health'
        if action in {'support_fx','devalue','capital_controls','sanction_relief'}:
            return 'FX, reserves, inflation, current account'
        if action in {'housing_support','mortgage_tighten','public_transport'}:
            return 'Housing affordability, construction, credit, rents'
        if action in {'austerity','vat_up','wealth_tax_up','income_tax_up','anti_corruption'}:
            return 'Debt/GDP, primary balance, growth, approval'
        if action in {'job_training','sme_credit','payroll_tax_cut','childcare_support'}:
            return 'Unemployment, business confidence, wage growth'
        return 'GDP, inflation, unemployment, debt/GDP'

    def mission_coach(self, e):
        """Return a UI-ready coaching brief with one obvious next move.

        Mission mode delegates to the active mission. Sandbox mode turns the highest
        priority macro diagnosis into a navigable response plan. The coach never forces
        the player to enact a policy: it tells them where to go, why, what to watch and
        what alternatives are available.
        """
        if getattr(e, 'game_mode', 'mission') == 'mission' and hasattr(e, 'missions'):
            guide = e.missions.guidance(e)
            if guide.get('steps') or guide.get('kind') in {'free_window', 'sandbox'}:
                return guide

        diagnoses = self.analyze(e)
        plan = self.action_plan(e, 6)
        steps = []
        for p in plan:
            allowed, blocked = e.can_enact(p['action']) if hasattr(e, 'can_enact') else (True, 'Ready')
            steps.append({
                'timing': p['timing'], 'action': p['action'], 'tab': p['tab'], 'label': p['label'],
                'reason': p['problem'], 'detail': p['why'], 'watch': p['watch'],
                'ready': allowed, 'blocked_reason': '' if allowed else blocked,
                'navigation': f"Open {p['tab']} -> {p['label']}",
                'after': 'Advance one quarter and check the listed indicators before stacking another major move.'
            })
        primary = next((x for x in steps if x['ready']), steps[0] if steps else None)
        top = diagnoses[0]
        return {
            'kind': 'advisor',
            'title': 'Advisor Response Plan',
            'status': top[1],
            'diagnosis': top[2],
            'explain': top[3],
            'tradeoff': top[4],
            'steps': steps[:5],
            'primary': primary,
            'avoid': (),
            'targets': [],
            'reassess': 'Advance one quarter after the main intervention and reassess transmission effects.'
        }

    def playbook(self, e):
        out = []
        for p in self.action_plan(e, 4):
            out.append((f"{p['timing']} • {p['tab']}", p['label'], p['problem'], p['watch'], 'Reassess in 1 quarter'))
        return out

    def scenario_forecasts(self, e):
        # The UI can call this every frame; cache expensive deep-copy simulations until
        # the quarter or policy state changes.
        cache_key = (e.year, e.quarter, len(getattr(e, 'decision_log', ())),
                     round(e.inflation, 4), round(e.gdp_growth, 4), round(e.debt_ratio, 4),
                     getattr(e, 'game_mode', 'mission'))
        if getattr(self, '_forecast_cache_key', None) == cache_key:
            return self._forecast_cache
        base = self.action_plan(e, 6)
        strategies = {
            'ADVISOR': [p['action'] for p in base[:3]],
            'STABILITY': ['rate_up','anti_corruption','support_fx'],
            'GROWTH': ['sme_credit','infra_up','job_training'],
        }
        out = []; state = random.getstate()
        try:
            random.seed(417)
            for name, actions in strategies.items():
                sim = copy.deepcopy(e)
                if hasattr(sim, 'policy_capacity'):
                    sim.policy_capacity = sim.max_policy_capacity
                    sim.political_capital = 100
                    sim.action_cooldowns = {}
                    sim.package_cooldowns = {}
                    sim.game_status = 'RUNNING'
                for a in actions:
                    try: sim.enact(a)
                    except Exception: pass
                path=[]
                for _ in range(4):
                    sim.step_quarter(); path.append((sim.gdp_growth,sim.inflation,sim.unemployment,sim.debt_ratio))
                final=path[-1]
                risk='LOW' if abs(final[1]-.025)<.03 and final[3]<1.05 else 'HIGH' if final[3]>1.30 or final[1]>.10 else 'MEDIUM'
                out.append((name,actions,final,risk))
        finally:
            random.setstate(state)
        self._forecast_cache_key = cache_key
        self._forecast_cache = out
        return out

    def perspectives(self, e):
        """Return three deliberately different policy lenses.

        These are not three 'answers'. Each desk optimizes a different objective so
        the player sees the trade-off before deciding.
        """
        inflation_gap = e.inflation - .025
        jobs_gap = e.unemployment - .055
        debt_gap = e.debt_ratio - .75
        affordability = getattr(getattr(e, 'housing', None), 'affordability', .75)

        # Central bank desk: price stability + banking/FX transmission.
        if e.bank_health < .52:
            cb_action, cb_stance = 'bank_recap', 'Stabilize the banking system before relying on rate changes.'
        elif inflation_gap > .03 and e.output_gap > .005:
            cb_action, cb_stance = 'rate_up', 'Demand pressure is broad enough to justify tighter monetary conditions.'
        elif inflation_gap > .03 and (e.exchange_rate > 1.12 or e.trade_disruption > .15):
            cb_action, cb_stance = 'support_fx', 'Inflation looks partly external; defend transmission and avoid over-tightening domestic demand.'
        elif e.inflation < .012 and e.gdp_growth < .015:
            cb_action, cb_stance = 'rate_down', 'Real rates are restrictive for a weak, low-inflation economy.'
        else:
            cb_action, cb_stance = 'macroprudential_up', 'Headline policy can stay near neutral; target leverage and financial excess instead.'

        # Treasury desk: employment, household demand, debt sustainability.
        if debt_gap > .35:
            tr_action, tr_stance = 'anti_corruption', 'Fiscal space is tight. Improve revenue quality and leakages before a large demand package.'
        elif jobs_gap > .025 and e.inflation < .055:
            tr_action, tr_stance = 'payroll_tax_cut', 'Hiring support is preferable to a permanent spending expansion while unemployment is elevated.'
        elif e.poverty > .15:
            tr_action, tr_stance = 'welfare_up', 'Protect household purchasing power with targeted support rather than blanket stimulus.'
        else:
            tr_action, tr_stance = 'infra_up', 'Use available fiscal space for capacity-enhancing investment rather than pure consumption support.'

        # Development desk: productivity, housing, trade and long-run capacity.
        if affordability < .55:
            dev_action, dev_stance = 'housing_support', 'Housing supply and infrastructure are constraining household welfare and labor mobility.'
        elif getattr(e, 'technology_index', 70) < 70:
            dev_action, dev_stance = 'research_grant', 'Weak technology diffusion is limiting potential growth.'
        elif e.exports < e.imports or e.trade_disruption > .12:
            dev_action, dev_stance = 'port_upgrade', 'Logistics and export capacity offer a cleaner growth path than another demand boost.'
        else:
            dev_action, dev_stance = 'business_reform', 'The economy is stable enough to spend political capital on productivity reforms.'

        def desk(name, priority, action, stance):
            tab, label = advisor_route(action)
            allowed, reason = e.can_enact(action) if hasattr(e, 'can_enact') else (True, 'Ready')
            return {
                'name': name, 'priority': priority, 'action': action, 'tab': tab,
                'label': label, 'stance': stance, 'ready': allowed,
                'blocked_reason': '' if allowed else reason,
                'watch': self._watch_for(action),
            }

        return [
            desk('CENTRAL BANK', 'Prices • FX • Banks', cb_action, cb_stance),
            desk('TREASURY', 'Jobs • Households • Debt', tr_action, tr_stance),
            desk('DEVELOPMENT', 'Productivity • Housing • Trade', dev_action, dev_stance),
        ]

    def policy_preview(self, e, action):
        """Counterfactual 1Q/4Q preview against a no-new-policy baseline.

        It is intentionally presented as an estimate, not a promise: both paths use
        the same deterministic random seed so the displayed difference mostly reflects
        the selected policy rather than a different random shock draw.
        """
        cache_key = (
            e.year, e.quarter, action, len(getattr(e, 'decision_log', ())),
            round(e.inflation, 4), round(e.gdp_growth, 4), round(e.unemployment, 4),
            round(e.debt_ratio, 4), round(e.exchange_rate, 4),
        )
        cache = getattr(self, '_policy_preview_cache', {})
        if cache_key in cache:
            return cache[cache_key]

        if action.startswith('package:'):
            package_id = action.split(':', 1)[1]
            label = POLICY_PACKAGES.get(package_id, {}).get('name', package_id)
        else:
            label = ACTION_LABEL.get(action, action.replace('_', ' ').title())

        def prepare(sim):
            if hasattr(sim, 'max_policy_capacity'):
                sim.policy_capacity = sim.max_policy_capacity
                sim.political_capital = 100
                sim.action_cooldowns = {}
                sim.package_cooldowns = {}
                sim.game_status = 'RUNNING'
            sim.random_crises_enabled = False
            if hasattr(sim, 'missions'):
                sim.missions.mode = 'sandbox'
            sim.game_mode = 'sandbox'
            return sim

        state = random.getstate()
        try:
            baseline = prepare(copy.deepcopy(e))
            policy = prepare(copy.deepcopy(e))
            if action.startswith('package:'):
                ok = policy.enact_package(action.split(':', 1)[1])
            else:
                ok = policy.enact(action)
            if not ok:
                result = {'label': label, 'available': False, 'reason': getattr(policy, 'last_policy_message', 'Unavailable')}
                cache[cache_key] = result
                self._policy_preview_cache = cache
                return result

            immediate = {
                'policy_rate': policy.policy.policy_rate - e.policy.policy_rate,
                'debt': policy.debt_ratio - e.debt_ratio,
                'treasury': policy.treasury - e.treasury,
                'capacity': getattr(policy,'policy_capacity',0) - getattr(e,'policy_capacity',0),
            }
            random.seed(91337)
            base_path = []
            for _ in range(4):
                baseline.step_quarter()
                base_path.append((baseline.gdp_growth, baseline.inflation, baseline.unemployment, baseline.debt_ratio, baseline.approval))

            random.seed(91337)
            pol_path = []
            for _ in range(4):
                policy.step_quarter()
                pol_path.append((policy.gdp_growth, policy.inflation, policy.unemployment, policy.debt_ratio, policy.approval))

            def diff(i, q):
                return pol_path[q][i] - base_path[q][i]
            q1 = {'gdp': diff(0,0), 'inflation': diff(1,0), 'unemployment': diff(2,0), 'debt': diff(3,0), 'approval': diff(4,0)}
            q4 = {'gdp': diff(0,3), 'inflation': diff(1,3), 'unemployment': diff(2,3), 'debt': diff(3,3), 'approval': diff(4,3)}
            stress = abs(q4['inflation']) + max(0, q4['unemployment']) + max(0, q4['debt']) * .6
            risk = 'HIGH' if stress > .055 else ('MEDIUM' if stress > .025 else 'LOW')
            result = {
                'label': label, 'available': True, 'immediate': immediate, 'q1': q1, 'q4': q4, 'risk': risk,
                'note': 'Illustrative counterfactual versus no new policy; shocks are disabled for the preview.',
            }
            cache[cache_key] = result
            # Avoid unbounded UI cache growth.
            if len(cache) > 64:
                cache = dict(list(cache.items())[-48:])
            self._policy_preview_cache = cache
            return result
        finally:
            random.setstate(state)

    def coach(self, e):
        return self.mission_coach(e)

    def summary(self, e):
        top=self.analyze(e)[0]
        plan=self.action_plan(e,3)
        return {'severity':top[0],'title':top[1],'diagnosis':top[2],'policy':top[3],
                'tradeoff':top[4],'confidence':top[5],'actions':tuple(p['action'] for p in plan)}

@dataclass
class SocialGroup:
    name: str
    weight: float
    approval: float = 0.55
    priority: str = "stability"

class RivalCountry:
    def __init__(self):
        self.name = 'Land of Lightning'
        self.gdp_growth = 0.032
        self.inflation = 0.031
        self.unemployment = 0.058
        self.exports = 128.0
        self.technology = 72.0
        self.productivity = 1.00
        self.trade_share = 0.52
        self.score = 50.0
        self.retaliatory_tariff_rate = 0.0

    def enact_retaliatory_tariff(self, player):
        tariff_jump = player.policy.tariff_rate * 1.2
        self.retaliatory_tariff_rate = clamp(self.retaliatory_tariff_rate + tariff_jump, 0.0, 0.45)
        player.exports = max(30.0, player.exports * (1.0 - tariff_jump * 0.45))
        player.add_news(f"Trade War Escalation: Land of Lightning imposes {tariff_jump*100:.1f}% retaliatory tariffs!")
        player.add_chirp("@world_trade: Trade war tensions rise as rival strikes back with tariff barriers.")

    def step(self, player):
        tech_push = 0.18 + random.uniform(-0.08, 0.12)
        self.technology = clamp(self.technology + tech_push, 45, 100)
        self.productivity = clamp(self.productivity * (1 + 0.0018 + random.uniform(-.001, .0015)), .75, 1.6)
        self.gdp_growth = clamp(.65 * self.gdp_growth + .35 * (.025 + .00035 * (self.technology - 70) + random.uniform(-.018, .018)), -.08, .14)
        self.inflation = clamp(.78 * self.inflation + .22 * (.026 + .3 * max(0, self.gdp_growth - .035) + random.uniform(-.012, .012)), .005, .16)
        self.unemployment = clamp(self.unemployment - .06 * (self.gdp_growth - .025) + random.uniform(-.004, .004), .025, .16)
        competitiveness = (self.technology / 70.0) * (self.productivity / max(.7, getattr(player, 'productivity_level', 1.0)))
        self.exports = max(55, self.exports * (1 + self.gdp_growth / 9 + 0.004 * (competitiveness - 1)))
        p_comp = (player.exports / max(40, self.exports)) * getattr(player, 'technology_index', 70) / 70 * clamp(1 - getattr(player, 'trade_disruption', 0) * .45, .45, 1)
        self.trade_share = clamp(.54 - .07 * (p_comp - 1), .28, .72)
        self.score = clamp(50 + 180 * (self.gdp_growth - player.gdp_growth) + .35 * (self.technology - getattr(player, 'technology_index', 70)) - .16 * (self.inflation - player.inflation) * 100, 0, 100)

class ElectionSystem:
    def __init__(self):
        self.term_length = 16
        self.quarters_left = 16
        self.term = 1
        self.last_result = 'No election yet'
        self.last_vote_share = 0.0
        self.groups = [
            SocialGroup('Workers', .27, .56, 'jobs'), SocialGroup('Middle class', .28, .56, 'inflation'),
            SocialGroup('Business', .18, .54, 'growth'), SocialGroup('Students / youth', .12, .55, 'opportunity'),
            SocialGroup('Retirees', .15, .57, 'prices')]

    def update_groups(self, e):
        real_wage = e.wage_growth - e.inflation
        for g in self.groups:
            if g.priority == 'jobs': target = .56 + .7 * e.gdp_growth - 1.45 * (e.unemployment - .05) + .35 * real_wage
            elif g.priority == 'inflation': target = .58 + .32 * e.gdp_growth - 1.2 * abs(e.inflation - .025) - .30 * max(0, e.debt_ratio - .9)
            elif g.priority == 'growth': target = .54 + .9 * e.gdp_growth + .35 * (e.business_confidence - .6) - .45 * max(0, e.policy.corporate_tax - .21)
            elif g.priority == 'opportunity': target = .54 + .55 * e.gdp_growth - .9 * (e.unemployment - .055) + .5 * (e.policy.education_spending - .06)
            else: target = .58 - .95 * abs(e.inflation - .025) + .2 * (e.policy.health_spending - .07) - .25 * max(0, e.poverty - .10)
            g.approval = clamp(.78 * g.approval + .22 * target, .05, .95)

    def step(self, e):
        self.update_groups(e)
        self.quarters_left -= 1
        event = None
        if self.quarters_left <= 0:
            vote = sum(g.weight * g.approval for g in self.groups)
            vote = clamp(vote + .10 * e.gdp_growth - .12 * max(0, e.inflation - .05) - .10 * max(0, e.unemployment - .085), .05, .92)
            self.last_vote_share = vote
            won = vote >= .50
            self.last_result = ('Re-elected' if won else 'Election lost') + f' with {vote * 100:.1f}%'
            event = self.last_result
            self.term += 1
            self.quarters_left = self.term_length
            if won: e.political_capital = clamp(e.political_capital + 16, 0, 100)
            else:
                e.political_capital = clamp(e.political_capital - 25, 0, 100)
                e.approval = clamp(e.approval - 0.08, .05, .92)
        return event

class HousingMarket:
    def __init__(self):
        self.price_index = 100.0
        self.rent_index = 100.0
        self.vacancy_rate = .065
        self.new_builds = 0
        self.mortgage_rate = .065
        self.defaults = 0
        self.affordability = 0.72
        self.last_event = 'Stable housing market'

    def initialize_households(self, citizens, homes, e):
        home_by_id = {h.id: h for h in homes}
        for c in citizens:
            if c.special == 'Naruto':
                c.housing_tenure = 'owner'; c.mortgage_balance = max(0, 90 - c.assets * .2); c.monthly_rent = 0; c.house_value = 165
                continue
            h = home_by_id.get(c.home_id)
            value = h.value if h else random.uniform(70, 180)
            c.house_value = value
            if c.homeowner:
                c.housing_tenure = 'owner'
                ltv = random.uniform(.15, .68)
                c.mortgage_balance = value * ltv
                c.debt += c.mortgage_balance * .45
                c.monthly_rent = 0
            else:
                c.housing_tenure = 'renter'
                c.mortgage_balance = 0
                c.monthly_rent = value * .0045
            c.housing_cost_q = 0.0

    def step_quarter(self, citizens, e):
        self.mortgage_rate = clamp(e.policy.policy_rate + .022 + .018 * (1 - e.bank_health), .018, .24)
        demand = .45 * e.credit_growth + .38 * e.gdp_growth - .55 * max(0, self.mortgage_rate - .06) + .20 * (e.consumer_confidence - .6)
        demand -= .18 * getattr(e, 'macroprudential_level', 0) + .28 * getattr(e, 'mortgage_regulation', 0)
        supply = .20 * (e.policy.infrastructure_spending / .055 - 1) + .08 * getattr(e, 'housing_support_level', 0)
        growth = clamp(.012 + demand * .08 - supply * .025, -.06, .07)
        self.price_index = max(45, self.price_index * (1 + growth))
        rent_growth = clamp(.006 + .20 * e.inflation + .018 * max(0, .055 - self.vacancy_rate) - .01 * getattr(e, 'housing_support_level', 0), -.02, .06)
        self.rent_index = max(55, self.rent_index * (1 + rent_growth))
        self.vacancy_rate = clamp(self.vacancy_rate + .01 * max(0, e.unemployment - .07) + .006 * supply - .004 * max(0, e.gdp_growth), .025, .16)
        self.new_builds = max(0, int(3 + 18 * max(0, supply) + 12 * max(0, e.gdp_growth)))
        self.defaults = 0
        for c in citizens:
            if getattr(c, 'housing_tenure', 'renter') == 'owner':
                c.house_value = max(25, c.house_value * (1 + growth))
                interest = getattr(c, 'mortgage_balance', 0) * self.mortgage_rate / 4
                principal = min(getattr(c, 'mortgage_balance', 0) * .012, 3.0)
                c.housing_cost_q = interest + principal
                if c.cash >= c.housing_cost_q:
                    c.cash -= c.housing_cost_q; c.mortgage_balance = max(0, c.mortgage_balance - principal)
                else:
                    short = c.housing_cost_q - c.cash; c.cash = 0; c.debt += short
                    if not c.employed and random.random() < .16:
                        self.defaults += 1; c.say('Mortgage stress', 2.5)
                c.assets = max(0, c.assets * (1 + growth * .35))
            else:
                c.monthly_rent = max(1.5, c.monthly_rent * (1 + rent_growth))
                c.housing_cost_q = c.monthly_rent * 3
                if c.cash >= c.housing_cost_q: c.cash -= c.housing_cost_q
                else: c.debt += c.housing_cost_q - c.cash; c.cash = 0
        median_income = sorted([max(1, c.income) for c in citizens])[len(citizens) // 2]
        house_values = sorted(max(25, getattr(c, 'house_value', 100)) for c in citizens)
        median_house_value = house_values[len(house_values) // 2]
        # c.income is quarterly, so 4x gives a simple annual income / home-value affordability ratio.
        self.affordability = clamp((median_income * 4) / max(25, median_house_value), .15, 1.5)
        e.housing_index = self.price_index
        if self.defaults > 4: self.last_event = 'Mortgage defaults rising'
        elif growth > .04: self.last_event = 'House-price boom'
        elif growth < -.025: self.last_event = 'Housing correction'
        else: self.last_event = 'Housing market stable'

class TransportSystem:
    def __init__(self):
        self.bus_riders = 0; self.taxi_riders = 0; self.walkers = 0; self.car_riders = 0; self.motor_riders = 0
        self.transit_quality = .62; self.congestion = .28; self.fuel_cost_index = 1.0

    def choose_mode(self, c, distance, e):
        q = clamp(self.transit_quality + getattr(e, 'public_transport_level', 0) * .12, .3, .95)
        if distance < 125: return 'walk'
        r = random.random()
        if c.net_worth < 70: return 'bus' if r < .72 * q else 'walk'
        if c.net_worth > 350: return 'taxi' if r < .34 else ('car' if r < .72 else 'bus')
        return 'bus' if r < .38 * q else ('motorcycle' if r < .55 else ('taxi' if r < .70 else 'car'))

    def refresh(self, citizens, buses, taxis, e):
        counts = {'bus': 0, 'taxi': 0, 'walk': 0, 'car': 0, 'motorcycle': 0}
        for c in citizens: counts[getattr(c, 'transport_mode', 'walk')] = counts.get(getattr(c, 'transport_mode', 'walk'), 0) + 1
        self.bus_riders = counts['bus']; self.taxi_riders = counts['taxi']; self.walkers = counts['walk']; self.car_riders = counts['car']; self.motor_riders = counts['motorcycle']
        self.transit_quality = clamp(.58 + .12 * getattr(e, 'public_transport_level', 0) + .08 * (e.policy.infrastructure_spending / .055 - 1), .25, .95)
        self.congestion = clamp(.18 + .003 * (self.car_riders + self.taxi_riders + self.motor_riders) - .08 * getattr(e, 'public_transport_level', 0), .05, .9)
        for b in buses: b.passengers = min(36, max(0, int(self.bus_riders / max(1, len(buses)) + random.randint(-2, 3))))
        for t in taxis: t.passengers = 1 if random.random() < clamp(self.taxi_riders / max(1, len(taxis) * 8), .05, .92) else 0

class EconomyV4(Economy):
    def __post_init__(self):
        super().__post_init__()
        self.crisis_level = 0.0
        self.security_alert = 0.10
        self.sanction_level = 0.0
        self.food_security = 0.78
        self.trade_disruption = 0.0
        self.random_crises_enabled = True
        self.last_crisis = "None"
        self.random_crisis_cooldown = 3
        # V16: ordinary macro developments are separate from true crises. In Sandbox
        # the economy should create policy problems even when no disaster occurs.
        self.random_developments_enabled = True
        self.last_development = "None"
        self.development_cooldown = 2
        self.development_history = deque(maxlen=8)
        self.add_news("Economic policy suite loaded.")

    def apply_shock(self, kind):
        if kind in {"oil", "financial", "boom", "pandemic", "bubble_burst", "acid_rain"}:
            super().apply_shock(kind)
            self.last_crisis = kind.replace('_', ' ').title()
            if kind in {"financial", "pandemic", "oil", "bubble_burst", "acid_rain"}:
                self.crisis_level = clamp(self.crisis_level + 0.28, 0, 1)
            return
        self.last_crisis = kind.replace('_', ' ').title()
        if kind == "war":
            self.security_alert = clamp(self.security_alert + 0.65, 0, 1)
            self.crisis_level = clamp(self.crisis_level + 0.55, 0, 1)
            self.debt += 28
            self.add_impulse("War Mobilization", 10, {
                "government": 0.06, "investment": -0.10, "consumption": -0.055,
                "inflation": 0.028, "potential": -0.045, "confidence": -0.16,
                "exports": -0.10, "imports": 0.05, "unemployment": 0.022
            }, "War breaks out: security spending surges.", "War Disruption")
        elif kind == "sanctions":
            self.sanction_level = clamp(self.sanction_level + 0.45, 0, 1)
            self.trade_disruption = clamp(self.trade_disruption + 0.38, 0, 1)
            self.crisis_level = clamp(self.crisis_level + 0.30, 0, 1)
            self.add_impulse("International Sanctions", 12, {
                "exports": -0.18, "imports": -0.13, "fx": 0.14, "inflation": 0.025,
                "investment": -0.07, "confidence": -0.08, "potential": -0.025
            }, "International sanctions restrict trade.", "Trade Barrier")
        elif kind == "drought":
            self.food_security = clamp(self.food_security - 0.28, 0, 1)
            self.crisis_level = clamp(self.crisis_level + 0.20, 0, 1)
            self.add_impulse("Severe Drought", 8, {
                "inflation": 0.024, "potential": -0.018, "imports": 0.055,
                "confidence": -0.035, "poverty": 0.012
            }, "Severe drought cuts agricultural output.", "Food Shock")
        elif kind == "earthquake":
            self.crisis_level = clamp(self.crisis_level + 0.38, 0, 1)
            self.debt += 14
            self.add_impulse("Earthquake Reconstruction", 8, {
                "potential": -0.028, "government": 0.045, "investment": -0.035,
                "unemployment": 0.012, "confidence": -0.10
            }, "Earthquake damages physical capital.", "Emergency Spend")
        elif kind == "cyber":
            self.crisis_level = clamp(self.crisis_level + 0.18, 0, 1)
            self.bank_health = clamp(self.bank_health - 0.10, 0.1, 1)
            self.add_impulse("Cyberattack", 5, {
                "investment": -0.035, "confidence": -0.07, "credit": -0.06
            }, "Cyberattack disrupts banking settlement.", "Payment Gridlock")
        elif kind == "refugees":
            self.population_m *= 1.006
            self.crisis_level = clamp(self.crisis_level + 0.12, 0, 1)
            self.add_impulse("Refugee Inflow", 8, {
                "government": 0.020, "consumption": 0.012, "unemployment": 0.010,
                "potential": 0.010, "confidence": -0.018
            }, "Refugee inflow expands labor supply.", "Labor Inflow")
        elif kind == "tourism_boom":
            self.add_impulse("Tourism Boom", 7, {
                "exports": 0.10, "consumption": 0.025, "investment": 0.018,
                "confidence": 0.045, "unemployment": -0.008
            }, "Tourism boom expands service receipts.", "Tourism Revenue")
        elif kind == "commodity_boom":
            self.add_impulse("Commodity Windfall", 8, {
                "exports": 0.16, "investment": 0.035, "confidence": 0.055,
                "fx": -0.045, "government": 0.016
            }, "Commodity export windfall.", "Resource Windfall")

    def apply_development(self, kind):
        """Apply a non-catastrophic economic development.

        These are intentionally different from `apply_shock`: they represent the normal
        surprises policymakers face in a living economy — demand surges, wage pressure,
        supply bottlenecks, housing speculation, currency pressure, productivity changes
        and confidence swings. They are especially important in Sandbox mode.
        """
        self.last_development = kind.replace('_', ' ').title()
        self.development_history.appendleft((self.year, self.quarter, self.last_development))

        if kind == 'demand_surge':
            self.add_impulse('Demand Surge', 6, {
                'consumption': .045, 'investment': .025, 'inflation': .018,
                'unemployment': -.008, 'confidence': .035, 'credit': .025
            }, 'Household spending and private investment accelerate faster than expected.', 'Demand Pressure')
            self.add_chirp('@macro_wire: Retail sales and hiring jump; economists warn the economy may be overheating.')
        elif kind == 'supply_bottleneck':
            self.trade_disruption = clamp(self.trade_disruption + .10, 0, 1)
            self.add_impulse('Supply Bottleneck', 7, {
                'inflation': .022, 'imports': .025, 'investment': -.025,
                'potential': -.012, 'confidence': -.025
            }, 'Shipping delays and input shortages raise costs without a full-scale crisis.', 'Supply Constraint')
            self.add_chirp('@industry_watch: Manufacturers report missing components and longer delivery times.')
        elif kind == 'wage_pressure':
            self.wage_growth = clamp(self.wage_growth + .012, -.02, .18)
            self.add_impulse('Wage Pressure', 6, {
                'consumption': .018, 'inflation': .015, 'unemployment': -.004
            }, 'A tight labor market pushes wages up faster than productivity.', 'Wage Push')
            self.add_chirp('@labor_desk: Wage settlements jump as employers compete for scarce workers.')
        elif kind == 'housing_frenzy':
            self.housing_index = clamp(self.housing_index * 1.08, 50, 350)
            self.bubble_risk = clamp(self.bubble_risk + .18, 0, 1)
            self.add_impulse('Housing Credit Boom', 7, {
                'credit': .045, 'consumption': .012, 'inflation': .006, 'investment': .016
            }, 'Cheap credit and speculation accelerate house prices and mortgage borrowing.', 'Asset Boom')
            self.add_chirp('@property_feed: Bidding wars spread across the city as mortgage demand surges.')
        elif kind == 'currency_speculation':
            self.external_risk = clamp(self.external_risk + .08, 0, 1)
            self.add_impulse('Currency Speculation', 5, {
                'fx': .065, 'inflation': .012, 'confidence': -.035, 'investment': -.012
            }, 'Investors test the currency after rumors about external financing.', 'FX Pressure')
            self.add_chirp('@fx_terminal: Currency volatility spikes as traders price higher external risk.')
        elif kind == 'consumer_slump':
            self.add_impulse('Consumer Confidence Slump', 6, {
                'consumption': -.050, 'investment': -.018, 'unemployment': .008,
                'confidence': -.055, 'inflation': -.006
            }, 'Households become cautious and delay discretionary purchases.', 'Demand Slowdown')
            self.add_chirp('@retail_scan: Foot traffic weakens and stores report softer discretionary sales.')
        elif kind == 'productivity_slump':
            self.add_impulse('Productivity Slump', 10, {
                'potential': -.022, 'productivity': -.015, 'investment': -.012, 'inflation': .006
            }, 'Productivity growth disappoints as firms delay modernization.', 'Structural Weakness')
            self.add_chirp('@business_review: Firms postpone upgrades; productivity forecasts are revised down.')
        elif kind == 'tech_breakthrough':
            if hasattr(self, 'technology_index'):
                self.technology_index = clamp(self.technology_index + 2.2, 40, 100)
            self.add_impulse('Technology Breakthrough', 10, {
                'investment': .028, 'potential': .025, 'productivity': .020, 'confidence': .025
            }, 'A domestic technology breakthrough improves investment and productivity prospects.', 'Innovation Upside')
            self.add_chirp('@tech_daily: New industrial technology attracts investment and export interest.')
        elif kind == 'export_order_wave':
            self.add_impulse('Export Order Wave', 7, {
                'exports': .075, 'investment': .018, 'confidence': .025, 'inflation': .006
            }, 'Foreign buyers place a strong wave of new orders with domestic firms.', 'External Demand')
            self.add_chirp('@port_signal: Export bookings rise sharply for the next two quarters.')

    def _step_random_developments(self):
        if not self.random_developments_enabled:
            return
        self.development_cooldown -= 1
        if self.development_cooldown > 0:
            return
        mode = getattr(self, 'game_mode', 'mission')
        # Sandbox deliberately feels more alive: ordinary policy problems arrive often,
        # while Mission mode leaves slightly more room to pursue the formal objective.
        probability = .58 if mode == 'sandbox' else .20
        probability += .08 * max(0, self.external_risk - .15)
        if random.random() < probability:
            weighted = [
                ('demand_surge', 10), ('supply_bottleneck', 10), ('wage_pressure', 8),
                ('housing_frenzy', 8), ('currency_speculation', 7), ('consumer_slump', 8),
                ('productivity_slump', 6), ('tech_breakthrough', 5), ('export_order_wave', 6),
            ]
            bag=[]
            for name, weight in weighted:
                bag.extend([name]*weight)
            self.apply_development(random.choice(bag))
            self.development_cooldown = random.randint(2, 4) if mode == 'sandbox' else random.randint(4, 7)
        else:
            self.development_cooldown = random.randint(1, 3) if mode == 'sandbox' else random.randint(3, 5)

    def enact(self, action: str):
        if action == "food_subsidy":
            self.debt += 5
            self.add_impulse("Food Subsidy", 5, {"inflation": -0.008, "consumption": 0.012, "poverty": -0.010, "government": 0.010}, "Emergency targeted food relief.", "Relief Subsidy")
        elif action == "sanction_relief":
            cost = 8.0
            self.sanction_level = clamp(self.sanction_level - 0.20, 0, 1)
            self.trade_disruption = clamp(self.trade_disruption - 0.18, 0, 1)
            self.add_impulse("Diplomatic Accord", 8, {"exports": 0.06, "imports": 0.035, "fx": -0.04, "confidence": 0.04, "investment": 0.02}, "Diplomatic agreement eases sanctions.", "Trade Relief")
        elif action == "security_package":
            self.debt += 7
            self.security_alert = clamp(self.security_alert - 0.25, 0, 1)
            self.add_impulse("Security Package", 5, {"government": 0.015, "confidence": 0.025}, "Emergency civil defense deployed.", "Security Flow")
        elif action == "port_upgrade":
            self.debt += 9
            self.add_impulse("Port Modernization", 12, {"exports": 0.055, "imports": 0.025, "potential": 0.018, "investment": 0.020}, "Trade port modernization expands logistics capacity.", "Logistics Flow")
        else:
            super().enact(action)

    def step_quarter(self):
        super().step_quarter()
        self.crisis_level = clamp(self.crisis_level * 0.90, 0, 1)
        self.security_alert = clamp(self.security_alert * 0.93, 0, 1)
        self.trade_disruption = clamp(self.trade_disruption * 0.93, 0, 1)
        self.sanction_level = clamp(self.sanction_level * 0.98, 0, 1)
        self.food_security = clamp(self.food_security + 0.015, 0, 1)
        self.random_crisis_cooldown -= 1
        if self.random_crises_enabled and self.random_crisis_cooldown <= 0:
            mode = getattr(self, 'game_mode', 'mission')
            probability = (0.30 if mode == 'sandbox' else 0.14) + 0.08 * self.external_risk
            if random.random() < probability:
                options = [
                    ("oil", 10), ("financial", 6), ("pandemic", 3), ("war", 4),
                    ("sanctions", 7), ("drought", 7), ("earthquake", 4), ("cyber", 7),
                    ("refugees", 5), ("tourism_boom", 8), ("commodity_boom", 7), ("boom", 6)
                ]
                bag = []
                for name, weight in options: bag.extend([name] * weight)
                self.apply_shock(random.choice(bag))
                self.random_crisis_cooldown = random.randint(3, 7)
            else:
                self.random_crisis_cooldown = random.randint(2, 4)

        # Normal macroeconomic surprises continue independently of headline crises.
        self._step_random_developments()

class SectorSystem:
    def __init__(self):
        self.output = {'Agriculture': 92.0, 'Industry': 174.0, 'Services': 430.0, 'Energy': 88.0, 'Technology': 96.0, 'Construction': 82.0}
        self.growth = {k: .02 for k in self.output}
        self.stress = {k: 0.0 for k in self.output}

    def step(self, e):
        prev = dict(self.output)
        sanction = getattr(e, 'sanction_level', 0); drought = 1 - getattr(e, 'food_security', .8); credit = max(-.2, e.credit_growth)
        drivers = {
            'Agriculture': .018 - .09 * drought - .015 * max(0, e.inflation - .06),
            'Industry': .02 + .16 * e.gdp_growth + .06 * credit - .055 * getattr(e, 'trade_disruption', 0) + .025 * e.policy.infrastructure_spending / .055,
            'Services': .022 + .22 * e.gdp_growth + .08 * (e.consumer_confidence - .6) - .025 * getattr(e, 'crisis_level', 0),
            'Energy': .018 + .045 * (e.energy_security - .65) - .035 * sanction + .018 * e.policy.green_spending / .025,
            'Technology': .03 + .003 * (getattr(e, 'technology_index', 70) - 70) + .035 * getattr(e, 'research_level', 0) + .02 * e.policy.education_spending / .06,
            'Construction': .016 + .17 * e.gdp_growth - .11 * max(0, e.real_rate - .02) + .045 * e.policy.infrastructure_spending / .055 + .03 * getattr(e, 'housing_support_level', 0)
        }
        for k, v in self.output.items():
            g = clamp(drivers[k] + random.uniform(-.008, .008), -.10, .12)
            self.output[k] = max(20, v * (1 + g / 4)); self.growth[k] = (self.output[k] / max(1, prev[k]) - 1) * 4
            self.stress[k] = clamp(max(0, -self.growth[k]) * .9 + (getattr(e, 'trade_disruption', 0) * .25 if k in {'Industry', 'Energy'} else 0), 0, 1)

    def weakest(self): return min(self.growth, key=self.growth.get)
    def strongest(self): return max(self.growth, key=self.growth.get)

class MonetaryPolicyCommittee:
    def __init__(self):
        self.members = ['Inflation Hawk', 'Labor Dove', 'Financial Stability', 'External Balance', 'Governor']
        self.last_votes = []; self.recommendation = 'Hold'; self.confidence = .5

    def deliberate(self, e):
        votes = []
        signals = [2.0 * (e.inflation - .025) + .5 * e.output_gap,
                   1.1 * (e.inflation - .025) + .25 * e.output_gap - .8 * (e.unemployment - .05),
                   1.0 * (e.inflation - .025) + .25 * e.output_gap - .6 * max(0, .65 - e.bank_health),
                   1.2 * (e.inflation - .025) + .35 * (e.exchange_rate - 1),
                   1.5 * (e.inflation - .025) + .4 * e.output_gap - .25 * max(0, e.unemployment - .06)]
        for member, sig in zip(self.members, signals):
            vote = 'Hike' if sig > .018 else 'Cut' if sig < -.018 else 'Hold'; votes.append((member, vote, sig))
        tally = {v: sum(1 for _, x, _ in votes if x == v) for v in ['Hike', 'Hold', 'Cut']}
        self.recommendation = max(tally, key=tally.get); self.confidence = max(tally.values()) / len(votes); self.last_votes = votes
        return self.recommendation

class MissionSystem:
    """Periodic missions with free-play gaps and context-sensitive guidance."""

    def __init__(self):
        self.score = 0
        self.completed = 0
        self.failed = 0
        self.mode = 'mission'
        self.active = None
        self.history = deque(maxlen=12)
        self.cooldown_remaining = 0
        self.serial = 0
        self.templates = [
            {'kind':'price','name':'Price Stability','text':'Bring inflation into 1.5–3.5% while keeping unemployment below 7.5%.','required':2,'duration':10,'reward':18,'actions':('rate_up','reserve_up','support_fx','port_upgrade'),'packages':('soft_landing',)},
            {'kind':'jobs','name':'Jobs Recovery','text':'Bring unemployment below 6.5% with positive real GDP growth.','required':2,'duration':10,'reward':18,'actions':('sme_credit','job_training','infra_up','payroll_tax_cut'),'packages':('sme_jobs','recovery_jobs')},
            {'kind':'exports','name':'Export Breakthrough','text':'Beat rival exports while keeping trade disruption below 15%.','required':2,'duration':12,'reward':20,'actions':('port_upgrade','export_support','tariff_down','fdi_incentives'),'packages':('export_competitiveness','resilience')},
            {'kind':'housing','name':'Housing Access','text':'Raise housing affordability above 0.65 while keeping real GDP growth positive.','required':2,'duration':10,'reward':18,'actions':('housing_support','infra_up','mortgage_tighten','public_transport'),'packages':('housing_affordability',)},
            {'kind':'debt','name':'Fiscal Resilience','text':'Move debt/GDP below 95% while approval remains above 45%.','required':2,'duration':12,'reward':20,'actions':('anti_corruption','vat_up','wealth_tax_up','austerity'),'packages':('fiscal_repair',)},
            {'kind':'banks','name':'Restore Credit System','text':'Restore bank health above 72% and keep credit growth positive.','required':2,'duration':8,'reward':18,'actions':('bank_recap','reserve_down','sme_credit','macroprudential_up'),'packages':('financial_rescue',)},
            {'kind':'living_cost','name':'Cost-of-Living Relief','text':'Bring poverty below 12% and restore non-negative real wage growth.','required':2,'duration':10,'reward':18,'actions':('food_subsidy','energy_subsidy','welfare_up','job_training'),'packages':('cost_of_living',)},
            {'kind':'green','name':'Energy Transition','text':'Reduce emissions below 95 and lift energy security above 70%.','required':2,'duration':14,'reward':22,'actions':('green_up','public_transport','research_grant','carbon_tax'),'packages':('green_transition',)},
            {'kind':'innovation','name':'Innovation Economy','text':'Raise technology above 75 and productivity level above 1.01.','required':2,'duration':14,'reward':22,'actions':('research_grant','business_reform','job_training','fdi_incentives'),'packages':('supply_productivity','resilience')},
            {'kind':'sanctions','name':'External Resilience','text':'Reduce sanctions and trade disruption below 15%.','required':2,'duration':10,'reward':20,'actions':('sanction_relief','port_upgrade','food_reserve','support_fx'),'packages':('resilience',)},
        ]

    def set_mode(self, mode, e=None):
        self.mode = 'sandbox' if mode == 'sandbox' else 'mission'
        self.active = None
        self.cooldown_remaining = 0 if self.mode == 'mission' else 999999
        if self.mode == 'mission' and e is not None:
            self.assign_next(e, force=True)

    def _eligible(self, t, e):
        kind=t['kind']
        if kind=='sanctions' and getattr(e,'sanction_level',0)<.08: return False
        if kind=='banks' and e.bank_health>.88: return False
        if kind=='green' and e.emissions<85 and e.energy_security>.78: return False
        if kind=='living_cost' and e.poverty<.075: return False
        if kind=='debt' and e.debt_ratio<.65: return False
        if kind=='price' and .015<=e.inflation<=.035 and e.unemployment<.065: return True
        return True

    def _priority(self, t, e):
        k=t['kind']; score=random.random()*1.5
        if k=='price': score += abs(e.inflation-.025)*30
        elif k=='jobs': score += max(0,e.unemployment-.055)*25 + max(0,-e.gdp_growth)*12
        elif k=='exports': score += max(0,e.rival.exports-e.exports)/18 + getattr(e,'trade_disruption',0)*3
        elif k=='housing': score += max(0,.68-e.housing.affordability)*8
        elif k=='debt': score += max(0,e.debt_ratio-.80)*6
        elif k=='banks': score += max(0,.78-e.bank_health)*7
        elif k=='living_cost': score += max(0,e.poverty-.10)*10 + max(0,e.inflation-.05)*5
        elif k=='green': score += max(0,e.emissions-95)/18 + max(0,.70-e.energy_security)*4
        elif k=='innovation': score += max(0,75-e.technology_index)/7
        elif k=='sanctions': score += getattr(e,'sanction_level',0)*7 + getattr(e,'trade_disruption',0)*4
        return score

    def assign_next(self, e, force=False):
        if self.mode != 'mission': return None
        choices=[t for t in self.templates if self._eligible(t,e)] or list(self.templates)
        choices=sorted(choices,key=lambda t:self._priority(t,e),reverse=True)
        pool=choices[:max(2,min(5,len(choices)))]
        t=random.choice(pool[:3]) if len(pool)>1 else pool[0]
        self.serial += 1
        self.active={**t,'id':self.serial,'progress':0,'remaining':t['duration'],'done':False,'failed':False,
                     'start_year':e.year,'start_quarter':e.quarter}
        e.add_news(f"New mission: {t['name']} — {t['text']}")
        e.add_chirp('@cabinet_desk: New strategic mission issued. Open the objective panel for a step-by-step guide.')
        return self.active

    def _condition(self, m, e):
        k=m['kind']
        if k=='price': return .015<=e.inflation<=.035 and e.unemployment<.075
        if k=='jobs': return e.unemployment<.065 and e.gdp_growth>0
        if k=='exports': return e.exports>e.rival.exports and e.trade_disruption<.15
        if k=='housing': return e.housing.affordability>.65 and e.gdp_growth>0
        if k=='debt': return e.debt_ratio<.95 and e.approval>.45
        if k=='banks': return e.bank_health>.72 and e.credit_growth>0
        if k=='living_cost': return e.poverty<.12 and (e.wage_growth-e.inflation)>=0
        if k=='green': return e.emissions<95 and e.energy_security>.70
        if k=='innovation': return e.technology_index>75 and e.productivity_level>1.01
        if k=='sanctions': return e.sanction_level<.15 and e.trade_disruption<.15
        return False

    def update(self, e):
        if self.mode != 'mission': return self.score
        if self.active is None:
            if self.cooldown_remaining>0:
                self.cooldown_remaining-=1
            else:
                self.assign_next(e)
            return self.score
        m=self.active
        ok=self._condition(m,e)
        m['progress']=m['progress']+1 if ok else max(0,m['progress']-1)
        m['remaining']-=1
        if m['progress']>=m['required']:
            m['done']=True; self.completed+=1; self.score=min(100,self.score+m['reward'])
            e.political_capital=clamp(e.political_capital+7,0,100)
            if hasattr(e,'policy_capacity'): e.policy_capacity=clamp(e.policy_capacity+14,0,e.max_policy_capacity)
            self.history.appendleft(dict(m)); self.active=None; self.cooldown_remaining=random.randint(2,4)
            e.add_news(f"MISSION COMPLETE: {m['name']} — reward +{m['reward']} mission score.")
            e.add_chirp('@national_news: Mission completed. Cabinet credibility and policy capacity improved.')
        elif m['remaining']<=0:
            m['failed']=True; self.failed+=1; e.political_capital=clamp(e.political_capital-5,0,100)
            self.history.appendleft(dict(m)); self.active=None; self.cooldown_remaining=random.randint(2,3)
            e.add_news(f"Mission expired: {m['name']}. The economy continues; a new mission will arrive later.")
        return self.score

    def current(self, e):
        if self.mode!='mission':
            development = getattr(e, 'last_development', 'None')
            crisis = getattr(e, 'last_crisis', 'None')
            return {'name':'Free Economy / Sandbox',
                    'text':'No formal mission. The economy generates ordinary booms, bottlenecks, inflation pressure, housing cycles and occasional crises. Use the Advisor as your policy desk.',
                    'done':False,'progress':0,'required':1,'actions':(), 'packages':(), 'reward':'No fixed victory condition',
                    'status':f'Advisor priority: {Advisor().analyze(e)[0][1]} • Latest development: {development} • Latest crisis: {crisis}',
                    'remaining':None,'kind':'sandbox'}
        if self.active is None:
            return {'name':'Open Policy Window','text':'No formal mission right now. Build buffers, inspect the economy and prepare for the next assignment.',
                    'done':False,'progress':0,'required':1,'actions':(), 'packages':(), 'reward':'Next mission soon',
                    'status':f'Next mission in {self.cooldown_remaining} quarter(s)','remaining':self.cooldown_remaining,'kind':'free_window'}
        m=dict(self.active); m['status']=self._status_line(m,e); return m

    def _status_line(self,m,e):
        k=m['kind']
        if k=='price': return f'Inflation {pct(e.inflation)} • Unemployment {pct(e.unemployment)}'
        if k=='jobs': return f'Unemployment {pct(e.unemployment)} • GDP growth {pct(e.gdp_growth)}'
        if k=='exports': return f'Exports {money(e.exports)} vs rival {money(e.rival.exports)} • Disruption {pct(e.trade_disruption)}'
        if k=='housing': return f'Affordability {e.housing.affordability:.2f} • GDP growth {pct(e.gdp_growth)}'
        if k=='debt': return f'Debt/GDP {pct(e.debt_ratio)} • Approval {pct(e.approval)}'
        if k=='banks': return f'Bank health {e.bank_health*100:.0f}/100 • Credit {pct(e.credit_growth)}'
        if k=='living_cost': return f'Poverty {pct(e.poverty)} • Real wage growth {pct(e.wage_growth-e.inflation)}'
        if k=='green': return f'Emissions {e.emissions:.0f} • Energy security {e.energy_security*100:.0f}/100'
        if k=='innovation': return f'Tech {e.technology_index:.1f} • Productivity {e.productivity_level:.3f}'
        if k=='sanctions': return f'Sanctions {pct(e.sanction_level)} • Trade disruption {pct(e.trade_disruption)}'
        return ''

    def guidance(self, e):
        """Create a mission briefing that is actionable rather than descriptive.

        The returned structure is deliberately UI-friendly: `primary` is the single
        next policy the game should highlight, `steps` are alternatives/follow-ups,
        and `targets` show the live mission numbers beside their success thresholds.
        """
        obj = self.current(e)
        k = obj.get('kind')
        advisor = Advisor()

        def step(action, timing, reason, after='Advance one quarter, then reassess.'):
            tab, label = advisor_route(action)
            allowed, blocked = e.can_enact(action) if hasattr(e, 'can_enact') else (True, 'Ready')
            return {
                'action': action, 'tab': tab, 'label': label, 'timing': timing,
                'reason': reason, 'watch': advisor._watch_for(action),
                'ready': allowed, 'blocked_reason': '' if allowed else blocked,
                'navigation': f'Open {tab} -> {label}', 'after': after,
            }

        def target(label, current_text, target_text, ok):
            return {'label': label, 'current': current_text, 'target': target_text, 'ok': bool(ok)}

        steps, avoid, targets = [], [], []
        explain = obj.get('text', '')
        success_rule = obj.get('text', '')

        if k == 'price':
            targets = [
                target('Inflation', pct(e.inflation), '1.5% - 3.5%', .015 <= e.inflation <= .035),
                target('Unemployment', pct(e.unemployment), '< 7.5%', e.unemployment < .075),
            ]
            if e.inflation > .035:
                demand_driven = e.output_gap > .01 and getattr(e, 'trade_disruption', 0) < .15 and e.exchange_rate < 1.12
                if demand_driven:
                    steps += [
                        step('rate_up', 'DO THIS FIRST', 'Demand is running above capacity. Raise the policy rate once, then wait for transmission.'),
                        step('reserve_up', 'FOLLOW-UP', 'If credit growth remains excessive next quarter, tighten bank reserves.'),
                    ]
                else:
                    steps += [
                        step('port_upgrade', 'DO THIS FIRST', 'Inflation looks supply/FX driven. Remove logistics bottlenecks before crushing domestic demand.'),
                        step('energy_subsidy', 'OPTION', 'Use targeted energy relief when energy costs are a major source of the shock.'),
                    ]
                if e.exchange_rate > 1.10:
                    steps.append(step('support_fx', 'OPTION', 'The weak currency is importing inflation; temporary FX defense can reduce pass-through.'))
                avoid = ['stimulus', 'rate_down']
            elif e.inflation < .015:
                steps += [
                    step('rate_down', 'DO THIS FIRST', 'Inflation is below the target band, so modest easing is appropriate.'),
                    step('sme_credit', 'FOLLOW-UP', 'If activity stays weak, support productive small-business lending.'),
                ]
            else:
                steps += [
                    step('business_reform', 'HOLD THE TARGET', 'Inflation is already in range. Improve supply capacity without adding a large demand shock.'),
                    step('infra_up', 'OPTION', 'Infrastructure raises capacity and helps keep future inflation lower.'),
                ]

        elif k == 'jobs':
            targets = [
                target('Unemployment', pct(e.unemployment), '< 6.5%', e.unemployment < .065),
                target('GDP growth', pct(e.gdp_growth), '> 0%', e.gdp_growth > 0),
            ]
            if e.inflation < .055:
                steps.append(step('sme_credit', 'DO THIS FIRST', 'Target firms that can hire quickly without using the largest possible fiscal stimulus.'))
            steps += [
                step('job_training', 'FOLLOW-UP', 'Improve matching between vacancies and workers; this is slower but more durable.'),
                step('payroll_tax_cut', 'OPTION', 'Temporarily reduce the cost of adding workers.'),
                step('infra_up', 'OPTION', 'Create near-term employment while expanding future productive capacity.'),
            ]
            if e.inflation > .07:
                avoid = ['stimulus', 'rate_down']

        elif k == 'exports':
            targets = [
                target('Exports', money(e.exports), f'> rival {money(e.rival.exports)}', e.exports > e.rival.exports),
                target('Trade disruption', pct(e.trade_disruption), '< 15%', e.trade_disruption < .15),
            ]
            steps += [
                step('port_upgrade', 'DO THIS FIRST', 'Improve port/logistics capacity before paying firms to export more.'),
                step('export_support', 'FOLLOW-UP', 'Once logistics improve, finance exporters to expand orders.'),
                step('tariff_down', 'OPTION', 'Lower imported input costs for export-oriented firms.'),
                step('fdi_incentives', 'OPTION', 'Bring in productive capital and export technology.'),
            ]

        elif k == 'housing':
            targets = [
                target('Affordability', f'{e.housing.affordability:.2f}', '> 0.65', e.housing.affordability > .65),
                target('GDP growth', pct(e.gdp_growth), '> 0%', e.gdp_growth > 0),
            ]
            steps += [
                step('housing_support', 'DO THIS FIRST', 'Add housing supply. Buyer-only subsidies can make prices worse.'),
                step('infra_up', 'FOLLOW-UP', 'Open serviced land and construction capacity.'),
            ]
            if e.housing.price_index > 135 or e.credit_growth > .10:
                steps.append(step('mortgage_tighten', 'OPTION', 'Speculative credit is strong; tighten mortgage standards while supply expands.'))
            elif e.inflation < .04:
                steps.append(step('rate_down', 'OPTION', 'Financing costs can be eased only because inflation is currently contained.'))

        elif k == 'debt':
            targets = [
                target('Debt / GDP', pct(e.debt_ratio), '< 95%', e.debt_ratio < .95),
                target('Approval', pct(e.approval), '> 45%', e.approval > .45),
            ]
            steps += [
                step('anti_corruption', 'DO THIS FIRST', 'Improve revenue efficiency before cutting useful public investment.'),
                step('vat_up', 'FOLLOW-UP', 'Broaden revenue with a small VAT adjustment if growth remains stable.'),
                step('wealth_tax_up', 'OPTION', 'Use progressive temporary revenue when political conditions allow.'),
            ]
            if e.gdp_growth > .015:
                steps.append(step('austerity', 'OPTION', 'Growth is strong enough to absorb gradual consolidation.'))
            else:
                avoid = ['austerity']

        elif k == 'banks':
            targets = [
                target('Bank health', f'{e.bank_health*100:.0f}/100', '> 72/100', e.bank_health > .72),
                target('Credit growth', pct(e.credit_growth), '> 0%', e.credit_growth > 0),
            ]
            steps += [
                step('bank_recap', 'DO THIS FIRST', 'Repair bank solvency first. Liquidity alone cannot fix an insolvent banking system.'),
                step('reserve_down', 'FOLLOW-UP', 'After solvency improves, release liquidity so lending can resume.'),
                step('sme_credit', 'OPTION', 'Restart productive lending channels rather than broad speculative credit.'),
            ]

        elif k == 'living_cost':
            real_wage = e.wage_growth - e.inflation
            targets = [
                target('Poverty', pct(e.poverty), '< 12%', e.poverty < .12),
                target('Real wage growth', pct(real_wage), '>= 0%', real_wage >= 0),
            ]
            steps += [
                step('food_subsidy', 'DO THIS FIRST', 'Target the fastest household pain point with temporary food relief.'),
                step('job_training', 'FOLLOW-UP', 'Move from emergency relief toward stronger earned income.'),
                step('energy_subsidy', 'OPTION', 'Use targeted energy relief only when energy prices are an important driver.'),
                step('welfare_up', 'OPTION', 'Protect the poorest households while adjustment occurs.'),
            ]

        elif k == 'green':
            targets = [
                target('Emissions', f'{e.emissions:.0f}', '< 95', e.emissions < 95),
                target('Energy security', f'{e.energy_security*100:.0f}/100', '> 70/100', e.energy_security > .70),
            ]
            steps += [
                step('green_up', 'DO THIS FIRST', 'Build clean supply before imposing the full carbon price.'),
                step('public_transport', 'FOLLOW-UP', 'Reduce fuel dependence and congestion.'),
                step('research_grant', 'OPTION', 'Lower long-run clean-technology costs.'),
                step('carbon_tax', 'OPTION', 'Add carbon pricing after alternatives are expanding.'),
            ]

        elif k == 'innovation':
            targets = [
                target('Technology', f'{e.technology_index:.1f}', '> 75', e.technology_index > 75),
                target('Productivity', f'{e.productivity_level:.3f}', '> 1.010', e.productivity_level > 1.01),
            ]
            steps += [
                step('research_grant', 'DO THIS FIRST', 'Accelerate R&D and university-industry innovation.'),
                step('business_reform', 'FOLLOW-UP', 'Make it easier for productive firms to enter and scale.'),
                step('job_training', 'OPTION', 'Increase skilled labor supply.'),
                step('fdi_incentives', 'OPTION', 'Import capital, management know-how and technology.'),
            ]

        elif k == 'sanctions':
            targets = [
                target('Sanctions', pct(e.sanction_level), '< 15%', e.sanction_level < .15),
                target('Trade disruption', pct(e.trade_disruption), '< 15%', e.trade_disruption < .15),
            ]
            steps += [
                step('sanction_relief', 'DO THIS FIRST', 'Directly reduce the external restriction if political capital allows.'),
                step('port_upgrade', 'FOLLOW-UP', 'Improve trade efficiency regardless of diplomacy.'),
                step('food_reserve', 'OPTION', 'Build a buffer against import disruption.'),
                step('support_fx', 'OPTION', 'Use reserves only for temporary currency stress.'),
            ]

        else:
            # Free policy window or sandbox: use the normal advisor instead of inventing a mission.
            plan = advisor.action_plan(e, 5)
            steps = []
            for p in plan:
                allowed, blocked = e.can_enact(p['action']) if hasattr(e, 'can_enact') else (True, 'Ready')
                steps.append({
                    'action': p['action'], 'tab': p['tab'], 'label': p['label'], 'timing': p['timing'],
                    'reason': p['problem'], 'watch': p['watch'], 'ready': allowed,
                    'blocked_reason': '' if allowed else blocked,
                    'navigation': f"Open {p['tab']} -> {p['label']}",
                    'after': 'Advance one quarter and reassess.'
                })
            top = advisor.analyze(e)[0]
            explain = top[2]
            success_rule = 'There is no formal mission. Stabilize the most urgent problem and build buffers.'

        # Keep blocked actions visible as useful teaching, but choose the first available
        # policy as the highlighted next move.
        primary = next((s for s in steps if s.get('ready')), steps[0] if steps else None)
        if primary is not None and not primary.get('ready'):
            # If every ideal policy is blocked, tell the player explicitly instead of
            # sending them to a disabled button with no explanation.
            primary = dict(primary)
            primary['timing'] = 'PREPARE'

        return {
            'kind': k,
            'title': obj['name'],
            'status': obj.get('status', ''),
            'goal': obj.get('text', ''),
            'success_rule': success_rule,
            'diagnosis': explain,
            'steps': steps[:5],
            'primary': primary,
            'targets': targets,
            'avoid': tuple(avoid),
            'packages': obj.get('packages', ()),
            'progress': obj.get('progress', 0),
            'required': obj.get('required', 1),
            'remaining': obj.get('remaining'),
            'reassess': 'Advance one quarter after a major move; most policy effects arrive with a lag.'
        }



class EconomyV11(EconomyV4):
    def __post_init__(self):
        super().__post_init__()
        self.housing_support_level = 0.0
        self.public_transport_level = 0.0
        self.research_level = 0.0
        self.technology_index = 70.0
        self.productivity_level = 1.0
        self.rival = RivalCountry()
        self.elections = ElectionSystem()
        self.sectors = SectorSystem()
        self.mpc = MonetaryPolicyCommittee()
        self.missions = MissionSystem()
        self.housing = HousingMarket()
        self.price_stability_score = 0.90
        self.inflation_regime = 'Target Range'

        # Game layer: scarce decision capacity, cooldowns, score and explicit win/loss state.
        self.policy_capacity = 100.0
        self.max_policy_capacity = 100.0
        self.action_cooldowns: Dict[str, int] = {}
        self.package_cooldowns: Dict[str, int] = {}
        self.last_policy_message = 'Cabinet ready.'
        self.decision_log = deque(maxlen=16)
        self.turns_survived = 0
        self.stability_score = 72.0
        self.national_score = 50.0
        self.game_status = 'RUNNING'
        self.game_over_reason = ''
        self.systemic_failure_quarters = 0
        self.last_quarter_report: Dict[str, object] = {}
        self.game_mode = 'mission'
        self.macroprudential_level = 0.0
        self.mortgage_regulation = 0.0
        self.fdi_level = 0.0
        self.missions.set_mode('mission', self)
        self.start_snapshot = {
            'real_gdp': self.real_gdp, 'inflation': self.inflation, 'unemployment': self.unemployment,
            'debt_ratio': self.debt_ratio, 'poverty': self.poverty, 'inequality': self.inequality,
            'housing_affordability': self.housing.affordability, 'technology_index': self.technology_index,
            'energy_security': self.energy_security, 'emissions': self.emissions, 'exports': self.exports,
        }
        self.career_stats = {'quarters': 0, 'growth_sum': 0.0, 'inflation_sum': 0.0, 'unemployment_sum': 0.0, 'crisis_quarters': 0}

    def set_game_mode(self, mode: str):
        self.game_mode = 'sandbox' if mode == 'sandbox' else 'mission'
        self.missions.set_mode(self.game_mode, self)
        self.game_status = 'RUNNING'
        self.game_over_reason = ''
        self.add_news('Game mode changed: ' + ('Free Economy / Sandbox' if self.game_mode == 'sandbox' else 'Mission Campaign'))
        return self.game_mode

    def can_enact(self, action: str) -> Tuple[bool, str]:
        if self.game_status != 'RUNNING':
            return False, f'Game is {self.game_status.lower()}: {self.game_over_reason}'
        rule = POLICY_ACTION_RULES.get(action, PolicyActionSpec(16, 3, 1))
        cd = self.action_cooldowns.get(action, 0)
        if cd > 0:
            return False, f'{ACTION_LABEL.get(action, action)} is on cooldown for {cd} more quarter(s).'
        if self.policy_capacity < rule.capacity_cost:
            return False, f'Insufficient policy capacity: need {rule.capacity_cost:.0f}, have {self.policy_capacity:.0f}.'
        if self.political_capital < rule.political_cost:
            return False, f'Insufficient political capital: need {rule.political_cost:.0f}, have {self.political_capital:.0f}.'
        if self.treasury < rule.minimum_treasury:
            return False, f'Treasury reserves are too low for this operation (minimum {money(rule.minimum_treasury)}).'
        if action == 'debt_restructure' and self.debt_ratio < .90:
            return False, 'Debt restructuring is unavailable while debt/GDP is below 90%.'
        if action == 'imf_bailout' and not (self.debt_ratio > 1.10 or self.treasury < 5 or self.bank_health < .35):
            return False, 'External stabilization assistance is reserved for severe fiscal or financial stress.'
        if action == 'sanction_relief' and self.sanction_level < .08:
            return False, 'There are no material sanctions to negotiate away.'
        return True, 'Ready'

    def _commit_action_cost(self, action: str):
        rule = POLICY_ACTION_RULES.get(action, PolicyActionSpec(16, 3, 1))
        self.policy_capacity = clamp(self.policy_capacity - rule.capacity_cost, 0, self.max_policy_capacity)
        self.political_capital = clamp(self.political_capital - rule.political_cost, 0, 100)
        self.action_cooldowns[action] = max(1, rule.cooldown)

    def _apply_action_effect(self, action: str):
        if action == 'housing_support':
            self.debt += 7
            self.housing_support_level = clamp(self.housing_support_level + .18, 0, 1)
            self.add_impulse('Housing Supply Plan', 7, {'investment': .022, 'potential': .010, 'consumption': .006, 'inflation': -.003}, 'Targeted affordable housing program launched.', 'Housing Supply')
        elif action == 'public_transport':
            self.debt += 8
            self.public_transport_level = clamp(self.public_transport_level + .20, 0, 1)
            self.add_impulse('Transit Expansion', 8, {'investment': .018, 'potential': .012, 'emissions': -.018, 'consumption': .004}, 'Public mass transit infrastructure expanded.', 'Transit Capital')
        elif action == 'research_grant':
            self.debt += 6
            self.research_level = clamp(self.research_level + .18, 0, 1)
            self.add_impulse('Innovation Grants', 10, {'investment': .015, 'potential': .018, 'productivity': .024}, 'R&D grants awarded to tech labs and universities.', 'R&D Flow')
        elif action == 'energy_subsidy':
            self.debt += 4
            self.add_impulse('Targeted Energy Relief', 5, {'inflation': -.008, 'consumption': .010, 'government': .010, 'emissions': .012}, 'Temporary energy relief targets vulnerable households and essential firms.', 'Energy Relief')
        elif action == 'macroprudential_up':
            self.macroprudential_level = clamp(self.macroprudential_level + .18, 0, 1)
            self.bank_health = clamp(self.bank_health + .025, .1, 1)
            self.add_impulse('Macroprudential Tightening', 5, {'credit': -.055, 'investment': -.010, 'inflation': -.004}, 'Loan-to-value and bank risk rules tightened.', 'Financial Stability')
        elif action == 'mortgage_tighten':
            self.mortgage_regulation = clamp(self.mortgage_regulation + .20, 0, 1)
            self.add_impulse('Mortgage Standards', 5, {'credit': -.025, 'consumption': -.004, 'inflation': -.002}, 'Mortgage underwriting and speculative lending standards tightened.', 'Housing Credit')
        elif action == 'wealth_tax_up':
            self.add_impulse('Temporary Wealth Surcharge', 6, {'revenue': .018, 'inequality': -.014, 'consumption': -.006, 'investment': -.010}, 'Temporary progressive wealth surcharge enacted.', 'Progressive Revenue')
        elif action == 'payroll_tax_cut':
            self.debt += 3
            self.add_impulse('Employer Payroll Tax Cut', 6, {'unemployment': -.012, 'consumption': .012, 'revenue': -.012, 'potential': .006}, 'Temporary payroll tax relief lowers the cost of hiring.', 'Hiring Incentive')
        elif action == 'fdi_incentives':
            self.debt += 2
            self.fdi_level = clamp(self.fdi_level + .16, 0, 1)
            self.add_impulse('FDI Incentives', 10, {'investment': .045, 'potential': .015, 'confidence': .018, 'fx': -.010}, 'Foreign direct investment incentives target productive capital and export capacity.', 'Capital Inflow')
        elif action == 'business_reform':
            self.corruption = clamp(self.corruption - .01, .01, .6)
            self.add_impulse('Business Climate Reform', 12, {'investment': .025, 'potential': .022, 'confidence': .025, 'productivity': .012}, 'Licensing, competition and firm-entry rules modernized.', 'Structural Reform')
        elif action == 'food_reserve':
            self.debt += 3
            self.food_security = clamp(getattr(self,'food_security',.75)+.10,0,1)
            self.add_impulse('Strategic Food Reserve', 8, {'inflation': -.004, 'imports': .012, 'confidence': .010}, 'Strategic food stocks expanded to buffer supply shocks.', 'Resilience Buffer')
        elif action == 'childcare_support':
            self.debt += 4
            self.add_impulse('Childcare & Labor Participation', 10, {'unemployment': -.007, 'potential': .010, 'consumption': .006, 'inequality': -.006}, 'Childcare support expands labor-force participation and household work capacity.', 'Labor Supply')
        else:
            super().enact(action)

    def enact(self, action: str):
        allowed, reason = self.can_enact(action)
        if not allowed:
            self.last_policy_message = reason
            self.add_chirp('@cabinet_desk: ' + reason)
            return False

        before = (self.real_gdp, self.inflation, self.unemployment, self.debt_ratio)
        self._commit_action_cost(action)
        self._apply_action_effect(action)

        label = ACTION_LABEL.get(action, action.replace('_', ' ').title())
        self.last_policy_message = f'Enacted: {label}'
        self.decision_log.appendleft((self.year, self.quarter, label, before))
        return True

    def can_enact_package(self, package_id: str) -> Tuple[bool, str]:
        package = POLICY_PACKAGES.get(package_id)
        if not package:
            return False, 'Unknown combined policy package.'
        if self.game_status != 'RUNNING':
            return False, f'Game is {self.game_status.lower()}: {self.game_over_reason}'
        cd = self.package_cooldowns.get(package_id, 0)
        if cd > 0:
            return False, f"{package['name']} is on cooldown for {cd} more quarter(s)."
        if self.policy_capacity < package['capacity_cost']:
            return False, f"Need {package['capacity_cost']:.0f} policy capacity; only {self.policy_capacity:.0f} available."
        if self.political_capital < package['political_cost']:
            return False, f"Need {package['political_cost']:.0f} political capital; only {self.political_capital:.0f} available."
        if 'support_fx' in package['actions'] and self.treasury < 5:
            return False, 'FX defense inside this package requires at least $5B of treasury reserves.'
        if 'anti_corruption' in package['actions'] and self.political_capital < package['political_cost'] + 2:
            return False, 'This reform package needs a little more political room to pass governance legislation.'
        return True, 'Ready'

    def enact_package(self, package_id: str):
        allowed, reason = self.can_enact_package(package_id)
        if not allowed:
            self.last_policy_message = reason
            self.add_chirp('@cabinet_desk: ' + reason)
            return False
        package = POLICY_PACKAGES[package_id]
        before = (self.real_gdp, self.inflation, self.unemployment, self.debt_ratio)
        self.policy_capacity = clamp(self.policy_capacity - package['capacity_cost'], 0, self.max_policy_capacity)
        self.political_capital = clamp(self.political_capital - package['political_cost'], 0, 100)
        self.package_cooldowns[package_id] = package['cooldown']
        # Component cooldowns stop a package from being followed immediately by the same individual levers.
        for action in package['actions']:
            rule = POLICY_ACTION_RULES.get(action, PolicyActionSpec(16, 3, 1))
            self.action_cooldowns[action] = max(self.action_cooldowns.get(action, 0), max(1, rule.cooldown))
            self._apply_action_effect(action)
        label = package['name']
        self.last_policy_message = f"Combined policy enacted: {label}"
        self.add_news(f"Cabinet package approved: {label}. {package['description']}")
        self.add_chirp('@cabinet_desk: Multi-policy package deployed; transmission effects will arrive at different speeds.')
        self.decision_log.appendleft((self.year, self.quarter, label, before))
        return True

    def custom_mix_cost(self, actions):
        actions = tuple(dict.fromkeys(actions))
        capacity = sum(POLICY_ACTION_RULES.get(a, PolicyActionSpec(16,3,1)).capacity_cost for a in actions) * .72
        political = sum(POLICY_ACTION_RULES.get(a, PolicyActionSpec(16,3,1)).political_cost for a in actions) * .80
        return round(capacity, 1), round(political, 1)

    def can_enact_custom_mix(self, actions):
        actions = tuple(dict.fromkeys(actions))
        if not 2 <= len(actions) <= 4:
            return False, 'Cabinet Mix requires 2–4 individual policies.'
        if self.game_status != 'RUNNING':
            return False, f'Game is {self.game_status.lower()}: {self.game_over_reason}'
        for action in actions:
            if action not in POLICY_ACTION_RULES:
                return False, f'{action} cannot be placed in a custom cabinet mix.'
            cd = self.action_cooldowns.get(action, 0)
            if cd > 0:
                return False, f'{ACTION_LABEL.get(action,action)} is on cooldown for {cd}Q.'
            if action == 'debt_restructure' and self.debt_ratio < .90:
                return False, 'Debt restructuring requires debt/GDP of at least 90%.'
            if action == 'sanction_relief' and self.sanction_level < .08:
                return False, 'Sanctions relief is unavailable without material sanctions.'
            rule = POLICY_ACTION_RULES[action]
            if self.treasury < rule.minimum_treasury:
                return False, f'Treasury is too low for {ACTION_LABEL.get(action,action)}.'
        capacity, political = self.custom_mix_cost(actions)
        if self.policy_capacity < capacity:
            return False, f'Custom mix needs {capacity:.0f} policy capacity; {self.policy_capacity:.0f} available.'
        if self.political_capital < political:
            return False, f'Custom mix needs {political:.0f} political capital; {self.political_capital:.0f} available.'
        return True, 'Ready'

    def enact_custom_mix(self, actions):
        actions = tuple(dict.fromkeys(actions))
        allowed, reason = self.can_enact_custom_mix(actions)
        if not allowed:
            self.last_policy_message = reason
            self.add_chirp('@cabinet_desk: ' + reason)
            return False
        capacity, political = self.custom_mix_cost(actions)
        before = (self.real_gdp, self.inflation, self.unemployment, self.debt_ratio)
        self.policy_capacity = clamp(self.policy_capacity - capacity, 0, self.max_policy_capacity)
        self.political_capital = clamp(self.political_capital - political, 0, 100)
        labels = []
        for action in actions:
            rule = POLICY_ACTION_RULES[action]
            self.action_cooldowns[action] = max(1, rule.cooldown)
            self._apply_action_effect(action)
            labels.append(ACTION_LABEL.get(action, action.replace('_',' ').title()))
        label = 'Cabinet Mix: ' + ' + '.join(labels)
        self.last_policy_message = f'Custom policy mix enacted ({len(actions)} levers).'
        self.add_news('Cabinet approved a custom policy mix: ' + ', '.join(labels) + '.')
        self.add_chirp('@cabinet_desk: Custom mix launched. Effects arrive on different timelines; avoid stacking another major package immediately.')
        self.decision_log.appendleft((self.year, self.quarter, label, before))
        return True

    def pillar_scores(self):
        inflation = clamp(1 - abs(self.inflation - .025) / .08, 0, 1)
        debt = clamp(1 - max(0, self.debt_ratio - .65) / 1.05, 0, 1)
        fx = clamp(1 - abs(self.exchange_rate - 1.0) / .75, 0, 1)
        stability = 100 * (.34*inflation + .28*clamp(self.bank_health,0,1) + .22*debt + .16*fx)

        growth = clamp(.52 + self.gdp_growth * 5.0, 0, 1)
        jobs = clamp(1 - max(0, self.unemployment - .045) / .14, 0, 1)
        productivity = clamp((getattr(self,'productivity_level',1.0) - .75) / .65, 0, 1)
        prosperity = 100 * (.36*growth + .30*jobs + .22*productivity + .12*clamp(self.business_confidence,0,1))

        poverty = clamp(1 - self.poverty / .30, 0, 1)
        inequality = clamp(1 - max(0, self.inequality - .27) / .35, 0, 1)
        housing = clamp(getattr(self.housing,'affordability',.7) / 1.05, 0, 1)
        society = 100 * (.35*poverty + .25*inequality + .25*housing + .15*clamp(self.approval,0,1))

        energy = clamp(self.energy_security,0,1)
        food = clamp(getattr(self,'food_security',.75),0,1)
        external = clamp(1 - self.trade_disruption*.7 - self.external_risk*.25, 0, 1)
        institutions = clamp(.55*self.central_bank_credibility + .45*(1-self.corruption),0,1)
        resilience = 100 * (.28*energy + .22*food + .25*external + .25*institutions)
        return {'Stability': stability, 'Prosperity': prosperity, 'Society': society, 'Resilience': resilience}

    def legacy_report(self):
        pillars = self.pillar_scores()
        stats = self.career_stats
        q = max(1, stats.get('quarters', 0))
        averages = {
            'growth': stats.get('growth_sum',0)/q,
            'inflation': stats.get('inflation_sum',0)/q,
            'unemployment': stats.get('unemployment_sum',0)/q,
        }
        weakest = min(pillars, key=pillars.get)
        strongest = max(pillars, key=pillars.get)
        if min(pillars.values()) >= 68:
            title = 'Broad-Based Prosperity'
        elif pillars['Prosperity'] >= 72 and pillars['Stability'] < 52:
            title = 'Growth at a Cost'
        elif pillars['Stability'] >= 72 and pillars['Society'] < 52:
            title = 'Stable, Uneven Economy'
        elif pillars['Resilience'] >= 72:
            title = 'Resilient Reformer'
        elif pillars['Stability'] < 42:
            title = 'Volatile Mandate'
        else:
            title = 'Mixed Economic Legacy'
        return {
            'title': title, 'pillars': pillars, 'averages': averages,
            'strongest': strongest, 'weakest': weakest,
            'missions_completed': getattr(self.missions,'completed',0),
            'mission_score': getattr(self.missions,'score',0),
            'quarters': stats.get('quarters',0),
            'start': dict(self.start_snapshot),
            'end': {
                'real_gdp': self.real_gdp, 'inflation': self.inflation, 'unemployment': self.unemployment,
                'debt_ratio': self.debt_ratio, 'poverty': self.poverty, 'inequality': self.inequality,
                'housing_affordability': self.housing.affordability, 'technology_index': self.technology_index,
                'energy_security': self.energy_security, 'emissions': self.emissions, 'exports': self.exports,
            }
        }

    def current_objective(self):
        return self.missions.current(self)

    def _update_game_score(self):
        inflation_score = clamp(1 - abs(self.inflation - .025) / .09, 0, 1)
        jobs_score = clamp(1 - max(0, self.unemployment - .045) / .14, 0, 1)
        growth_score = clamp(.55 + self.gdp_growth * 4.5, 0, 1)
        debt_score = clamp(1 - max(0, self.debt_ratio - .65) / 1.0, 0, 1)
        bank_score = clamp(self.bank_health, 0, 1)
        social_score = clamp(.55 * self.approval + .45 * (1 - self.poverty / .30), 0, 1)
        external_score = clamp(1 - self.trade_disruption * .6 - max(0, self.external_risk - .2) * .4, 0, 1)
        self.stability_score = 100 * (
            .23 * inflation_score + .18 * jobs_score + .14 * growth_score + .14 * debt_score +
            .12 * bank_score + .12 * social_score + .07 * external_score
        )
        self.national_score = clamp(
            .58 * self.stability_score + .22 * self.competitive_score + .20 * self.missions.score, 0, 100
        )

    def _update_game_state(self, election_event: Optional[str]):
        if self.game_mode == 'sandbox':
            # Sandbox has no fixed mandate or election game-over. Crises remain recoverable.
            if election_event and election_event.startswith('Election lost'):
                self.political_capital = clamp(self.political_capital - 8, 0, 100)
                self.add_news('Sandbox government reshuffle after election defeat; simulation continues.')
            self.game_status = 'RUNNING'
            self.game_over_reason = ''
            return
        if election_event and election_event.startswith('Election lost'):
            self.game_status = 'LOST'
            self.game_over_reason = election_event
            return
        systemic = self.bank_health < .20 or (self.debt_ratio > 1.80 and self.treasury < -10)
        self.systemic_failure_quarters = self.systemic_failure_quarters + 1 if systemic else 0
        if self.systemic_failure_quarters >= 2:
            self.game_status = 'LOST'
            self.game_over_reason = 'Systemic fiscal/financial collapse persisted for two quarters.'
            return
        if self.turns_survived >= 32:
            if self.missions.score >= 60 and self.missions.completed >= 3 and self.stability_score >= 66 and self.approval >= .45:
                self.game_status = 'WON'
                self.game_over_reason = f'Eight-year mandate completed: {self.missions.completed} missions delivered with macro stability.'
            else:
                self.game_status = 'LOST'
                self.game_over_reason = f'Mandate expired: missions {self.missions.completed}, mission score {self.missions.score}, stability {self.stability_score:.0f}/100.'

    def step_quarter(self):
        if self.game_status != 'RUNNING':
            return
        pre = {
            'gdp': self.real_gdp, 'inflation': self.inflation, 'unemployment': self.unemployment,
            'debt_ratio': self.debt_ratio, 'approval': self.approval
        }
        super().step_quarter()
        self.turns_survived += 1
        self.career_stats['quarters'] += 1
        self.career_stats['growth_sum'] += self.gdp_growth
        self.career_stats['inflation_sum'] += self.inflation
        self.career_stats['unemployment_sum'] += self.unemployment
        if getattr(self, 'crisis_level', 0) > .25:
            self.career_stats['crisis_quarters'] += 1

        # Policy capacity and legislative energy recover gradually each quarter.
        self.policy_capacity = clamp(self.policy_capacity + 32 + 6 * max(0, self.approval - .50), 0, self.max_policy_capacity)
        self.action_cooldowns = {k: max(0, v - 1) for k, v in self.action_cooldowns.items() if v > 1}
        self.package_cooldowns = {k: max(0, v - 1) for k, v in self.package_cooldowns.items() if v > 1}

        if self.inflation < 0.012: self.inflation_regime = 'Deflation / Low'
        elif self.inflation <= .035: self.inflation_regime = 'Price Stable'
        elif self.inflation <= .06: self.inflation_regime = 'Elevated Inflation'
        else: self.inflation_regime = 'High Inflation'
        self.price_stability_score = clamp(1 - abs(self.inflation - .025) / .08, 0, 1)
        self.technology_index = clamp(self.technology_index + .20 * self.research_level + .06 * (self.policy.education_spending / .06 - 1) + random.uniform(-.08, .08), 40, 100)
        self.productivity_level = clamp(self.productivity_level * (1 + .0015 + .0012 * self.research_level), .7, 1.7)
        self.rival.step(self)
        self.sectors.step(self)
        self.mpc.deliberate(self)
        self.missions.update(self)
        comp = (self.technology_index / max(45, self.rival.technology)) * clamp(1 - self.trade_disruption * .35, .55, 1.1)
        self.exports = max(45, self.exports * (1 + clamp((comp - 1) * .006, -.012, .012)))
        election_event = self.elections.step(self)
        if election_event:
            self.add_news('Elections: ' + election_event)
        self.housing_support_level *= .94
        self.public_transport_level *= .96
        self.research_level *= .97
        self.macroprudential_level *= .90
        self.mortgage_regulation *= .90
        self.fdi_level *= .96

        self._update_game_score()
        self._update_game_state(election_event)
        self.last_quarter_report = {
            'period': f'Q{self.quarter} {self.year}',
            'gdp_change': self.real_gdp - pre['gdp'],
            'inflation_change': self.inflation - pre['inflation'],
            'unemployment_change': self.unemployment - pre['unemployment'],
            'debt_change': self.debt_ratio - pre['debt_ratio'],
            'approval_change': self.approval - pre['approval'],
            'stability_score': self.stability_score,
            'national_score': self.national_score,
        }
        if self.game_status != 'RUNNING':
            self.add_news(f'GAME {self.game_status}: {self.game_over_reason}')

    @property
    def competitive_score(self):
        return clamp(50 + 180 * (self.gdp_growth - self.rival.gdp_growth) + .35 * (self.technology_index - self.rival.technology) + .08 * (self.exports - self.rival.exports) - .35 * abs(self.inflation - .025) * 100, 0, 100)



class EconomyV12(EconomyV11):
    """Systems-edition layer.

    V12 deliberately keeps the proven V11 accounting/gameplay model intact and adds
    a small set of economically interpretable state variables that tie together
    inflation expectations, sovereign risk, banking stress and financial conditions.
    The layer is intentionally conservative: it improves transmission and diagnostics
    without replacing the mission/policy systems players already understand.
    """
    def __post_init__(self):
        super().__post_init__()
        self.inflation_target = 0.025
        self.neutral_real_rate = 0.018
        self.natural_unemployment = 0.050
        self.sovereign_spread = 0.012
        self.bank_lending_spread = 0.028
        self.real_policy_rate_v12 = self.policy.policy_rate - self.expected_inflation
        self.financial_conditions_index = 50.0
        self.household_stress_index = 25.0
        self.macro_risk_score = 24.0
        self.expectations_anchor = clamp(self.central_bank_credibility, 0, 1)
        self.macro_regime = 'Balanced Expansion'
        self._v12_last_inflation = self.inflation
        self._v12_last_policy_rate = self.policy.policy_rate
        self._v12_policy_reversal_penalty = 0.0
        self.add_news('Systems Edition: expectations, sovereign spreads and financial conditions are now tracked explicitly.')

    def _update_v12_foundations(self):
        # Credibility and expectations: inflation close to target re-anchors beliefs,
        # while persistent misses or abrupt rate reversals weaken the nominal anchor.
        inflation_gap = abs(self.inflation - self.inflation_target)
        current_rate = self.policy.policy_rate
        rate_change = current_rate - self._v12_last_policy_rate
        previous_change = getattr(self, '_v12_prev_rate_change', 0.0)
        reversed_policy = rate_change * previous_change < -1e-7 and abs(rate_change) > 0.0025 and abs(previous_change) > 0.0025
        self._v12_policy_reversal_penalty = 0.018 if reversed_policy else self._v12_policy_reversal_penalty * 0.65
        credibility_delta = 0.006 - 0.22 * max(0, inflation_gap - 0.012) - self._v12_policy_reversal_penalty
        if self.inflation > 0.08:
            credibility_delta -= 0.008
        self.central_bank_credibility = clamp(self.central_bank_credibility + credibility_delta, 0.20, 1.0)
        self.expectations_anchor = clamp(self.central_bank_credibility * (1 - min(0.65, self.external_risk * .35)), 0.15, 1.0)
        anchor_inflation = self.expectations_anchor * self.inflation_target + (1-self.expectations_anchor) * self.inflation
        self.expected_inflation = clamp(0.82*self.expected_inflation + 0.18*anchor_inflation, -0.01, 0.22)

        # Sovereign and bank spreads react to fiscal, external and balance-sheet risk.
        debt_stress = max(0.0, self.debt_ratio - 0.70)
        fx_stress = max(0.0, abs(self.exchange_rate - 1.0) - 0.06)
        bank_stress = max(0.0, 0.72 - self.bank_health)
        inflation_stress = max(0.0, self.inflation - 0.045)
        spread_target = 0.010 + 0.040*debt_stress + 0.030*bank_stress + 0.020*fx_stress + 0.12*inflation_stress + 0.018*self.external_risk
        self.sovereign_spread = clamp(0.72*self.sovereign_spread + 0.28*spread_target, 0.004, 0.18)
        bank_target = 0.020 + 0.055*bank_stress + 0.030*max(0, -self.credit_growth) + 0.025*self.crisis_level + (0.025 if self.bank_run else 0)
        self.bank_lending_spread = clamp(0.70*self.bank_lending_spread + 0.30*bank_target, 0.012, 0.20)

        # Long bond yields now carry a transparent risk-premium channel.
        long_rate_target = max(current_rate, self.neutral_real_rate + self.expected_inflation + self.sovereign_spread)
        self.bond_yield = clamp(0.72*self.bond_yield + 0.28*long_rate_target, 0.0, 0.30)
        self.real_policy_rate_v12 = current_rate - self.expected_inflation

        # A compact financial-conditions index: 50 is neutral, higher is tighter.
        tightness = (
            360*(self.real_policy_rate_v12-self.neutral_real_rate)
            + 420*(self.sovereign_spread-0.010)
            + 300*(self.bank_lending_spread-0.020)
            + 18*fx_stress + 22*bank_stress
        )
        self.financial_conditions_index = clamp(50 + tightness, 0, 100)

        # Household stress combines labor, prices, housing and debt-service pressure.
        real_wage = self.wage_growth - self.inflation
        housing_stress = max(0.0, 0.72 - getattr(self.housing, 'affordability', 0.72))
        self.household_stress_index = clamp(
            18 + 290*max(0, self.unemployment-self.natural_unemployment)
            + 240*max(0, -real_wage)
            + 42*housing_stress
            + 95*max(0, self.bank_lending_spread-0.025), 0, 100
        )

        # Economic regime label used by the HUD and Advisor context.
        if self.gdp_growth < -0.01 and self.inflation > 0.05:
            self.macro_regime = 'Stagflation'
        elif self.gdp_growth < 0 and self.unemployment > 0.065:
            self.macro_regime = 'Recession'
        elif self.output_gap > 0.025 and self.inflation > 0.04:
            self.macro_regime = 'Overheating'
        elif self.gdp_growth > 0.03 and self.inflation <= 0.04:
            self.macro_regime = 'Strong Expansion'
        elif self.inflation < 0.012:
            self.macro_regime = 'Low-Inflation Slowdown'
        elif self.financial_conditions_index > 68:
            self.macro_regime = 'Tight Financial Conditions'
        else:
            self.macro_regime = 'Balanced Expansion'

        self.macro_risk_score = clamp(
            100*(0.20*min(1, abs(self.inflation-self.inflation_target)/0.08)
                 + 0.16*min(1, max(0,self.unemployment-.05)/.12)
                 + 0.17*min(1, max(0,self.debt_ratio-.65)/1.0)
                 + 0.16*(1-clamp(self.bank_health,0,1))
                 + 0.13*min(1,self.trade_disruption)
                 + 0.10*min(1,self.external_risk)
                 + 0.08*min(1,self.household_stress_index/100)), 0, 100)

        self._v12_prev_rate_change = rate_change
        self._v12_last_policy_rate = current_rate
        self._v12_last_inflation = self.inflation
        if isinstance(getattr(self, 'last_quarter_report', None), dict):
            self.last_quarter_report.update({
                'macro_regime': self.macro_regime,
                'financial_conditions': self.financial_conditions_index,
                'sovereign_spread': self.sovereign_spread,
                'bank_lending_spread': self.bank_lending_spread,
                'real_policy_rate': self.real_policy_rate_v12,
                'household_stress': self.household_stress_index,
                'macro_risk': self.macro_risk_score,
            })

    def step_quarter(self):
        if self.game_status != 'RUNNING':
            return
        super().step_quarter()
        self._update_v12_foundations()

@dataclass
class Business:
    key: str
    name: str
    sector: str
    cash: float
    debt: float
    inventory: float
    capacity: int
    wage_bill: float = 0.0
    revenue_q: float = 0.0
    costs_q: float = 0.0
    profit_q: float = 0.0
    employees: List[int] = field(default_factory=list)
    loans_q: float = 0.0
    sales_count: int = 0
    status: str = "Operating"
    last_event: str = "Stable operations"

    @property
    def equity(self):
        return self.cash + self.inventory - self.debt

    @property
    def utilization(self):
        return clamp(len(self.employees) / max(1, self.capacity), 0, 1.4)

class CityEconomy:
    def __init__(self, citizens):
        specs = {
            'bank': ('Commercial Banking Corp', 'Finance', 900, 680, 60, 18),
            'market': ('Central Urban Market', 'Retail', 420, 120, 190, 20),
            'restaurant': ('Metropolitan Food Group', 'Hospitality', 230, 85, 80, 15),
            'factory': ('Heavy Industries Plant', 'Manufacturing', 650, 360, 310, 28),
            'office': ('Technology & Corporate Services', 'Services', 520, 210, 70, 24),
            'farm': ('Agricultural Cooperative', 'Agriculture', 280, 100, 250, 20),
            'warehouse': ('National Freight & Logistics', 'Logistics', 350, 160, 220, 18),
            'port': ('Maritime Port Authority', 'Trade & Logistics', 760, 420, 330, 24),
            'airport': ('International Air Terminal', 'Transport', 640, 390, 120, 22),
            'hospital': ('Regional Medical Center', 'Healthcare', 380, 140, 45, 22),
            'university': ('National University Institute', 'Education', 310, 90, 30, 20),
            'school': ('City Educational District', 'Education', 220, 55, 20, 16),
            'power': ('National Energy Utility', 'Energy', 520, 280, 160, 18),
            'pharmacy': ('Health & Care Pharmacy', 'Healthcare', 180, 40, 75, 10),
            'fire_dept': ('Municipal Fire Station', 'Public Safety', 210, 30, 40, 12),
            'library': ('Central Public Library', 'Education', 140, 20, 30, 8),
            'stadium': ('National Sports Arena', 'Entertainment', 480, 190, 90, 16)
        }
        self.businesses = {k: Business(k, *v) for k, v in specs.items()}
        self.bank_key = 'bank'; self.total_transactions = 0; self.total_loans = 0.0
        self.cargo_manifest = deque(maxlen=8); self.social_events = deque(maxlen=8)
        self.quarter_turnover = 0.0
        self.assign_jobs(citizens, initial=True)

    def assign_jobs(self, citizens, initial=False):
        mapping = {'dockworker': 'port', 'sailor': 'port', 'fisher': 'port', 'chef': 'restaurant', 'waiter': 'restaurant', 'shopkeeper': 'market',
                   'doctor': 'hospital', 'nurse': 'pharmacy', 'teacher': 'school', 'professor': 'university', 'factory worker': 'factory',
                   'engineer': 'factory', 'banker': 'bank', 'trader': 'bank', 'farmer': 'farm', 'programmer': 'office', 'entrepreneur': 'office',
                   'firefighter': 'fire_dept', 'librarian': 'library', 'athlete': 'stadium'}
        for b in self.businesses.values(): b.employees = []
        for c in citizens:
            c.employer_key = None
            k = mapping.get(c.profession)
            if k and c.employed and k in self.businesses and len(self.businesses[k].employees) < self.businesses[k].capacity:
                c.employer_key = k; self.businesses[k].employees.append(c.id)

    def business_for_destination(self, dest):
        return self.businesses.get(dest)

    def household_visit(self, c, dest, e):
        b = self.business_for_destination(dest)
        if not b: return
        amount = 0.0
        if dest in {'restaurant', 'stadium'}: amount = random.uniform(3.0, 9.5)
        elif dest in {'market', 'pharmacy'}: amount = random.uniform(3.0, 11.0)
        elif dest == 'bank':
            if c.cash > 90:
                amount = random.uniform(4, 14); c.cash -= amount; c.assets += amount * .985; b.cash += amount * .015
                c.say('Deposit / invest', 1.8); self.total_transactions += 1; return
            elif c.cash < 25 and e.bank_health > .45:
                loan = random.uniform(10, 35) * e.bank_health
                c.cash += loan; c.debt += loan * 1.03; b.cash -= loan; b.debt = max(0, b.debt - loan * .04); c.bank_link_timer = 2.8
                b.loans_q += loan; self.total_loans += loan; c.say(f'Loan +${loan:.0f}', 2.0); self.total_transactions += 1; return
        elif dest == 'airport': amount = random.uniform(8, 18)
        elif dest == 'hospital': amount = random.uniform(1, 5)
        if amount > 0 and c.cash > 1:
            paid = min(c.cash, amount * (1 + max(0, e.inflation)))
            c.cash -= paid; b.cash += paid; b.revenue_q += paid; b.sales_count += 1; self.quarter_turnover += paid; self.total_transactions += 1
            c.say(f'{dest.title()} -${paid:.0f}', 1.35)
            if b.sector not in {'Finance', 'Education', 'Healthcare', 'Services', 'Public Safety'}: b.inventory = max(0, b.inventory - paid * .28)

    def maybe_social_interaction(self, a, b):
        if a.dialog_timer > 0 or b.dialog_timer > 0: return
        r = random.random()
        sellers = {'farmer', 'fisher', 'chef', 'shopkeeper', 'artist', 'entrepreneur'}
        if r < .010 and (a.profession in sellers or b.profession in sellers):
            seller = a if a.profession in sellers and (b.profession not in sellers or random.random() < .5) else b
            buyer = b if seller is a else a
            price = random.uniform(1.5, 5.5) * (1 + max(0, getattr(self, 'last_inflation', 0)))
            if buyer.cash > price + 3:
                buyer.cash -= price; seller.cash += price; buyer.happiness = clamp(buyer.happiness + .35, 5, 100)
                self.total_transactions += 1; self.quarter_turnover += price
                buyer.say(f'Bought -${price:.0f}', 1.7); seller.say(f'Sold +${price:.0f}', 1.7)
                buyer.peer_link_timer = seller.peer_link_timer = 1.6; buyer.peer_link_id = seller.id; seller.peer_link_id = buyer.id
                return
        if r < .014:
            rich, poor = (a, b) if a.cash > b.cash else (b, a)
            if rich.cash > 95 and poor.cash < 18 and poor.debt < 180:
                loan = min(random.uniform(4, 12), rich.cash - 70)
                if loan > 2:
                    rich.cash -= loan; rich.assets += loan * .012; poor.cash += loan; poor.debt += loan * 1.02
                    rich.say(f'Lent ${loan:.0f}', 1.7); poor.say(f'Borrowed ${loan:.0f}', 1.7)
                    rich.peer_link_timer = poor.peer_link_timer = 1.8; rich.peer_link_id = poor.id; poor.peer_link_id = rich.id

    def step_quarter(self, citizens, e):
        self.last_inflation = getattr(e, 'inflation', 0.0)
        by_id = {c.id: c for c in citizens}
        macro_demand = clamp(0.75 + e.gdp_growth * 4 + e.consumer_confidence * .35 - e.crisis_level * .30, 0.45, 1.35)
        for b in self.businesses.values():
            sector_bonus = 1.0
            if b.key == 'port': sector_bonus = clamp((e.exports + e.imports) / 220, 0.35, 1.7) * (1 - e.trade_disruption * .7)
            elif b.key == 'factory': sector_bonus = clamp(e.business_confidence + .45, 0.55, 1.35)
            elif b.key in {'restaurant', 'market'}: sector_bonus = clamp(e.consumer_confidence + .45, 0.55, 1.35)
            elif b.key == 'airport': sector_bonus = clamp(.7 + e.consumer_confidence * .4 + max(0, e.exports / 200), .55, 1.45)
            wage = 0.0
            for cid in list(b.employees):
                c = by_id.get(cid)
                if c and c.employed:
                    # Household cash income is booked once in CitizenV4.macro_update; this is the employer-side cost.
                    wage += c.income * (1 + e.wage_growth / 4)
            baseline = (45 + 1.35 * wage + 1.2 * b.capacity) * macro_demand * sector_bonus
            b.revenue_q += baseline
            input_cost = (18 + b.capacity * .7) * max(.70, e.price_index / 100.0) * (1 + e.trade_disruption * .25)
            interest = max(0, b.debt) * (e.policy.policy_rate / 4)
            b.wage_bill = wage; b.costs_q = wage + input_cost + interest; b.profit_q = b.revenue_q - b.costs_q
            b.cash += b.profit_q
            b.inventory = max(0, b.inventory + max(8, b.capacity * 2.4) * (1 - e.trade_disruption * .45) - b.sales_count * .8)
            if b.cash < 35 and e.bank_health > .5 and b.key != 'bank':
                loan = min(90, 45 - b.cash + random.uniform(8, 25))
                b.cash += loan; b.debt += loan; self.businesses['bank'].cash -= loan; self.businesses['bank'].loans_q += loan
                self.total_loans += loan; b.last_event = f'Credit line +${loan:.0f}'
            desired = int(clamp(b.capacity * (.55 + .32 * macro_demand * sector_bonus), 2, b.capacity))
            if b.profit_q < -30: desired = max(2, desired - 2)
            current = [by_id[cid] for cid in b.employees if cid in by_id and by_id[cid].employed]
            if len(current) > desired:
                for c in random.sample(current, min(len(current) - desired, 2)):
                    c.employed = False; c.employer_key = None; c.say('Laid off', 2.8); c.activity = 'Job hunting'; b.last_event = 'Cost-cutting layoffs'
            elif len(current) < desired and b.profit_q > -20:
                skill_map = {'bank': {'banker', 'trader', 'programmer'}, 'market': {'shopkeeper', 'waiter', 'taxi driver'}, 'restaurant': {'chef', 'waiter'}, 'factory': {'factory worker', 'engineer', 'builder'}, 'office': {'programmer', 'entrepreneur', 'engineer', 'artist'}, 'farm': {'farmer'}, 'port': {'dockworker', 'sailor', 'fisher'}, 'airport': {'taxi driver', 'engineer', 'civil servant'}, 'hospital': {'doctor', 'nurse'}, 'university': {'professor', 'teacher'}, 'school': {'teacher'}, 'warehouse': {'dockworker', 'builder', 'taxi driver'}, 'power': {'engineer', 'builder'}, 'pharmacy': {'nurse', 'doctor', 'shopkeeper'}, 'fire_dept': {'firefighter', 'builder', 'police'}, 'library': {'librarian', 'teacher', 'student'}, 'stadium': {'athlete', 'coach', 'builder'}}
                preferred = skill_map.get(b.key, set())
                candidates = [c for c in citizens if not c.employed and c.profession in preferred]
                if not candidates: candidates = [c for c in citizens if not c.employed and c.profession not in {'student', 'shinobi'}]
                for c in random.sample(candidates, min(desired - len(current), 2, len(candidates))):
                    c.employed = True; c.employer_key = b.key; c.say('Hired: ' + b.name[:10], 2.6); b.employees.append(c.id); b.last_event = 'Payroll expanded'
            if b.cash < -80: b.status = 'Distressed'; b.last_event = 'Liquidity distress'
            elif b.profit_q < 0: b.status = 'Loss-making'
            else: b.status = 'Operating'
            b.revenue_q = 0.0; b.sales_count = 0; b.loans_q = 0.0
        self.assign_jobs(citizens)
        n = max(1, int(clamp((e.exports + e.imports) / 85, 1, 6) * (1 - e.trade_disruption * .6)))
        goods = ['Machinery', 'Food', 'Energy', 'Electronics', 'Medicine', 'Textiles', 'Auto parts']
        for _ in range(n):
            direction = 'EXPORT' if random.random() < e.exports / max(1, e.exports + e.imports) else 'IMPORT'
            value = random.uniform(8, 38) * (1 - e.trade_disruption * .4)
            self.cargo_manifest.appendleft((direction, random.choice(goods), value, e.year, e.quarter))
        firms = list(self.businesses.values())
        distressed = sum(b.status == 'Distressed' for b in firms) / len(firms)
        e.business_confidence = clamp(e.business_confidence - distressed * .025 + sum(b.profit_q > 0 for b in firms) / len(firms) * .003, 0.1, .95)
        e.bank_health = clamp(e.bank_health - distressed * .012, 0.1, 1)
        normalized_turnover = self.quarter_turnover / max(1, len(citizens) * 12.0)
        e.micro_consumption_multiplier = clamp(0.94 + 0.14 * normalized_turnover, 0.88, 1.18)
        self.quarter_turnover = 0.0