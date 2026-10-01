import pygame
import random
import math
from economy import clamp, money, pct, lerp, LaggedImpulse, Economy, POLICY_ACTION_RULES, ACTION_LABEL, POLICY_PACKAGES

WIDTH, HEIGHT = 1440, 900
FPS = 60
SIM_H = 610
PANEL_W = 390

BG = (14, 18, 26)
CITY_BG = (20, 29, 38)
PANEL = (22, 27, 36)
CARD = (29, 36, 47)
CARD2 = (35, 43, 56)
GRID = (55, 64, 78)
TEXT = (232, 238, 246)
MUTED = (151, 162, 178)
GREEN = (65, 190, 110)
RED = (235, 92, 92)
YELLOW = (240, 192, 80)
BLUE = (75, 145, 245)
PURPLE = (169, 115, 235)
CYAN = (72, 198, 210)
ORANGE = (236, 137, 70)
ROAD = (56, 62, 72)
WHITE = (248, 250, 252)

_FONT_CACHE = {}

def cached_font(size, bold=False):
    key = (size, bold)
    font = _FONT_CACHE.get(key)
    if font is None:
        font = pygame.font.SysFont('segoeui', size, bold=bold)
        _FONT_CACHE[key] = font
    return font


def shade_color(color, factor):
    return tuple(clamp(int(v * factor), 0, 255) for v in color)

def draw_extruded_box(surf, rect, color, depth=12, lift=8, border=None):
    """Pseudo-3D prism that keeps the original 2D collision footprint unchanged."""
    x, y, w, h = rect
    dx, dy = depth, -lift
    shadow = pygame.Rect(x + 7, y + 9, w + depth, h + 5)
    pygame.draw.rect(surf, (12, 16, 22), shadow, border_radius=8)
    right = [(x+w, y), (x+w+dx, y+dy), (x+w+dx, y+h+dy), (x+w, y+h)]
    roof = [(x, y), (x+dx, y+dy), (x+w+dx, y+dy), (x+w, y)]
    pygame.draw.polygon(surf, shade_color(color, .62), right)
    pygame.draw.polygon(surf, shade_color(color, 1.18), roof)
    pygame.draw.rect(surf, color, rect, border_radius=8)
    if border is not None:
        pygame.draw.rect(surf, border, rect, 2, border_radius=8)

WORLD_W, WORLD_H = 2000, 1120
DESIGN_W, DESIGN_H = 1560, 940

JOB_PROFILES = {
    "farmer": (0.75, 0.55), "fisher": (0.82, 0.50), "dockworker": (0.92, 0.52),
    "sailor": (1.00, 0.56), "chef": (0.90, 0.58), "waiter": (0.68, 0.48),
    "shopkeeper": (1.05, 0.62), "teacher": (1.05, 0.63), "professor": (1.55, 0.74),
    "doctor": (1.85, 0.78), "nurse": (1.15, 0.66), "police": (1.10, 0.62),
    "engineer": (1.55, 0.73), "factory worker": (0.92, 0.54), "banker": (1.80, 0.80),
    "trader": (1.65, 0.82), "programmer": (1.55, 0.76), "builder": (1.00, 0.58),
    "taxi driver": (0.86, 0.54), "civil servant": (1.08, 0.63), "artist": (0.82, 0.57),
    "entrepreneur": (2.10, 0.90), "student": (0.35, 0.35), "unemployed": (0.25, 0.25),
    "shinobi": (1.22, 0.66), "firefighter": (1.12, 0.65), "librarian": (0.95, 0.52),
    "athlete": (1.40, 0.72)
}

JOB_WEIGHTS = {
    "farmer": 7, "fisher": 3, "dockworker": 4, "sailor": 2,
    "chef": 4, "waiter": 4, "shopkeeper": 5, "teacher": 4,
    "professor": 3, "doctor": 3, "nurse": 4, "police": 4,
    "engineer": 5, "factory worker": 7, "banker": 3, "trader": 3,
    "programmer": 5, "builder": 4, "taxi driver": 4,
    "civil servant": 3, "artist": 2, "entrepreneur": 4,
    "student": 4, "unemployed": 4, "shinobi": 2, "firefighter": 3,
    "librarian": 2, "athlete": 2
}

def choose_profession():
    jobs = list(JOB_PROFILES)
    weights = [JOB_WEIGHTS.get(job, 1) for job in jobs]
    return random.choices(jobs, weights=weights, k=1)[0]

FIRST_NAMES = ["Aiko","Hana","Ren","Kenji","Mika","Yuki","Daichi","Emi","Hiro","Sora","Nami","Akira","Rin","Taro","Mei","Kenta","Aya","Riku","Yuna","Haruto"]
SPECIALS = ["Naruto","Sasuke","Sakura","Kakashi","Shikamaru","Guy","Jiraiya","Tsunade","Hokage Guard"]

HOUSE_TYPES = {
    'shack': {'label':'Low-Income Shack','size':(34,24),'color':(115,100,90),'tier':'poor'},
    'apartment': {'label':'Urban Apartment','size':(40,30),'color':(110,125,145),'tier':'mid'},
    'townhouse': {'label':'Mid Townhouse','size':(46,34),'color':(165,120,85),'tier':'mid'},
    'villa': {'label':'Luxury Estate','size':(66,48),'color':(210,195,155),'tier':'rich'},
}

class Home:
    def __init__(self,hid,x,y,kind='townhouse',tier='mid'):
        self.id=hid;self.x=x;self.y=y;self.kind=kind;self.tier=tier
        self.label=HOUSE_TYPES[kind]['label'];self.residents=[]
        self.value={'shack':45,'apartment':85,'townhouse':130,'villa':360}[kind]*random.uniform(.85,1.20)
    @property
    def anchor(self):return (self.x,self.y)
    def draw(self,s,night=False,depth_mode=False):
        w,h=HOUSE_TYPES[self.kind]['size'];c=HOUSE_TYPES[self.kind]['color']
        x=int(self.x-w/2);y=int(self.y-h/2)
        if depth_mode:
            draw_extruded_box(s, (x,y,w,h), c, depth=8, lift=5)
        else:
            pygame.draw.rect(s,(20,24,30),(x+4,y+5,w,h),border_radius=4)
            pygame.draw.rect(s,c,(x,y,w,h),border_radius=4)
        roof=(115,55,45) if self.tier!='poor' else (85,75,70)
        pygame.draw.polygon(s,roof,[(x-3,y+2),(x+w//2,y-10),(x+w+3,y+2)])
        pygame.draw.rect(s,(65,48,35),(x+w//2-3,y+h-12,7,12))
        win=(247,215,115) if night and self.residents else (100,160,180)
        pygame.draw.rect(s,win,(x+6,y+8,7,7),border_radius=1)
        if self.tier=='rich':
            pygame.draw.rect(s,(240,215,90),(x-4,y-4,w+8,h+8),1,border_radius=5)

class SwayTree:
    def __init__(self,x,y,scale=1.0):self.x=x;self.y=y;self.scale=scale;self.phase=random.uniform(0,math.tau)
    def draw(self,s,t,wind=1.0):
        sway=math.sin(t*1.8+self.phase)*5*self.scale*wind
        trunk=(int(self.x),int(self.y));top=(int(self.x+sway),int(self.y-24*self.scale))
        pygame.draw.line(s,(99,67,42),trunk,top,max(2,int(5*self.scale)))
        pygame.draw.circle(s,(43,112,62),(top[0],top[1]),int(13*self.scale))
        pygame.draw.circle(s,(52,128,70),(top[0]-8,top[1]+3),int(9*self.scale))
        pygame.draw.circle(s,(55,135,74),(top[0]+8,top[1]+4),int(8*self.scale))

class CityAnimal:
    def __init__(self,x,y,kind=None):
        self.x=x;self.y=y;self.kind=kind or random.choice(['dog','cat','cow','goat']);self.phase=random.uniform(0,math.tau);self.v=random.choice([-1,1]);self.base=x
    def update(self,dt):
        self.phase+=dt;self.x+=self.v*random.uniform(3,8)*dt
        if abs(self.x-self.base)>35:self.v*=-1
    def draw(self,s):
        x,y=int(self.x),int(self.y+math.sin(self.phase*3)*1.2)
        if self.kind in ('cow','goat'):
            pygame.draw.ellipse(s,(235,232,210),(x-8,y-5,17,10));pygame.draw.circle(s,(65,60,55),(x+8,y-2),4)
        else:
            c=(176,126,80) if self.kind=='dog' else (110,105,105);pygame.draw.ellipse(s,c,(x-6,y-4,13,8));pygame.draw.circle(s,c,(x+6,y-3),4);pygame.draw.line(s,c,(x-5,y),(x-10,y-5),2)

class FireTruck:
    def __init__(self):
        self.x=320.0;self.y=490.0;self.target_x=680.0;self.target_y=360.0;self.active=False;self.siren_phase=0.0
    def update(self,dt,active_fire):
        self.active=active_fire
        if not self.active:
            self.x=lerp(self.x,320.0,dt*2.5);self.y=lerp(self.y,490.0,dt*2.5);return
        self.siren_phase+=dt*10.0
        self.x=lerp(self.x,self.target_x+25,dt*3.2);self.y=lerp(self.y,self.target_y+60,dt*3.2)
    def draw(self,s):
        if not self.active and math.hypot(self.x-320,self.y-490)<5:
            return
        x,y=int(self.x),int(self.y)
        pygame.draw.rect(s,(215,45,45),(x-14,y-6,28,12),border_radius=3)
        pygame.draw.rect(s,(230,230,240),(x+6,y-5,6,10),border_radius=2)
        siren_col=(255,240,60) if int(self.siren_phase)%2==0 else (60,120,255)
        pygame.draw.circle(s,siren_col,(x-2,y-8),3)
        for wx in (x-8,x+8): pygame.draw.circle(s,(25,25,28),(wx,y+6),3)

class Motorcycle:
    H_ROADS=[285,535,810];V_ROADS=[100,620,1100];X_MIN=5;X_MAX=1328;Y_MIN=105;Y_MAX=1080
    def __init__(self):
        self.axis=random.choice(['h','v']);self.line=random.choice(self.H_ROADS if self.axis=='h' else self.V_ROADS);self.pos=random.uniform(30,1250 if self.axis=='h' else 1030);self.direction=random.choice([-1,1]);self.speed=random.uniform(105,155);self.cruise_speed=self.speed;self.turn_cd=0
        self.x=self.pos if self.axis=='h' else self.line;self.y=self.line if self.axis=='h' else self.pos
    def update(self,dt):
        self.turn_cd=max(0,self.turn_cd-dt);self.pos+=self.speed*self.direction*dt
        if self.axis=='h':
            self.pos=clamp(self.pos,self.X_MIN,self.X_MAX);self.x=self.pos;self.y=self.line
            if self.turn_cd<=0:
                near=[x for x in self.V_ROADS if abs(self.x-x)<5]
                if near and random.random()<.025:self.axis='v';self.pos=self.y;self.line=near[0];self.direction=random.choice([-1,1]);self.turn_cd=.8
            if self.x<=self.X_MIN+1 or self.x>=self.X_MAX-1:self.direction*=-1
        else:
            self.pos=clamp(self.pos,self.Y_MIN,self.Y_MAX);self.y=self.pos;self.x=self.line
            if self.turn_cd<=0:
                near=[y for y in self.H_ROADS if abs(self.y-y)<5]
                if near and random.random()<.025:self.axis='h';self.pos=self.x;self.line=near[0];self.direction=random.choice([-1,1]);self.turn_cd=.8
            if self.y<=self.Y_MIN+1 or self.y>=self.Y_MAX-1:self.direction*=-1
    def draw(self,s):
        x,y=int(self.x),int(self.y);pygame.draw.circle(s,(25,25,28),(x-5,y+3),3);pygame.draw.circle(s,(25,25,28),(x+5,y+3),3);pygame.draw.line(s,(225,105,55),(x-4,y),(x+5,y),3);pygame.draw.circle(s,(40,50,65),(x,y-4),3)


class TrafficController:
    """Simple car-following + signal controller for the shared road grid.

    Vehicles retain the game's lightweight movement model, but speed now responds to
    the car ahead and to red signals. This prevents the most visible overlap/ghosting
    at intersections without turning the city simulation into an expensive physics engine.
    """
    def __init__(self):
        self.phase = 0.0
        self.cycle = 18.0
        self.all_red = 1.1
        self.h_roads = tuple(MovingCar.H_ROADS)
        self.v_roads = tuple(MovingCar.V_ROADS)
        self.intersections = [(x,y) for x in self.v_roads for y in self.h_roads]
        self.density = 0.0

    def update(self, dt, economy, vehicles):
        # More traffic during expansions, slightly less during deep recessions/crises.
        self.phase = (self.phase + dt) % self.cycle
        macro = clamp(0.78 + 3.0*max(-.04, min(.06, getattr(economy,'gdp_growth',0))) - .18*getattr(economy,'crisis_level',0), .55, 1.12)
        self.density = lerp(self.density, macro, clamp(dt*1.8,0,1))

    def _green(self, axis):
        half = self.cycle/2
        p = self.phase
        if p < half-self.all_red:
            return axis == 'h'
        if p < half:
            return False
        if p < self.cycle-self.all_red:
            return axis == 'v'
        return False

    def _red_signal_distance(self, v):
        axis=getattr(v,'axis',None); pos=getattr(v,'pos',0); direction=getattr(v,'direction',1)
        if self._green(axis): return None
        crossings = self.v_roads if axis=='h' else self.h_roads
        ahead=[c for c in crossings if (c-pos)*direction > 0]
        if not ahead: return None
        nxt=min(ahead,key=lambda c:abs(c-pos))
        return (nxt-pos)*direction

    def _leader_gap(self, v, vehicles):
        best=None
        for o in vehicles:
            if o is v: continue
            if getattr(o,'axis',None)!=getattr(v,'axis',None): continue
            if getattr(o,'line',None)!=getattr(v,'line',None): continue
            if getattr(o,'direction',None)!=getattr(v,'direction',None): continue
            gap=(getattr(o,'pos',0)-getattr(v,'pos',0))*getattr(v,'direction',1)
            if 0 < gap < 100 and (best is None or gap < best): best=gap
        return best

    def step_vehicle(self, v, dt, vehicles):
        if not hasattr(v,'cruise_speed'):
            v.cruise_speed=max(1.0,getattr(v,'speed',70.0))
        target=v.cruise_speed*self.density
        gap=self._leader_gap(v,vehicles)
        safe=28 if isinstance(v,Motorcycle) else 36
        if gap is not None:
            if gap < safe*.55: target=0.0
            elif gap < safe*1.7: target*=clamp((gap-safe*.45)/(safe*1.25),0.12,1.0)
        red=self._red_signal_distance(v)
        if red is not None and 0 < red < 54:
            target*=clamp((red-8)/46,0.0,1.0)
        accel=3.6 if target>getattr(v,'speed',0) else 6.5
        v.speed=lerp(getattr(v,'speed',target),target,clamp(dt*accel,0,1))
        v.update(dt)

    def draw(self, surf):
        # Compact road signals. Horizontal green / vertical red alternate by phase.
        hg=self._green('h'); vg=self._green('v')
        for x,y in self.intersections:
            for ox,oy,green in ((-11,-11,hg),(11,11,vg)):
                pygame.draw.rect(surf,(24,29,34),(x+ox-4,y+oy-7,8,14),border_radius=2)
                col=(55,215,120) if green else (225,68,72)
                pygame.draw.circle(surf,col,(x+ox,y+oy),3)


def draw_atmosphere_overlay(surf, rect, world_time, raining, crisis_level=0.0, inflation=0.0):
    """Low-cost cinematic grading after the map is projected to the main canvas."""
    if rect.width <= 0 or rect.height <= 0:
        return
    overlay=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA)
    hour=world_time%24
    # Cooler nights, warm sunrise/sunset, muted rainy days.
    if hour < 5.5 or hour >= 20.0:
        overlay.fill((8,20,48,48 if not raining else 62))
    elif 5.5 <= hour < 8.0 or 17.2 <= hour < 20.0:
        overlay.fill((100,54,18,24))
    elif raining:
        overlay.fill((20,34,46,26))
    if crisis_level > .35:
        pulse=(math.sin(pygame.time.get_ticks()/380.0)+1)/2
        crisis=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA)
        crisis.fill((110,22,28,int(10+18*clamp(crisis_level,0,1)*pulse)))
        overlay.blit(crisis,(0,0))
    # Slight heat/haze signal under extreme inflation.
    if inflation > .07:
        haze=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA)
        haze.fill((120,52,18,int(clamp((inflation-.07)*180,0,18))))
        overlay.blit(haze,(0,0))
    surf.blit(overlay,rect.topleft)
    # Vignette with a few translucent borders rather than an expensive pixel shader.
    vignette=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA)
    local=pygame.Rect(0,0,rect.width,rect.height)
    for i,a in ((0,34),(5,24),(11,16),(18,9)):
        pygame.draw.rect(vignette,(2,5,10,a),local.inflate(-2*i,-2*i),max(1,5),border_radius=10)
    surf.blit(vignette,rect.topleft)

BUILDINGS = {
    "central_bank": (170,145,150,80,"CENTRAL BANK",BLUE),
    "bank": (365,145,145,80,"COMMERCIAL BANK",CYAN),
    "market": (560,145,150,80,"CITY MARKET",YELLOW),
    "restaurant": (760,145,140,80,"RAMEN / FOOD",ORANGE),
    "police": (980,145,155,80,"POLICE HQ",PURPLE),
    "hospital": (1170,145,155,80,"HOSPITAL",RED),
    "parliament": (50,360,140,105,"PARLIAMENT",YELLOW),
    "university": (220,365,180,95,"UNIVERSITY",CYAN),
    "school": (455,365,150,95,"SCHOOL",BLUE),
    "factory": (680,360,175,100,"FACTORY",ORANGE),
    "office": (920,350,175,110,"CORP OFFICE",BLUE),
    "welfare": (1160,365,150,95,"LABOR / WELFARE",GREEN),
    "fire_dept": (220,490,135,75,"FIRE STATION",RED),
    "pharmacy": (410,490,120,75,"PHARMACY",GREEN),
    "library": (575,490,130,75,"LIBRARY",CYAN),
    "stadium": (750,480,165,85,"STADIUM",PURPLE),
    "hokage": (300,625,170,100,"GOVERNMENT",RED),
    "housing": (530,615,220,115,"RESIDENTIAL",PURPLE),
    "farm": (860,620,220,120,"FARMS",GREEN),
    "warehouse": (1120,625,190,105,"WAREHOUSE",YELLOW),
    "port": (1420,335,250,130,"TRADE PORT",CYAN),
    "customs": (1425,195,180,85,"CUSTOMS",YELLOW),
    "power": (1375,700,180,95,"POWER / WIND",GREEN),
    "airport": (1640,850,300,120,"INTERNATIONAL AIRPORT",BLUE),
}

PATROL_POINTS=[(185,265),(430,285),(720,285),(1030,285),(1210,420),(1100,535),(820,535),
               (540,535),(210,535),(190,810),(500,810),(820,810),(1120,810),(1230,650)]
NARUTO_HOME=(1280,905)
HOKAGE_GUARD_POST=(335,665)

class CitizenV4:
    COLORS=[(74,142,247),(236,151,64),(90,195,120),(176,118,234),(233,101,107),(80,205,205),(238,204,91)]
    def __init__(self,cid,x,y,profession=None,special=None):
        self.id=cid;self.x=float(x);self.y=float(y);self.special=special
        self.name=special or f"{random.choice(FIRST_NAMES)} {cid:03d}"
        self.profession=profession or random.choice(list(JOB_PROFILES.keys())[:-3])
        if special in {'Naruto','Sasuke','Kakashi','Guy','Hokage Guard'}:self.profession='shinobi'
        if special=='Sakura':self.profession='doctor'
        if special=='Tsunade':self.profession='civil servant'
        base,mob=JOB_PROFILES.get(self.profession,(1.0,0.6))
        self.employed=self.profession not in {'student','unemployed'}
        self.income=random.uniform(18,33)*base;self.cash=max(5,random.lognormvariate(3.5+.25*math.log(max(base,.25)),.75))
        self.assets=max(0,random.lognormvariate(4.0+.55*math.log(max(base,.25)),1.05)-30);self.debt=random.uniform(0,120)*(.3 if self.cash+self.assets>180 else .8)
        self.homeowner=random.random()<clamp(.28+.22*base,.15,.82);self.health=random.uniform(65,100);self.happiness=random.uniform(45,82)
        self.color=random.choice(self.COLORS);self.hair_color=random.choice([(40,30,25),(190,150,90),(210,65,40),(80,80,85)])
        self.speed=random.uniform(36,65)*mob;a=random.uniform(0,math.tau);self.vx=math.cos(a);self.vy=math.sin(a)
        self.phase=random.uniform(0,math.tau);self.dialog='';self.dialog_timer=0.;self.activity='Walking';self.destination='City'
        self.visit_timer=0.;self.last_event='None';self.econ_history=[];self.employer_key=None;self.home_id=None;self.home_anchor=(random.uniform(180,1180),random.uniform(150,970))
        self.decision_timer=random.uniform(.1,1.2);self.current_dest='market';self.dest_anchor=None;self.sleep_timer=0.;self.slept_tonight=False
        self.at_home=False;self.bank_link_timer=0.;self.peer_link_timer=0.;self.peer_link_id=None;self.transport_mode='walk'
        self.housing_tenure='renter';self.mortgage_balance=0.;self.monthly_rent=0.;self.house_value=0.;self.housing_cost_q=0.

    @property
    def net_worth(self):return self.cash+self.assets-self.debt
    @property
    def wealth_class(self):
        w=self.net_worth
        return 'Low wealth' if w<35 else 'Working / middle' if w<140 else 'Affluent' if w<420 else 'High net worth'
    def say(self,text,seconds=2.8):
        self.dialog=text;self.dialog_timer=seconds
        if text and (not self.econ_history or self.econ_history[0] != text):
            self.econ_history.insert(0,text)
            del self.econ_history[5:]
    def react(self,kind,label=''):
        reactions={
            'rate_up':('Loan costs ↑','Concerned'),'rate_down':('Credit easier','Optimistic'),'stimulus':('Demand boost!','Shopping'),
            'austerity':('Cuts coming…','Concerned'),'welfare_up':('Support ↑','Relieved'),'min_wage_up':('Wages ↑','Hopeful'),
            'income_tax_up':('Tax ↑','Concerned'),'income_tax_down':('Tax ↓','Optimistic'),'corp_tax_down':('Investment?','Optimistic'),
            'carbon_tax':('Eco costs ↑','Watching prices'),'imf_bailout':('Austerity!','Protesting')
        }
        msg,act=reactions.get(kind,(label or 'Policy change', 'Reacting'));self.say(msg);self.activity=act;self.last_event=label or kind.replace('_',' ').title()

    def macro_update(self,e):
        employed_prob=clamp(1-e.unemployment,.55,.99)
        if self.profession not in {'student','police','doctor','teacher','civil servant','firefighter'}:
            if self.employed and random.random()<e.unemployment*.10:
                self.employed=False;self.say('Lost my job',3.5);self.activity='Job hunting'
            elif not self.employed and random.random()<employed_prob*.22:
                self.employed=True;self.say('Hired!',3);self.activity='Working'

        if self.employed:
            self.income*=1+e.wage_growth/4
            gross_income=self.income
        else:
            gross_income=self.income*.20
        income_tax=gross_income*e.policy.income_tax
        price_level=max(.70,e.price_index/100.0)
        essentials=11.5*price_level
        vat_cost=essentials*e.policy.vat
        welfare_transfer=0.0
        if not self.employed or self.net_worth<35:
            welfare_transfer=5.0*(e.policy.welfare_spending/.08)*price_level
        self.cash+=gross_income+welfare_transfer-income_tax-essentials-vat_cost

        # Use the actual quarterly stock return, not the stock-index level.
        asset_return=clamp(getattr(e,'stock_return',0.0)*.35+e.gdp_growth/20,-.10,.12)
        self.assets=max(0,self.assets*(1+asset_return))
        if self.cash<0:
            self.debt+=abs(self.cash);self.cash=0
        if self.cash>120:
            save=(self.cash-120)*.18;self.cash-=save;self.assets+=save
        real_income_signal=(e.wage_growth-e.inflation)
        self.happiness=clamp(self.happiness+e.gdp_growth*10+real_income_signal*12-e.unemployment*1.5-(7 if not self.employed else 0),5,100)
        self.health=clamp(self.health+e.policy.health_spending*2-.2,20,100)

    def _work_anchor(self,anchors):
        mapping={'dockworker':'port','sailor':'port','fisher':'port','chef':'restaurant','waiter':'restaurant','shopkeeper':'market',
                 'doctor':'hospital','nurse':'pharmacy','teacher':'school','professor':'university','student':'university','factory worker':'factory',
                 'engineer':'factory','banker':'bank','trader':'bank','farmer':'farm','programmer':'office','entrepreneur':'office','civil servant':'hokage',
                 'firefighter':'fire_dept','librarian':'library','athlete':'stadium'}
        return mapping.get(self.profession,'market')

    def update(self,dt,e,world,anchors,world_time=12,cityecon=None):
        self.phase+=dt*7.2;self.dialog_timer=max(0,self.dialog_timer-dt);self.bank_link_timer=max(0,self.bank_link_timer-dt);self.peer_link_timer=max(0,self.peer_link_timer-dt);hour=world_time%24
        essential_night = (self.profession in {'police','doctor','nurse','firefighter'} or (self.profession=='shinobi' and self.special not in {'Naruto'}))
        
        # خوابیدن ناروتو و شهروندان در خانه هنگام شب
        if self.sleep_timer>0:
            self.sleep_timer=max(0,self.sleep_timer-dt);self.activity='Sleeping at home';self.destination='My Residence';self.at_home=True
            if self.sleep_timer<=0:self.slept_tonight=True;self.activity='Rested at home'
            return
        if 7.0<=hour<20.5:
            self.at_home=False
        if self.visit_timer>0:
            self.visit_timer-=dt;self.activity=f'At {self.destination}';return
        self.decision_timer-=dt
        
        # اگر بانک ران رخ دهد، شهروندان متقاضی پول به سمت بانک تجاری می‌روند
        if getattr(e, 'bank_run', False) and random.random() < 0.35 and self.cash > 10:
            tx, ty = anchors['bank']; tx += random.uniform(-14, 14); ty += random.uniform(22, 38)
            self.destination = 'Bank Run Queue'; self.activity = 'Queuing for deposits'
            self.dest_anchor = (tx, ty)
        elif self.special=='Tsunade':
            tx,ty=anchors['hokage'];ang=self.phase*.12;tx+=math.cos(ang)*24;ty+=math.sin(ang)*18
            self.destination='Hokage Estate';self.activity='Hokage duties';self.dest_anchor=(tx,ty)
        elif self.special=='Hokage Guard':
            tx,ty=HOKAGE_GUARD_POST;ang=self.phase*.22;tx+=math.cos(ang)*18;ty+=math.sin(ang)*14
            self.destination='Hokage Estate';self.activity='Guarding Hokage';self.dest_anchor=(tx,ty)
        elif essential_night and (hour>=21 or hour<7):
            pi=(self.id+int(world_time*1.6))%len(PATROL_POINTS);tx,ty=PATROL_POINTS[pi]
            self.destination='Night patrol';self.activity='Night patrol';self.dest_anchor=(tx,ty)
        elif self.profession in {'police','shinobi'} and self.special not in {'Naruto'}:
            if self.decision_timer<=0 or self.dest_anchor is None or math.hypot(self.x-self.dest_anchor[0],self.y-self.dest_anchor[1])<24:
                self.decision_timer=random.uniform(2.0,4.2);tx,ty=random.choice(PATROL_POINTS);self.dest_anchor=(tx,ty)
            else:tx,ty=self.dest_anchor
            self.destination='City patrol';self.activity='Patrolling district'
        else:
            if self.decision_timer<=0 or self.dest_anchor is None:
                self.decision_timer=random.uniform(.85,1.85)
                if 7.0<=hour<17.0 and self.employed:
                    dest=self._work_anchor(anchors);self.activity='Commuting to work'
                elif 17<=hour<20.5:
                    r=random.random();dest='restaurant' if r<.20 else 'market' if r<.40 else 'stadium' if r<.52 else 'pharmacy' if r<.62 else 'library' if r<.70 else 'home';self.activity='Leisure / errands' if dest!='home' else 'Heading home'
                elif hour>=20.5 or hour<7:
                    dest='home';self.activity='Going home'
                else:
                    dest=random.choice(['market','restaurant','stadium','library','home']);self.activity='Walking'
                self.current_dest=dest
                if dest=='home':
                    tx,ty=self.home_anchor;self.destination='My Residence'
                else:
                    tx,ty=anchors.get(dest,anchors['market']);tx+=random.uniform(-16,16);ty+=random.uniform(-14,14)
                    self.destination=BUILDINGS.get(dest,(0,0,0,0,dest,None))[4] if dest in BUILDINGS else dest
                self.dest_anchor=(tx,ty)
            tx,ty=self.dest_anchor
            if math.hypot(tx-self.x,ty-self.y)<18:
                if self.current_dest=='home' and (hour>=20.5 or hour<7):
                    self.x,self.y=tx,ty;self.at_home=True
                    if not self.slept_tonight:
                        self.sleep_timer=random.uniform(10.0,15.0);self.activity='Sleeping at home';self.say('Zzz',1.4)
                    else:self.activity='Resting at home'
                    return
                self.visit_timer=random.uniform(1.0,2.8);self.activity='At home' if self.current_dest=='home' else f'Using {self.destination}'
                if cityecon and self.current_dest!='home':cityecon.household_visit(self,self.current_dest,e)
                self.decision_timer=0
        distance_to_dest=math.hypot(tx-self.x,ty-self.y)
        if self.decision_timer>0 and distance_to_dest>90:
            tq=clamp(.58+getattr(e,'public_transport_level',0)*.15,.3,.92)
            if distance_to_dest<130:self.transport_mode='walk'
            elif self.net_worth<70:self.transport_mode='bus' if random.random()<tq else 'walk'
            elif self.net_worth>350:self.transport_mode=random.choice(['taxi','car','car','bus'])
            else:self.transport_mode=random.choice(['bus','motorcycle','taxi','walk'])
        dx,dy=tx-self.x,ty-self.y;d=max(1,math.hypot(dx,dy));desired_x,desired_y=dx/d,dy/d
        self.vx=lerp(self.vx,desired_x,min(1,dt*5.7));self.vy=lerp(self.vy,desired_y,min(1,dt*5.7))
        mobility=clamp(1.15-e.unemployment*.40-e.crisis_level*.15,.68,1.32);spd=self.speed*1.24*mobility
        nx=self.x+self.vx*spd*dt;ny=self.y+self.vy*spd*dt
        blocked=False
        for bk,(bx,by,bw,bh,*_) in BUILDINGS.items():
            if bk==self.current_dest:continue
            if pygame.Rect(bx-5,by-5,bw+10,bh+10).collidepoint(nx,ny):blocked=True;break
        if blocked:
            tryx=self.x+self.vx*spd*dt
            if not any(pygame.Rect(bx-5,by-5,bw+10,bh+10).collidepoint(tryx,self.y) for bk,(bx,by,bw,bh,*_) in BUILDINGS.items() if bk!=self.current_dest):self.x=tryx
            else:self.y+=self.vy*spd*dt
        else:self.x,self.y=nx,ny
        self.x=clamp(self.x,45,1320);self.y=clamp(self.y,105,WORLD_H-45)

    def draw(self,surf,selected=False,night=False,show_label=False):
        bob=math.sin(self.phase)*1.8;x,y=int(self.x),int(self.y+bob)
        # سایه زیر پا
        pygame.draw.ellipse(surf,(15,18,22),(x-6,y+7,12,5))
        # تن و لباس متمایز با طبقه و شغل
        body_col = (245,245,245) if self.special=='Kakashi' else ((235,120,40) if self.special=='Naruto' else self.color)
        pygame.draw.rect(surf,body_col,(x-4,y-3,8,10),border_radius=2)
        # سر و صورت
        pygame.draw.circle(surf,(238,198,158),(x,y-7),4)
        # مو و مدل سرپوش
        pygame.draw.circle(surf,self.hair_color,(x,y-9),4)
        # پاها با انیمیشن گام‌برداری
        leg=2 if int(self.phase*2)%2==0 else -2
        pygame.draw.line(surf,(45,50,60),(x-3,y+6),(x-4-leg,y+11),2)
        pygame.draw.line(surf,(45,50,60),(x+3,y+6),(x+4+leg,y+11),2)
        if self.profession in {'police','shinobi','firefighter'}:
            cap_col=(220,50,50) if self.profession=='firefighter' else (35,55,95)
            pygame.draw.rect(surf,cap_col,(x-5,y-11,10,3),border_radius=1)
        if selected:
            pygame.draw.circle(surf,(255,226,90),(x,y),14,2)
        if self.special:
            label=cached_font(11, True).render(self.special,True,(255,235,160));surf.blit(label,(x-label.get_width()//2,y-26))
        if self.dialog_timer>0 and self.dialog:
            f=cached_font(11, True);im=f.render(self.dialog,True,(20,24,30));bw=im.get_width()+12;br=pygame.Rect(x-bw//2,y-47,bw,20)
            pygame.draw.rect(surf,(245,246,238),br,border_radius=7);pygame.draw.rect(surf,(80,88,98),br,1,border_radius=7);surf.blit(im,(br.x+6,br.y+3))

class MovingCar:
    H_ROADS=[285,535,810]; V_ROADS=[100,620,1100]; X_MIN=0;X_MAX=1328;Y_MIN=105;Y_MAX=1080
    def __init__(self,y=None,direction=1):
        self.axis='h';self.pos=random.uniform(20,self.X_MAX-20);self.line=random.choice(self.H_ROADS) if y is None else min(self.H_ROADS,key=lambda v:abs(v-y))
        self.direction=direction;self.speed=random.uniform(65,105);self.cruise_speed=self.speed;self.color=random.choice([(210,75,75),(75,135,220),(220,180,70),(85,180,120),(170,110,210)])
        self.x=self.pos;self.y=self.line;self.turn_cooldown=0
    def update(self,dt):
        self.turn_cooldown=max(0,self.turn_cooldown-dt);self.pos+=self.speed*self.direction*dt
        if self.axis=='h':
            self.pos=clamp(self.pos,self.X_MIN,self.X_MAX);self.x=self.pos;self.y=self.line
            if self.turn_cooldown<=0:
                near=[x for x in self.V_ROADS if abs(self.x-x)<4]
                if near and random.random()<.035:
                    self.axis='v';self.pos=self.y;self.line=near[0];self.direction=random.choice([-1,1]);self.turn_cooldown=.8
            if self.x<=self.X_MIN+1 or self.x>=self.X_MAX-1:self.direction*=-1
        else:
            self.pos=clamp(self.pos,self.Y_MIN,self.Y_MAX);self.y=self.pos;self.x=self.line
            if self.turn_cooldown<=0:
                near=[y for y in self.H_ROADS if abs(self.y-y)<4]
                if near and random.random()<.035:
                    self.axis='h';self.pos=self.x;self.line=near[0];self.direction=random.choice([-1,1]);self.turn_cooldown=.8
            if self.y<=self.Y_MIN+1 or self.y>=self.Y_MAX-1:self.direction*=-1
    def draw(self,s):
        x,y=int(self.x),int(self.y)
        if self.axis=='h':
            pygame.draw.rect(s,self.color,(x-12,y-5,24,10),border_radius=3);pygame.draw.rect(s,(180,220,235),(x-6,y-8,12,5),border_radius=2);wheels=[(x-7,y+6),(x+7,y+6)]
        else:
            pygame.draw.rect(s,self.color,(x-5,y-12,10,24),border_radius=3);pygame.draw.rect(s,(180,220,235),(x-8,y-6,5,12),border_radius=2);wheels=[(x+6,y-7),(x+6,y+7)]
        for p in wheels:pygame.draw.circle(s,(20,22,26),p,3)

class RoadServiceVehicle(MovingCar):
    def __init__(self,kind='taxi'):
        super().__init__(y=random.choice(self.H_ROADS),direction=random.choice([-1,1]))
        self.kind=kind;self.passengers=0;self.stop_timer=0
        if kind=='bus': self.speed=random.uniform(48,68)
        else: self.speed=random.uniform(72,98)
        self.cruise_speed=self.speed
    def draw(self,s):
        x,y=int(self.x),int(self.y)
        if self.kind=='bus':
            c=(63,151,185)
            if self.axis=='h':
                pygame.draw.rect(s,c,(x-22,y-7,44,14),border_radius=4)
                for dx in (-14,-3,8):pygame.draw.rect(s,(180,220,235),(x+dx,y-5,8,6),border_radius=1)
                pygame.draw.circle(s,(20,22,26),(x-14,y+8),3);pygame.draw.circle(s,(20,22,26),(x+14,y+8),3)
            else:
                pygame.draw.rect(s,c,(x-7,y-22,14,44),border_radius=4)
                for dy in (-14,-3,8):pygame.draw.rect(s,(180,220,235),(x-5,y+dy,6,8),border_radius=1)
                pygame.draw.circle(s,(20,22,26),(x+8,y-14),3);pygame.draw.circle(s,(20,22,26),(x+8,y+14),3)
        else:
            c=(238,190,58)
            if self.axis=='h':pygame.draw.rect(s,c,(x-13,y-5,26,10),border_radius=3);pygame.draw.rect(s,(30,35,42),(x-4,y-8,8,3))
            else:pygame.draw.rect(s,c,(x-5,y-13,10,26),border_radius=3);pygame.draw.rect(s,(30,35,42),(x-8,y-4,3,8))
        if getattr(self,'passengers',0)>0:
            f=cached_font(9, True);im=f.render(str(self.passengers),True,WHITE);s.blit(im,(x-im.get_width()//2,y-17))

class AirportPlane:
    def __init__(self):self.x=random.uniform(1420,1950);self.y=965;self.speed=random.uniform(55,85);self.dir=random.choice([-1,1])
    def update(self,dt,e):
        self.x+=self.dir*self.speed*dt*clamp(.7+e.consumer_confidence*.5,.65,1.2)
        if self.x<1410:self.dir=1
        if self.x>1960:self.dir=-1
    def draw(self,s):
        x,y=int(self.x),int(self.y);pygame.draw.polygon(s,(225,230,236),[(x-22,y),(x+22,y),(x+6,y-5),(x+2,y-15),(x-3,y-15),(x-6,y-5)])
        pygame.draw.polygon(s,(120,150,185),[(x-6,y),(x-20,y+9),(x-2,y+4),(x+16,y+8),(x+8,y)])

class CargoShip:
    def __init__(self): self.x=random.uniform(1370,1740); self.y=random.uniform(500,850); self.dir=random.choice([-1,1]); self.speed=random.uniform(12,25); self.containers=random.randint(3,7)
    def update(self,dt,e):
        self.x += self.dir*self.speed*dt*clamp(1-e.trade_disruption,0.25,1)
        if self.x>1760:self.dir=-1
        if self.x<1375:self.dir=1
    def draw(self,s,night=False):
        x,y=int(self.x),int(self.y)
        pygame.draw.polygon(s,(55,78,92),[(x-30,y),(x+28,y),(x+18,y+13),(x-22,y+13)])
        for i in range(self.containers):
            pygame.draw.rect(s,[(198,85,70),(215,145,62),(72,130,178)][i%3],(x-22+i*7,y-10,6,9))

class MetroTrainV4:
    def __init__(self): self.x=60; self.dir=1
    def update(self,dt):
        self.x+=self.dir*110*dt
        if self.x>1290:self.dir=-1
        if self.x<60:self.dir=1
    def draw(self,s):
        x=int(self.x);y=75
        pygame.draw.rect(s,(180,55,65),(x-34,y-9,68,18),border_radius=6)
        for dx in [-22,-7,8,23]: pygame.draw.rect(s,(130,205,225),(x+dx-5,y-5,9,7),border_radius=2)

class IntercityTrainV8:
    def __init__(self):
        self.x=1180.;self.dir=-1;self.stop_timer=0.;self.y=1022;self.station_ready=True
    def update(self,dt):
        if self.stop_timer>0:
            self.stop_timer=max(0,self.stop_timer-dt);return
        self.x+=self.dir*145*dt
        if self.station_ready and 1125<=self.x<=1145:
            self.stop_timer=2.2;self.x=1135;self.station_ready=False
        if abs(self.x-1135)>70:self.station_ready=True
        if self.x>1290:self.x=1290;self.dir=-1
        if self.x<65:self.x=65;self.dir=1
    def draw(self,s):
        x=int(self.x);y=self.y
        pygame.draw.rect(s,(58,123,170),(x-48,y-10,96,20),border_radius=5)
        pygame.draw.rect(s,(220,225,230),(x-46,y-8,92,4),border_radius=2)
        for dx in [-34,-17,0,17,34]:pygame.draw.rect(s,(120,205,225),(x+dx-5,y-4,10,7),border_radius=2)
        pygame.draw.circle(s,(28,32,38),(x-28,y+11),5);pygame.draw.circle(s,(28,32,38),(x+28,y+11),5)

class Button:
    def __init__(self, rect, label, action, color=BLUE, disabled=False, hint=''):
        self.rect=pygame.Rect(rect);self.label=label;self.action=action;self.color=color
        self.disabled=disabled;self.hint=hint
    def draw(self,surf,font,mouse):
        hovered=self.rect.collidepoint(mouse)
        if self.disabled:
            c=tuple(max(28,int(v*.38)) for v in self.color)
            border=(90,96,108)
        else:
            c=tuple(min(255,v+22) for v in self.color) if hovered else self.color
            border=(255,255,255)
        pygame.draw.rect(surf,c,self.rect,border_radius=7);pygame.draw.rect(surf,border,self.rect,width=1,border_radius=7)
        txt=font.render(self.label,True,(175,180,190) if self.disabled else WHITE);surf.blit(txt,txt.get_rect(center=self.rect.center))

def draw_text(surf,font,text,pos,color=TEXT,anchor="topleft"):
    img=font.render(str(text),True,color);rect=img.get_rect();setattr(rect,anchor,pos);surf.blit(img,rect);return rect

def wrap_text(font,text,width):
    words=str(text).split();lines=[];line=""
    for w in words:
        test=(line+" "+w).strip()
        if font.size(test)[0]<=width:line=test
        else:
            if line:lines.append(line)
            # A single long token should never spill outside a UI card.
            if font.size(w)[0] > width:
                lines.append(fit_text(font, w, width))
                line=""
            else:
                line=w
    if line:lines.append(line)
    return lines

def fit_text(font, text, width, suffix='…'):
    """Return one line guaranteed to fit inside *width* pixels.

    Advisor labels can be very long (for example Public transport investment).
    Pygame does not clip text automatically, so we ellipsize before rendering.
    """
    text=str(text)
    if width <= 8 or font.size(text)[0] <= width:
        return text
    lo, hi = 0, len(text)
    while lo < hi:
        mid=(lo+hi+1)//2
        candidate=text[:mid].rstrip()+suffix
        if font.size(candidate)[0] <= width:
            lo=mid
        else:
            hi=mid-1
    return text[:lo].rstrip()+suffix

def draw_sparkline(surf,values,rect,color):
    pygame.draw.rect(surf,(18,23,31),rect,border_radius=5)
    if len(values)<2:return
    vals=list(values);lo,hi=min(vals),max(vals);hi=hi if abs(hi-lo)>1e-8 else lo+1
    pts=[]
    for i,v in enumerate(vals):
        x=rect.x+i*rect.width/max(1,len(vals)-1);y=rect.bottom-5-(v-lo)/(hi-lo)*(rect.height-10);pts.append((x,y))
    pygame.draw.lines(surf,color,False,pts,2)

def draw_lorenz_curve(surf, citizens, rect):
    pygame.draw.rect(surf, (18, 23, 31), rect, border_radius=5)
    pygame.draw.line(surf, (70, 80, 95), (rect.x, rect.bottom), (rect.right, rect.top), 1)
    if not citizens: return
    wealths = sorted(max(0, c.net_worth) for c in citizens)
    tot = sum(wealths)
    if tot <= 0: return
    pts = [(rect.x, rect.bottom)]
    cum = 0.0
    n = len(wealths)
    for i, w in enumerate(wealths):
        cum += w
        px = rect.x + int(((i + 1) / n) * rect.width)
        py = rect.bottom - int((cum / tot) * rect.height)
        pts.append((px, py))
    if len(pts) > 1:
        pygame.draw.lines(surf, PURPLE, False, pts, 2)

def metric_card(surf,fonts,rect,title,value,subtitle,history=None,color=BLUE,citizens=None):
    pygame.draw.rect(surf,CARD,rect,border_radius=9);pygame.draw.rect(surf,GRID,rect,1,border_radius=9)
    draw_text(surf,fonts[0],title,(rect.x+10,rect.y+8),MUTED);draw_text(surf,fonts[2],value,(rect.x+10,rect.y+28),TEXT);draw_text(surf,fonts[0],subtitle,(rect.x+10,rect.bottom-20),color)
    if title == 'HOUSING / WEALTH' and citizens is not None:
        draw_lorenz_curve(surf, citizens, pygame.Rect(rect.right-105,rect.y+13,94,rect.height-25))
    elif history is not None:
        draw_sparkline(surf,history,pygame.Rect(rect.right-105,rect.y+13,94,rect.height-25),color)

def pick_building_at(wx,wy):
    for key in reversed(list(BUILDINGS.keys())):
        if building_rect(key).collidepoint(wx,wy):return key
    return None

def draw_business_panel(screen,b,rect,fonts,cityecon):
    pygame.draw.rect(screen,(18,24,33),rect,border_radius=10);pygame.draw.rect(screen,CYAN,rect,2,border_radius=10)
    draw_text(screen,fonts[2],b.name,(rect.x+14,rect.y+12),WHITE)
    draw_text(screen,fonts[0],f'{b.sector} • {b.status}',(rect.x+14,rect.y+43),MUTED)
    rows=[('Cash',f'${b.cash:,.1f}'),('Debt',f'${b.debt:,.1f}'),('Equity',f'${b.equity:,.1f}'),('Inventory',f'${b.inventory:,.1f}'),('Employees',f'{len(b.employees)} / {b.capacity}'),('Utilization',f'{b.utilization*100:.0f}%'),('Last profit',f'${b.profit_q:,.1f}'),('Last event',b.last_event)]
    y=rect.y+72
    for k,v in rows:
        draw_text(screen,fonts[0],k,(rect.x+14,y),MUTED);draw_text(screen,fonts[1],v,(rect.right-14,y),TEXT,'topright');y+=26
    if b.key=='port':
        y+=5;draw_text(screen,fonts[1],'RECENT CARGO',(rect.x+14,y),CYAN);y+=25
        for direction,good,value,yr,q in list(cityecon.cargo_manifest)[:5]:
            draw_text(screen,fonts[0],f'{direction} • {good}',(rect.x+14,y),TEXT);draw_text(screen,fonts[0],f'${value:.0f}',(rect.right-14,y),MUTED,'topright');y+=20

def anchors_from_buildings():
    a={}
    for k,(x,y,w,h,*_) in BUILDINGS.items():a[k]=(x+w/2,y+h/2)
    return a

def building_rect(k):
    x,y,w,h,*_=BUILDINGS[k];return pygame.Rect(x,y,w,h)

def build_homes(citizens):
    homes=[]
    road_rects=[pygame.Rect(0,y-32,1338,64) for y in (285,535,810)] + [pygame.Rect(x-32,95,64,WORLD_H-95) for x in (100,620,1100)]
    rail_rects=[pygame.Rect(0,55,1335,55),pygame.Rect(0,992,1335,58)]
    blocked=[building_rect(k).inflate(38,38) for k in BUILDINGS] + road_rects + rail_rects
    blocked.append(pygame.Rect(NARUTO_HOME[0]-62,NARUTO_HOME[1]-58,124,116))
    
    # تفکیک مناطق سه‌گانه: فقیرنشین (غرب)، متوسط (مرکز) و مرفه (شرق)
    zones=[
        ('poor', pygame.Rect(140,845,280,130)),
        ('mid', pygame.Rect(440,845,360,130)),
        ('rich', pygame.Rect(820,845,320,130)),
        ('poor', pygame.Rect(150,555,110,210)),
        ('mid', pygame.Rect(485,555,105,210))
    ]
    candidates=[]
    for tier, zone in zones:
        for y in range(zone.top+24,zone.bottom-20,52):
            for x in range(zone.left+28,zone.right-20,58):
                pt=pygame.Rect(x-30,y-24,60,48)
                if any(r.colliderect(pt) for r in blocked):
                    continue
                candidates.append((tier, x, y))
    random.shuffle(candidates)
    need=max(38,min(58,math.ceil(len(citizens)/3.2)))
    for i,(tier,x,y) in enumerate(candidates[:need]):
        kind = 'villa' if tier=='rich' else ('townhouse' if tier=='mid' and random.random()<0.6 else ('apartment' if tier=='mid' else 'shack'))
        homes.append(Home(i,x,y,kind,tier))
    if not homes:
        raise RuntimeError('No valid residential plots were generated.')
    ordered=sorted(citizens,key=lambda c:c.net_worth,reverse=True)
    for c in ordered:
        if c.special=='Naruto':
            c.home_id=-99;c.home_anchor=NARUTO_HOME;c.home_type='villa';continue
        target_tier = 'rich' if c.net_worth>300 else ('mid' if c.net_worth>75 else 'poor')
        choices=[h for h in homes if h.tier==target_tier and len(h.residents)<5]
        if not choices: choices=[h for h in homes if len(h.residents)<6]
        if not choices: choices=homes
        h=min(choices,key=lambda z:len(z.residents)+random.random()*.35)
        h.residents.append(c.id);c.home_id=h.id;c.home_anchor=h.anchor;c.home_type=h.kind
    return homes

def draw_building(s,k,font,e,night,depth_mode=False,show_label=False):
    x,y,w,h,label,c=BUILDINGS[k]
    base=(30,38,50) if not night else (22,26,39)
    if depth_mode:
        draw_extruded_box(s, (x,y,w,h), base, depth=14, lift=9, border=c)
    else:
        shadow=pygame.Rect(x+7,y+8,w,h);pygame.draw.rect(s,(15,18,22),shadow,border_radius=8)
        pygame.draw.rect(s,base,(x,y,w,h),border_radius=8);pygame.draw.rect(s,c,(x,y,w,h),2,border_radius=8)
    pygame.draw.rect(s,c,(x+8,y+8,w-16,8),border_radius=4)
    for wy in range(y+30,y+h-14,22):
        for wx in range(x+16,x+w-15,28):
            wc=(240,205,105) if night and ((wx*7+wy*11+getattr(e,'year',0)*4+getattr(e,'quarter',0))%100)<72 else (96,132,155)
            pygame.draw.rect(s,wc,(wx,wy,12,8),border_radius=2)
    if k=="hospital":
        pygame.draw.rect(s,(245,245,245),(x+w//2-14,y+27,28,28),border_radius=4);pygame.draw.rect(s,RED,(x+w//2-10,y+38,20,6));pygame.draw.rect(s,RED,(x+w//2-3,y+31,6,20))
    elif k=="pharmacy":
        pygame.draw.rect(s,GREEN,(x+w//2-12,y+24,24,24),border_radius=3);pygame.draw.rect(s,WHITE,(x+w//2-9,y+33,18,6));pygame.draw.rect(s,WHITE,(x+w//2-3,y+27,6,18))
    elif k=="fire_dept":
        pygame.draw.polygon(s,RED,[(x+w//2,y+22),(x+w//2+14,y+44),(x+w//2-14,y+44)])
    elif k=="parliament":
        for col_x in range(x+14,x+w-14,18): pygame.draw.rect(s,(225,225,230),(col_x,y+26,6,h-38))
        pygame.draw.polygon(s,(235,195,65),[(x+10,y+24),(x+w//2,y+10),(x+w-10,y+24)])
    elif k=="stadium":
        pygame.draw.ellipse(s,(85,145,95),(x+15,y+24,w-30,h-36))
    elif k=="police":
        pygame.draw.circle(s,(220,65,65),(x+w-24,y+24),8);pygame.draw.polygon(s,(235,235,245),[(x+w-31,y+36),(x+w-17,y+36),(x+w-24,y+48)])
    elif k=="university":
        pygame.draw.rect(s,(45,56,70),(x+24,y+28,w-48,h-30),border_radius=5)
        pygame.draw.polygon(s,CYAN,[(x+18,y+34),(x+w//2,y+14),(x+w-18,y+34)])
        pygame.draw.circle(s,(78,164,184),(x+w//2,y+27),15)
        for cx in range(x+38,x+w-30,28):pygame.draw.rect(s,(205,216,220),(cx,y+44,6,30))
    elif k=="port":
        pygame.draw.line(s,(160,180,195),(x+35,y+28),(x+35,y+80),5);pygame.draw.line(s,(160,180,195),(x+35,y+28),(x+92,y+45),4);pygame.draw.line(s,(160,180,195),(x+92,y+45),(x+92,y+85),2)
    elif k=="factory":
        pygame.draw.rect(s,(75,67,69),(x+w-40,y-32,18,40));pygame.draw.circle(s,(110,115,120),(x+w-31,y-42),11)
        if getattr(e, 'active_factory_fire', False):
            for f_i in range(5):
                fx = x + 30 + f_i * 24 + random.randint(-4, 4)
                pygame.draw.circle(s, (245, 90, 35), (fx, y + 15), random.randint(8, 14))
                pygame.draw.circle(s, (255, 215, 60), (fx, y + 8), random.randint(4, 8))
    if show_label:
        txt=font.render(label,True,TEXT);s.blit(txt,txt.get_rect(center=(x+w//2,y+h-12)))

def draw_economic_heatmap(world, citizens):
    overlay = pygame.Surface((WORLD_W, WORLD_H), pygame.SRCALPHA)
    for c in citizens:
        norm = clamp(c.net_worth / 250.0, 0.0, 1.0)
        col = (int(255 * (1 - norm)), int(255 * norm), 80, 55)
        pygame.draw.circle(overlay, col, (int(c.x), int(c.y)), 35)
    world.blit(overlay, (0, 0))

def draw_smog_overlay(world, emissions):
    if emissions < 85: return
    intensity = clamp(int((emissions - 85) * 1.3), 15, 120)
    smog = pygame.Surface((WORLD_W, WORLD_H), pygame.SRCALPHA)
    smog.fill((95, 88, 75, intensity))
    world.blit(smog, (0, 0))

def draw_transmission_pulses(world, e, world_time, font, show_labels=False):
    active_impulses = [imp for imp in e.impulses if imp.remaining > 0]
    if not active_impulses:
        return

    active_imp = active_impulses[0]
    flow_name = getattr(active_imp, 'flow_type', 'Policy Flow')
    anchors = anchors_from_buildings()
    cb = anchors.get('central_bank')
    targets = [anchors.get('bank'), anchors.get('factory'), anchors.get('office'), anchors.get('port')]
    
    speed_factor = clamp(1.2 + (e.policy.policy_rate - 0.04) * 12, 0.6, 2.2)
    t = world_time * speed_factor

    for tgt in targets:
        if not cb or not tgt: continue
        frac = (t % 1.0)
        px = cb[0] + (tgt[0] - cb[0]) * frac
        py = cb[1] + (tgt[1] - cb[1]) * frac
        pygame.draw.line(world, (65, 190, 240, 75), cb, tgt, 1)
        pygame.draw.circle(world, CYAN, (int(px), int(py)), 5)
        
        mid_x = (cb[0] + tgt[0]) / 2
        mid_y = (cb[1] + tgt[1]) / 2
        if show_labels:
            lbl = font.render(flow_name, True, YELLOW)
            world.blit(lbl, (mid_x - lbl.get_width() // 2, mid_y - 9))

def draw_chirper_feed(surf, chirps, rect, font):
    pygame.draw.rect(surf, (20, 26, 36), rect, border_radius=8)
    pygame.draw.rect(surf, (45, 60, 80), rect, 1, border_radius=8)
    draw_text(surf, font, "CHIRPER LIVE FEED (Citizen Voices)", (rect.x + 10, rect.y + 6), CYAN)
    y = rect.y + 26
    for chirp in list(chirps)[:3]:
        draw_text(surf, font, chirp, (rect.x + 10, y), (215, 225, 235))
        y += 18

def draw_world(world,e,citizens,cars,motorcycles,buses,taxis,animals,trees,homes,ships,metro,intercity,plane,firetruck,fonts,selected,world_time,raining,show_heatmap=False,visual_mode='2D',show_labels=False):
    depth_mode = visual_mode == '2.5D'
    day_phase=(world_time%24)/24.0
    night = day_phase<0.22 or day_phase>0.78
    sky=(28,48,72) if night else (103,174,213)
    land=(36,72,55) if night else (91,142,91)
    water=(25,70,102) if night else (55,136,184)
    world.fill(sky)
    pygame.draw.rect(world,land,(0,95,1360,WORLD_H-95))
    pygame.draw.rect(world,water,(1340,95,WORLD_W-1340,WORLD_H-95))
    pygame.draw.rect(world,(160,142,110),(1335,95,16,WORLD_H-95))
    for py in [330,490,650]:pygame.draw.rect(world,(125,102,75),(1320,py,230,18))
    ridge=[(0,112),(90,78),(180,101),(285,70),(390,104),(510,76),(625,98),(760,72),(900,104),(1040,79),(1190,101),(1335,83),(1335,128),(0,128)]
    pygame.draw.polygon(world,(48,91,70),ridge)
    for hx in range(55,1310,92):
        pygame.draw.rect(world,(69,76,77),(hx,93,4,30));pygame.draw.circle(world,(42,101,61),(hx+2,89),13)
    districts=[((135,125,1030,125),'CIVIC / SERVICES'),((145,330,1040,160),'EDUCATION • INDUSTRY'),((145,585,1060,175),'HOUSING • AGRICULTURE')]
    for rr,label in districts:
        ov=pygame.Surface((rr[2],rr[3]),pygame.SRCALPHA);ov.fill((255,255,255,7));world.blit(ov,(rr[0],rr[1]));pygame.draw.rect(world,(205,215,220),rr,1,border_radius=10)
        if show_labels: draw_text(world,fonts[0],label,(rr[0]+8,rr[1]+6),(205,215,220))
    pygame.draw.rect(world,(112,78,48),(18,230,24,112),border_radius=5);pygame.draw.rect(world,(112,78,48),(82,230,24,112),border_radius=5)
    pygame.draw.polygon(world,(137,91,49),[(8,235),(62,196),(116,235)]);pygame.draw.rect(world,(75,52,38),(40,220,44,16),border_radius=4)
    draw_text(world,fonts[0],'VILLAGE GATE',(62,202),YELLOW,'midtop')
    nhx,nhy=NARUTO_HOME
    pygame.draw.rect(world,(66,116,72),(nhx-58,nhy-48,116,100),border_radius=14)
    pygame.draw.circle(world,(54,132,68),(nhx-43,nhy+30),12);pygame.draw.circle(world,(54,132,68),(nhx+43,nhy+30),12)
    pygame.draw.rect(world,(39,48,61),(nhx-35,nhy-26,70,52),border_radius=7);pygame.draw.polygon(world,ORANGE,[(nhx-40,nhy-25),(nhx,nhy-50),(nhx+40,nhy-25)])
    pygame.draw.rect(world,(102,154,188),(nhx-11,nhy-8,22,34),border_radius=3);pygame.draw.circle(world,(240,210,85),(nhx+24,nhy-4),7)
    pygame.draw.rect(world,(205,183,125),(nhx-58,nhy+47,116,5),border_radius=2)
    if show_labels: draw_text(world,fonts[0],"NARUTO'S RESIDENCE",(nhx,nhy+56),YELLOW,'midtop')
    pygame.draw.line(world,(80,75,70),(20,75),(1320,75),5);pygame.draw.line(world,(80,75,70),(20,87),(1320,87),5)
    for rx in range(25,1320,25):pygame.draw.line(world,(75,58,45),(rx,70),(rx,92),3)
    pygame.draw.line(world,(82,77,72),(20,1015),(1320,1015),5);pygame.draw.line(world,(82,77,72),(20,1029),(1320,1029),5)
    for rx in range(25,1320,24):pygame.draw.line(world,(75,58,45),(rx,1009),(rx,1035),3)
    pygame.draw.rect(world,(55,65,76),(1040,958,210,58),border_radius=8);pygame.draw.rect(world,(190,175,125),(1025,1000,245,10),border_radius=3);draw_text(world,fonts[1],'CENTRAL RAIL STATION',(1145,968),TEXT,'midtop');draw_text(world,fonts[0],'Intercity • Platform 2',(1145,989),MUTED,'midtop')
    pygame.draw.rect(world,(63,68,76),(1500,1000,470,62),border_radius=5)
    for rx in range(1520,1950,65):pygame.draw.rect(world,(230,230,210),(rx,1028,36,4))
    pygame.draw.rect(world,(35,42,52),(1610,840,360,145),border_radius=10);draw_text(world,fonts[1],'LEAF INTERNATIONAL AIRPORT',(1790,855),TEXT,'midtop');draw_text(world,fonts[0],'Terminal • Cargo • Passenger',(1790,878),MUTED,'midtop')
    roads_y=[285,535,810];roads_x=[100,620,1100]
    for y in roads_y:
        pygame.draw.rect(world,ROAD,(0,y-24,1335,48))
        for x in range(10,1330,55):pygame.draw.line(world,(205,205,185),(x,y),(x+28,y),3)
    for x in roads_x:
        pygame.draw.rect(world,ROAD,(x-24,95,48,WORLD_H-95))
        for y in range(110,WORLD_H,55):pygame.draw.line(world,(205,205,185),(x,y),(x,y+28),3)
    pygame.draw.rect(world,(52,105,67),(315,620,210,125),border_radius=16);draw_text(world,fonts[0],'RIVERSIDE PARK',(330,628),(190,220,190))
    wind=1.35 if raining else .72
    for tr in trees:tr.draw(world,world_time,wind)
    for h in homes:h.draw(world,night,depth_mode)
    for k in BUILDINGS:draw_building(world,k,fonts[0],e,night,depth_mode,show_labels)
    for i in range(3):
        tx=1395+i*60;ty=820
        pygame.draw.line(world,(220,225,225),(tx,ty),(tx,ty-70),4)
        ang=world_time*0.8+i
        for a in [0,2.094,4.188]:
            ex=tx+math.cos(ang+a)*28;ey=ty-70+math.sin(ang+a)*28;pygame.draw.line(world,(235,235,235),(tx,ty-70),(ex,ey),3)
    for fy in range(650,730,18):pygame.draw.line(world,(115,92,55),(875,fy),(1060,fy),3)
    for i in range(6):
        ax=900+(i*31)%150;ay=675+(i*19)%55;pygame.draw.ellipse(world,(240,238,220),(ax,ay,13,8));pygame.draw.circle(world,(35,35,35),(ax+10,ay+3),2)
    metro.draw(world)
    intercity.draw(world)
    plane.draw(world)
    firetruck.draw(world)
    for car in cars:car.draw(world)
    for m in motorcycles:m.draw(world)
    for b in buses:b.draw(world)
    for t in taxis:t.draw(world)
    for animal in animals:animal.draw(world)
    for ship in ships:ship.draw(world,night)
    trade_factor=clamp((e.exports+e.imports)/220,0.35,1.6)*clamp(1-e.trade_disruption,0.2,1)
    for i in range(int(18*trade_factor)):
        cx=1430+(i%6)*32;cy=430+(i//6)*18;pygame.draw.rect(world,[(194,78,65),(218,151,58),(62,126,177)][i%3],(cx,cy,28,14),border_radius=2)
    if e.policy.infrastructure_spending>.035:
        pygame.draw.line(world,(215,170,65),(745,460),(745,380),5);pygame.draw.line(world,(215,170,65),(745,385),(820,405),4);pygame.draw.circle(world,(220,180,70),(745,380),7)
        draw_text(world,fonts[0],'INFRA PROJECT',(765,420),YELLOW)
    if e.unemployment>.105 or e.inflation>.095:
        for i in range(10):
            px=520+(i%5)*16;py=225+(i//5)*15;pygame.draw.circle(world,(226,190,150),(px,py),4);pygame.draw.line(world,(210,75,75),(px,py+5),(px,py+13),2)
        draw_text(world,fonts[0],'PUBLIC PRESSURE',(520,257),RED)
    elif e.gdp_growth>.055 and e.approval>.6:
        for i in range(8):pygame.draw.circle(world,random.choice([GREEN,YELLOW,CYAN]),(540+i*14,245-int(abs(math.sin(world_time+i))*15)),3)
        draw_text(world,fonts[0],'BUSINESS CONFIDENCE UP',(520,263),GREEN)
    
    draw_transmission_pulses(world, e, world_time, fonts[0], show_labels)
    draw_smog_overlay(world, e.emissions)
    
    by_id={c.id:c for c in citizens}
    bank_anchor=anchors_from_buildings()['bank']
    for c in citizens:
        if getattr(c,'bank_link_timer',0)>0:
            pygame.draw.line(world,(82,190,235),(int(c.x),int(c.y)),(int(bank_anchor[0]),int(bank_anchor[1])),1)
        if getattr(c,'peer_link_timer',0)>0 and getattr(c,'peer_link_id',None) in by_id and c.id<c.peer_link_id:
            o=by_id[c.peer_link_id]
            pygame.draw.line(world,(238,190,72),(int(c.x),int(c.y)),(int(o.x),int(o.y)),1)
    
    if show_heatmap:
        draw_economic_heatmap(world, citizens)
        
    for c in citizens:c.draw(world,selected is c,night,show_labels)
    if night:
        ov=pygame.Surface((WORLD_W,WORLD_H),pygame.SRCALPHA);ov.fill((8,16,45,95));world.blit(ov,(0,0));pygame.draw.circle(world,(225,230,210),(1230,45),20)
    else:
        sunx=int(150+1100*((day_phase-0.22)/0.56));pygame.draw.circle(world,(255,223,108),(sunx,45),23)
    if raining:
        for i in range(75):
            rx=(i*89+int(world_time*160))%1330;ry=(i*47+int(world_time*220))%WORLD_H;pygame.draw.line(world,(160,190,220),(rx,ry),(rx-5,ry+13),1)
    pygame.draw.rect(world,(10,15,22),(15,105,315,36),border_radius=9)
    state="CRISIS" if e.crisis_level>.45 else "PRESSURE" if e.crisis_level>.2 else "NORMAL"
    sc=RED if state=="CRISIS" else YELLOW if state=="PRESSURE" else GREEN
    draw_text(world,fonts[1],f"Q{e.quarter} {e.year} • {state} • {visual_mode} • {world_time%24:04.1f}:00",(28,113),sc)
    return night

def build_buttons_v4():
    package_colors=[CYAN,GREEN,PURPLE,ORANGE,BLUE,YELLOW,RED,GREEN,ORANGE,CYAN,PURPLE]
    combined=[]
    for i,(pid,pkg) in enumerate(POLICY_PACKAGES.items()):
        combined.append((pkg['name'],f'package:{pid}',package_colors[i%len(package_colors)]))
    return {
      "Monetary":[("Rate +50bp","rate_up",RED),("Rate -50bp","rate_down",GREEN),("Reserve +2%","reserve_up",RED),("Reserve -2%","reserve_down",GREEN),("Macroprudential +","macroprudential_up",PURPLE),("Bank Solvency","bank_recap",PURPLE),("Defend FX","support_fx",BLUE),("QE (Inject Cash)","qe",CYAN),("Debt Restructure","debt_restructure",ORANGE)],
      "Fiscal":[("Income Tax +2%","income_tax_up",RED),("Income Tax -2%","income_tax_down",GREEN),("Corp Tax +2%","corp_tax_up",RED),("Corp Tax -2%","corp_tax_down",GREEN),("VAT +1%","vat_up",RED),("VAT -1%","vat_down",GREEN),("Wealth Surcharge","wealth_tax_up",PURPLE),("Payroll Tax Cut","payroll_tax_cut",GREEN),("Fiscal Stimulus","stimulus",GREEN),("Austerity","austerity",RED),("Welfare +","welfare_up",PURPLE),("Min Wage +5%","min_wage_up",YELLOW)],
      "Structural":[("Infrastructure +","infra_up",ORANGE),("Education +","education_up",CYAN),("Health +","health_up",BLUE),("Skills Program","job_training",CYAN),("SME Credit","sme_credit",GREEN),("Housing Support","housing_support",ORANGE),("Mortgage Rules +","mortgage_tighten",PURPLE),("Public Transit","public_transport",CYAN),("Research Grants","research_grant",PURPLE),("Business Reform","business_reform",BLUE),("Childcare Support","childcare_support",GREEN),("Green Deal +","green_up",GREEN),("Carbon Tax","carbon_tax",GREEN)],
      "Trade":[("Tariff +2.5%","tariff_up",RED),("Tariff -2.5%","tariff_down",GREEN),("Export Credit","export_support",CYAN),("FDI Incentives","fdi_incentives",GREEN),("Devalue 6.0%","devalue",ORANGE),("Capital Controls","capital_controls",PURPLE),("Anti-Corruption","anti_corruption",BLUE),("Port Modernize","port_upgrade",CYAN),("Sanction Accord","sanction_relief",GREEN),("Tech Acquisition","intel_espionage",PURPLE)],
      "Combined":combined,
      "Crisis":[("Oil Shock","shock_oil",ORANGE),("Financial Crisis","shock_financial",RED),("Pandemic","shock_pandemic",PURPLE),("War Shock","shock_war",RED),("Sanctions Trigger","shock_sanctions",ORANGE),("Drought Trigger","shock_drought",YELLOW),("Earthquake","shock_earthquake",RED),("Cyberattack","shock_cyber",PURPLE),("Refugee Wave","shock_refugees",BLUE),("Bubble Collapse","shock_bubble_burst",RED),("Commodity Boom","shock_commodity_boom",GREEN),("Global Boom","shock_boom",GREEN)],
      "Emergency":[("Target Food Subsidy","food_subsidy",GREEN),("Energy Relief","energy_subsidy",YELLOW),("Food Reserve","food_reserve",GREEN),("Civil Security","security_package",PURPLE),("Bank Solvency","bank_recap",BLUE),("FX Defense","support_fx",CYAN),("Debt Restructure","debt_restructure",RED),("Stabilization Aid","imf_bailout",RED)]
    }

def pick_citizen_at(citizens,wx,wy):
    nearest=None;dist=18
    for c in citizens:
        d=math.hypot(c.x-wx,c.y-wy)
        if d<dist:nearest=c;dist=d
    return nearest

def draw_citizen_panel(screen,c,rect,fonts):
    pygame.draw.rect(screen,(18,24,33),rect,border_radius=10);pygame.draw.rect(screen,YELLOW,rect,2,border_radius=10)
    draw_text(screen,fonts[2],c.name,(rect.x+14,rect.y+12),WHITE)
    draw_text(screen,fonts[0],f"#{c.id} • {c.profession.title()} • {'Employed' if c.employed else 'Unemployed'}",(rect.x+14,rect.y+43),MUTED)
    rows=[("Net worth",f"${c.net_worth:,.1f}"),("Cash",f"${c.cash:,.1f}"),("Assets",f"${c.assets:,.1f}"),("Debt",f"${c.debt:,.1f}"),("Income / qtr",f"${c.income:,.1f}"),("Housing",f"{getattr(c,'housing_tenure','renter').title()} • {getattr(c,'home_type','home').title()}"),("Housing cost",f"${getattr(c,'housing_cost_q',0):,.1f}/q"),("Happiness",f"{c.happiness:.0f}/100"),("Health",f"{c.health:.0f}/100"),("Activity",c.activity),("Destination",c.destination)]
    y=rect.y+70
    for k,v in rows:
        draw_text(screen,fonts[0],k,(rect.x+14,y),MUTED);draw_text(screen,fonts[1],str(v)[:27],(rect.right-14,y),TEXT,"topright");y+=22
    y+=4
    draw_text(screen,fonts[1],'RECENT ECONOMIC EVENTS',(rect.x+14,y),CYAN);y+=22
    history=getattr(c,'econ_history',[])[:4]
    if not history:
        draw_text(screen,fonts[0],'No recent household transaction.',(rect.x+14,y),MUTED)
    else:
        for event in history:
            draw_text(screen,fonts[0],'• '+event[:43],(rect.x+16,y),TEXT);y+=18

ACTION_AUDIENCE={
    'export_support':{'dockworker','sailor','fisher','factory worker','engineer','entrepreneur','trader','civil servant'},
    'port_upgrade':{'dockworker','sailor','fisher','engineer','builder','taxi driver','civil servant'},
    'support_fx':{'trader','banker','entrepreneur','shopkeeper','civil servant'},
    'bank_recap':{'banker','trader','entrepreneur','programmer'},
    'min_wage_up':{'factory worker','waiter','chef','shopkeeper','builder','dockworker'},
    'education_up':{'teacher','professor','student','librarian'},'health_up':{'doctor','nurse'},
    'green_up':{'engineer','builder','farmer'},'infra_up':{'builder','engineer','taxi driver'},
}

HUMAN_REACTION_ACTIONS={
    'welfare_up','min_wage_up','income_tax_up','income_tax_down','food_subsidy',
    'health_up','education_up','shock_war','shock_pandemic','shock_earthquake',
    'shock_refugees','shock_drought','imf_bailout','carbon_tax'
}

ECON_LABELS={
    'consumption':'Consumption','investment':'Investment','government':'Gov. spending',
    'exports':'Exports','imports':'Imports','inflation':'Inflation pressure',
    'unemployment':'Unemployment','potential':'Potential GDP','confidence':'Confidence',
    'credit':'Credit growth','fx':'FX pressure','inequality':'Inequality','poverty':'Poverty',
    'revenue':'Tax revenue','debt':'Debt pressure','emissions':'Emissions',
    'energy':'Energy security','productivity':'Productivity'
}

def broadcast_reaction(citizens,action,label=''):
    if action not in HUMAN_REACTION_ACTIONS:
        return
    audience=ACTION_AUDIENCE.get(action)
    if action.startswith('shock_'):
        candidates=list(citizens)
        share=.28
    else:
        candidates=[c for c in citizens if (not audience or c.profession in audience)]
        share=.34
    if not candidates:return
    k=max(1,min(len(candidates),int(len(candidates)*share)))
    for c in random.sample(candidates,k):c.react(action,label)

def transmission_reaction(citizens,impulse_name):
    return

def impulse_weight_preview(imp):
    if imp.remaining<=0:return 0.0
    age=imp.duration-imp.remaining
    phase=(age+1)/max(1,imp.duration)
    return math.sin(math.pi*phase)/max(1,imp.duration*.62)

def format_effect(key,value):
    if key in {'inflation','unemployment','inequality','poverty','fx','credit','confidence','emissions','energy','productivity','potential'}:
        return f"{value*100:+.2f} pp"
    return f"{value*100:+.1f}%"

def _econ_current_value(e,key):
    inequality = getattr(e,'inequality',getattr(e,'gini',0.0))
    interest_bill = getattr(e,'debt',0.0) * max(0.01,getattr(e,'bond_yield',0.045)) * 0.50
    derived_revenue = getattr(e,'budget_balance',0.0) + getattr(e,'government_spending',0.0) + interest_bill
    mapping={
        'consumption':getattr(e,'consumption',0.0),'investment':getattr(e,'investment',0.0),'government':getattr(e,'government_spending',0.0),
        'exports':getattr(e,'exports',0.0),'imports':getattr(e,'imports',0.0),'inflation':getattr(e,'inflation',0.0),'unemployment':getattr(e,'unemployment',0.0),
        'potential':getattr(e,'potential_gdp',0.0),'confidence':(getattr(e,'consumer_confidence',0.0)+getattr(e,'business_confidence',0.0))/2,
        'credit':getattr(e,'credit_growth',0.0),'fx':getattr(e,'exchange_rate',1.0),'inequality':inequality,'poverty':getattr(e,'poverty',0.0),
        'revenue':getattr(e,'government_revenue',derived_revenue),'debt':getattr(e,'debt_ratio',0.0),'emissions':getattr(e,'emissions',0.0),
        'energy':getattr(e,'energy_security',0.0),'productivity':getattr(e,'productivity_growth',getattr(e,'productivity',0.0))
    }
    return mapping.get(key,0.0)

def _econ_current_text(e,key):
    v=_econ_current_value(e,key)
    if key in {'consumption','investment','government','exports','imports','revenue','potential'}:return money(v)
    if key=='fx':return f'{v:.3f}'
    if key in {'inflation','unemployment','credit','inequality','poverty','debt'}:return pct(v)
    if key in {'confidence','energy'}:return f'{v*100:.0f}/100'
    if key=='emissions':return f'{v:.0f}'
    return f'{v:.2f}'

def draw_policy_impact_hud(surf,fonts,rect,last_impulse,e):
    pygame.draw.rect(surf,(24,31,41),rect,border_radius=8);pygame.draw.rect(surf,GRID,rect,1,border_radius=8)
    draw_text(surf,fonts[1],'POLICY TRANSMISSION HUD',(rect.x+10,rect.y+8),CYAN)
    if last_impulse is None:
        draw_text(surf,fonts[0],'Deploy policies to observe macro transmission channels.',(rect.x+10,rect.y+34),MUTED);return
    draw_text(surf,fonts[0],f"{last_impulse.name} [{getattr(last_impulse, 'flow_type', 'Policy')}]",(rect.x+10,rect.y+31),TEXT)
    w=impulse_weight_preview(last_impulse); y=rect.y+52
    items=sorted(last_impulse.effects.items(),key=lambda kv:abs(kv[1]),reverse=True)[:6]
    for key,full in items:
        live=full*w
        bad={'inflation','unemployment','inequality','poverty','debt','emissions','fx'}
        beneficial=(live<0) if key in bad else (live>0)
        col=GREEN if beneficial else RED;arrow='▲' if live>0 else '▼'
        draw_text(surf,fonts[0],ECON_LABELS.get(key,key.title()),(rect.x+12,y),TEXT)
        draw_text(surf,fonts[0],_econ_current_text(e,key),(rect.x+155,y),MUTED)
        draw_text(surf,fonts[1],f'{arrow} {format_effect(key,live)}',(rect.right-12,y),col,'topright')
        y+=20
    draw_text(surf,fonts[0],f'{last_impulse.remaining} quarters active • Flow speed calibrated',(rect.x+10,rect.bottom-20),MUTED)

def draw_event_ticker(surf, news, rect, font):
    pygame.draw.rect(surf,(12,17,24),rect,border_radius=7)
    pygame.draw.rect(surf,GRID,rect,1,border_radius=7)
    items=list(news)[:2]
    if not items:
        draw_text(surf,font,'No major economic events.',(rect.x+9,rect.y+7),MUTED);return
    text='  •  '.join(items)
    while font.size(text)[0] > rect.width-18 and len(text)>8:
        text=text[:-2]
    if text != '  •  '.join(items): text=text.rstrip()+ '…'
    draw_text(surf,font,text,(rect.x+9,rect.centery),TEXT,'midleft')

def draw_policy_capacity(surf, e, rect, font, font_bold):
    pygame.draw.rect(surf,(19,25,34),rect,border_radius=8);pygame.draw.rect(surf,GRID,rect,1,border_radius=8)
    draw_text(surf,font_bold,'GOVERNING CAPACITY',(rect.x+10,rect.y+7),TEXT)
    cap=clamp(getattr(e,'policy_capacity',100)/max(1,getattr(e,'max_policy_capacity',100)),0,1)
    bar=pygame.Rect(rect.x+10,rect.y+31,rect.width-20,10)
    pygame.draw.rect(surf,(48,55,67),bar,border_radius=5)
    col=GREEN if cap>.55 else YELLOW if cap>.25 else RED
    pygame.draw.rect(surf,col,(bar.x,bar.y,int(bar.width*cap),bar.height),border_radius=5)
    draw_text(surf,font,f"Capacity {getattr(e,'policy_capacity',100):.0f}/100 • Political {getattr(e,'political_capital',0):.0f}/100",(rect.x+10,rect.y+48),MUTED)

def draw_macro_driver_panel(surf, e, rect, fonts):
    pygame.draw.rect(surf,(20,27,37),rect,border_radius=8);pygame.draw.rect(surf,GRID,rect,1,border_radius=8)
    draw_text(surf,fonts[1],'WHY DID THE ECONOMY MOVE?',(rect.x+10,rect.y+8),CYAN)
    y=rect.y+34
    drivers=getattr(e,'inflation_drivers',{})
    draw_text(surf,fonts[0],'Inflation contributions (annualized)',(rect.x+10,y),MUTED);y+=19
    ranked=sorted(drivers.items(),key=lambda kv:abs(kv[1]),reverse=True)[:4]
    for name,val in ranked:
        col=RED if val>0 else GREEN
        draw_text(surf,fonts[0],name,(rect.x+14,y),TEXT)
        draw_text(surf,fonts[0],f'{val*100:+.2f} pp',(rect.right-12,y),col,'topright');y+=18
    y+=3
    draw_text(surf,fonts[0],'Real GDP contributions', (rect.x+10,y),MUTED);y+=19
    ranked=sorted(getattr(e,'gdp_drivers',{}).items(),key=lambda kv:abs(kv[1]),reverse=True)[:3]
    for name,val in ranked:
        col=GREEN if val>0 else RED
        draw_text(surf,fonts[0],name,(rect.x+14,y),TEXT)
        draw_text(surf,fonts[0],f'{val*100:+.2f} pp',(rect.right-12,y),col,'topright');y+=18

def draw_macro_driver_compact(surf, e, rect, fonts):
    """Small Advisor-tab attribution card; the full detail remains available with Q."""
    pygame.draw.rect(surf,(20,27,37),rect,border_radius=8)
    pygame.draw.rect(surf,GRID,rect,1,border_radius=8)
    draw_text(surf,fonts[1],'KEY ECONOMIC DRIVERS',(rect.x+10,rect.y+8),CYAN)
    draw_text(surf,fonts[0],'Q = full quarterly brief',(rect.right-10,rect.y+10),MUTED,'topright')
    inf=sorted(getattr(e,'inflation_drivers',{}).items(),key=lambda kv:abs(kv[1]),reverse=True)[:2]
    gdp=sorted(getattr(e,'gdp_drivers',{}).items(),key=lambda kv:abs(kv[1]),reverse=True)[:2]
    y=rect.y+34
    draw_text(surf,fonts[0],'INFLATION',(rect.x+10,y),MUTED)
    x=rect.x+86
    for name,val in inf:
        label=fit_text(fonts[0],name,92)
        col=RED if val>0 else GREEN
        draw_text(surf,fonts[0],f'{label} {val*100:+.2f}pp',(x,y),col)
        x += 142
    y += 22
    draw_text(surf,fonts[0],'GDP',(rect.x+10,y),MUTED)
    x=rect.x+86
    for name,val in gdp:
        label=fit_text(fonts[0],name,92)
        col=GREEN if val>0 else RED
        draw_text(surf,fonts[0],f'{label} {val*100:+.2f}pp',(x,y),col)
        x += 142

def draw_game_banner(surf,e,rect,fonts):
    status=getattr(e,'game_status','RUNNING')
    score=getattr(e,'national_score',50)
    stability=getattr(e,'stability_score',50)
    col=GREEN if status=='WON' else RED if status=='LOST' else CYAN
    pygame.draw.rect(surf,(10,16,24),rect,border_radius=8);pygame.draw.rect(surf,col,rect,2,border_radius=8)
    draw_text(surf,fonts[1],f'{status} • NATIONAL SCORE {score:.0f}',(rect.x+10,rect.y+8),col)
    mode=getattr(e,'game_mode','mission').upper()
    draw_text(surf,fonts[0],f'Stability {stability:.0f}/100 • Mission score {getattr(getattr(e,"missions",None),"score",0)}/100 • {mode} • Turn {getattr(e,"turns_survived",0)}',(rect.x+10,rect.y+31),TEXT)
    if status!='RUNNING':
        msg=getattr(e,'game_over_reason','')
        draw_text(surf,fonts[0],msg[:70],(rect.x+10,rect.y+50),MUTED)
    else:
        active=e.current_objective() if hasattr(e,'current_objective') else None
        if active:
            prog=active.get('progress',0); req=active.get('required',1)
            draw_text(surf,fonts[0],f'Objective: {active["name"]} ({prog}/{req})',(rect.x+10,rect.y+50),YELLOW)


def draw_objective_panel(surf, e, rect, fonts, compact=False):
    pygame.draw.rect(surf, (18,24,33), rect, border_radius=10)
    mode=getattr(e,'game_mode','mission')
    border=CYAN if mode=='mission' else PURPLE
    pygame.draw.rect(surf, border, rect, 1, border_radius=10)
    obj=e.current_objective() if hasattr(e,'current_objective') else {'name':'Stabilize the economy','text':'','progress':0,'required':1,'actions':()}
    title='CURRENT MISSION' if mode=='mission' else 'FREE ECONOMY'
    draw_text(surf, fonts[1], title, (rect.x+12, rect.y+8), border)
    draw_text(surf, fonts[0], f"Mode: {'MISSION' if mode=='mission' else 'SANDBOX'} • M switch", (rect.right-12, rect.y+10), MUTED, 'topright')
    draw_text(surf, fonts[1], obj['name'], (rect.x+12, rect.y+31), TEXT)
    prog=clamp(obj.get('progress',0)/max(1,obj.get('required',1)),0,1)
    bx,by,bw=rect.x+12,rect.y+56,rect.width-24
    pygame.draw.rect(surf,(48,56,68),(bx,by,bw,8),border_radius=4)
    pygame.draw.rect(surf,GREEN,(bx,by,int(bw*prog),8),border_radius=4)
    if mode=='mission' and obj.get('remaining') is not None:
        draw_text(surf,fonts[0],f"{obj.get('progress',0)}/{obj.get('required',1)} sustain • {obj.get('remaining')}Q left",(rect.right-12,rect.y+31),GREEN,'topright')
    if compact:
        status=obj.get('status','')
        draw_text(surf,fonts[0],status[:82],(rect.x+12,rect.y+71),MUTED)
        draw_text(surf,fonts[0],'G: detailed mission/advisor guide',(rect.right-12,rect.bottom-18),YELLOW,'topright')
        return
    y=rect.y+74
    for line in wrap_text(fonts[0],obj.get('text',''),rect.width-24)[:2]:
        draw_text(surf,fonts[0],line,(rect.x+12,y),MUTED); y+=16
    draw_text(surf,fonts[0],obj.get('status',''),(rect.x+12,y+2),YELLOW); y+=23
    acts=obj.get('actions',())
    if acts:
        names=[ACTION_LABEL.get(a,a.replace('_',' ').title()) for a in acts[:4]]
        for line in wrap_text(fonts[0],'Possible levers: '+' • '.join(names),rect.width-24)[:2]:
            draw_text(surf,fonts[0],line,(rect.x+12,y),TEXT); y+=16
    draw_text(surf,fonts[0],'Press G for exact tab → policy guidance and what to avoid.',(rect.x+12,rect.bottom-20),CYAN)

def draw_package_brief(surf, package_id, e, rect, fonts):
    pygame.draw.rect(surf,CARD,rect,border_radius=9);pygame.draw.rect(surf,GRID,rect,1,border_radius=9)
    if not package_id or package_id not in POLICY_PACKAGES:
        draw_text(surf,fonts[1],'COMBINED POLICY BRIEF',(rect.x+12,rect.y+9),CYAN)
        draw_text(surf,fonts[0],'Hover a package to inspect its components and trade-off.',(rect.x+12,rect.y+38),MUTED)
        return
    p=POLICY_PACKAGES[package_id]
    ok,reason=e.can_enact_package(package_id) if hasattr(e,'can_enact_package') else (True,'Ready')
    col=GREEN if ok else RED
    draw_text(surf,fonts[1],p['name'],(rect.x+12,rect.y+9),CYAN)
    draw_text(surf,fonts[0],f"Capacity {p['capacity_cost']} • Political {p['political_cost']} • Cooldown {p['cooldown']}Q",(rect.right-12,rect.y+11),col,'topright')
    y=rect.y+36
    for line in wrap_text(fonts[0],p['description'],rect.width-24)[:2]: draw_text(surf,fonts[0],line,(rect.x+12,y),TEXT); y+=16
    components=' + '.join(ACTION_LABEL.get(a,a) for a in p['actions'])
    for line in wrap_text(fonts[0],'Includes: '+components,rect.width-24)[:3]: draw_text(surf,fonts[0],line,(rect.x+12,y),MUTED); y+=16
    for line in wrap_text(fonts[0],'Trade-off: '+p['tradeoff'],rect.width-24)[:2]: draw_text(surf,fonts[0],line,(rect.x+12,y),YELLOW); y+=16
    if not ok:
        draw_text(surf,fonts[0],'Blocked: '+reason,(rect.x+12,rect.bottom-20),RED)

def draw_mission_guidance(surf, e, advisor, rect, fonts):
    shade=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA);shade.fill((7,11,18,246));surf.blit(shade,rect.topleft)
    pygame.draw.rect(surf,CYAN,rect,2,border_radius=12)
    coach=advisor.mission_coach(e)
    mode=getattr(e,'game_mode','mission')
    draw_text(surf,fonts[2],('MISSION COACH' if mode=='mission' else 'ECONOMIC ADVISOR'),(rect.x+22,rect.y+18),WHITE)
    draw_text(surf,fonts[0],f"Mode: {'Mission Campaign' if mode=='mission' else 'Free Economy / Sandbox'} • G closes guide • the recommended tab is selected automatically",(rect.right-22,rect.y+24),MUTED,'topright')
    draw_text(surf,fonts[1],coach.get('title','Decision Support'),(rect.x+22,rect.y+58),CYAN)

    y=rect.y+86
    goal=coach.get('goal','')
    if goal:
        draw_text(surf,fonts[1],'GOAL',(rect.x+22,y),YELLOW); y+=20
        for line in wrap_text(fonts[0],goal,rect.width-44)[:2]: draw_text(surf,fonts[0],line,(rect.x+22,y),TEXT); y+=16

    targets=coach.get('targets',[])
    if targets:
        y+=4; draw_text(surf,fonts[1],'LIVE TARGETS',(rect.x+22,y),CYAN); y+=22
        colw=max(180,(rect.width-54)//max(1,min(2,len(targets))))
        for i,t in enumerate(targets[:4]):
            rr=pygame.Rect(rect.x+22+(i%2)*(colw+8), y+(i//2)*42, colw,34)
            pygame.draw.rect(surf,CARD2,rr,border_radius=6)
            pygame.draw.rect(surf,GREEN if t.get('ok') else YELLOW,rr,1,border_radius=6)
            draw_text(surf,fonts[0],('✓ ' if t.get('ok') else '○ ')+t.get('label','Metric'),(rr.x+8,rr.y+5),GREEN if t.get('ok') else TEXT)
            draw_text(surf,fonts[0],f"{t.get('current','')} → {t.get('target','')}",(rr.right-8,rr.y+5),MUTED,'topright')
        y+=42*((min(4,len(targets))+1)//2)+6

    if mode=='mission' and coach.get('kind') not in {'free_window','sandbox'}:
        rem=coach.get('remaining')
        draw_text(surf,fonts[0],f"Sustain target: {coach.get('progress',0)}/{coach.get('required',1)} quarter(s) • Remaining: {rem if rem is not None else '-'}Q",(rect.x+22,y),PURPLE); y+=25

    primary=coach.get('primary')
    if primary:
        ph=118
        rr=pygame.Rect(rect.x+22,y,rect.width-44,ph)
        pygame.draw.rect(surf,(38,42,34),rr,border_radius=9);pygame.draw.rect(surf,YELLOW,rr,2,border_radius=9)
        draw_text(surf,fonts[1],'NEXT STEP — GO HERE',(rr.x+12,rr.y+8),YELLOW)
        draw_text(surf,fonts[2],f"{primary.get('tab','Advisor')} → {primary.get('label','Policy')}",(rr.x+12,rr.y+31),WHITE)
        reason=primary.get('reason','')
        for j,line in enumerate(wrap_text(fonts[0],reason,rr.width-24)[:2]): draw_text(surf,fonts[0],line,(rr.x+12,rr.y+65+j*15),TEXT)
        watch='Watch: '+primary.get('watch','GDP, inflation, unemployment')
        draw_text(surf,fonts[0],watch,(rr.x+12,rr.bottom-19),CYAN)
        if not primary.get('ready',True):
            blocked=primary.get('blocked_reason','Policy currently unavailable.')
            draw_text(surf,fonts[0],'BLOCKED: '+blocked,(rr.right-12,rr.bottom-19),RED,'topright')
        y+=ph+10

    # Alternatives/follow-ups remain visible, but visually secondary to the one next step.
    steps=[st for st in coach.get('steps',[]) if not primary or st.get('action')!=primary.get('action')]
    if steps and y<rect.bottom-120:
        draw_text(surf,fonts[1],'AFTER THAT / ALTERNATIVES',(rect.x+22,y),CYAN); y+=22
        for i,st in enumerate(steps[:3],1):
            if y>rect.bottom-88: break
            line=f"{st.get('timing','OPTION')} • {st.get('tab','Advisor')} → {st.get('label',st.get('action','Policy'))}"
            draw_text(surf,fonts[0],line,(rect.x+28,y),TEXT); y+=18

    packages=coach.get('packages',())
    if packages and y<rect.bottom-72:
        names=[POLICY_PACKAGES[p]['name'] for p in packages if p in POLICY_PACKAGES]
        if names: draw_text(surf,fonts[0],'Combined option: '+ ' / '.join(names[:2]),(rect.x+22,y),PURPLE); y+=20
    avoid=coach.get('avoid',())
    if avoid and y<rect.bottom-52:
        names=[ACTION_LABEL.get(a,a) for a in avoid]
        draw_text(surf,fonts[0],'Avoid now: '+ ' • '.join(names),(rect.x+22,y),RED)
    draw_text(surf,fonts[0],coach.get('reassess','Reassess after one quarter.'),(rect.x+22,rect.bottom-28),YELLOW)


def draw_help_overlay(surf, rect, fonts):
    shade=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA);shade.fill((8,12,18,235));surf.blit(shade,rect.topleft)
    pygame.draw.rect(surf,CYAN,rect,2,border_radius=12)
    draw_text(surf,fonts[2],'MAP & GAME CONTROLS',(rect.x+22,rect.y+18),WHITE)
    rows=[
        ('WASD / Arrows','Pan the city camera'), ('Mouse wheel / +/-','Zoom in or out'),
        ('Right-drag','Drag the map'), ('0','Reset camera'), ('SPACE','Pause / resume'),
        ('1 / 2 / 3','Simulation speed'), ('N','Advance one quarter'), ('F','Focus Mode: maximize map'),
        ('V','Toggle 2D / 2.5D graphics'), ('L','Toggle map/building labels'), ('H','Economic wealth heatmap'),
        ('J','Citizen Chirper feed'), ('O','Objective detail panel'), ('T','Toggle rain'),
        ('C','Enable/disable random crises'), ('M','Switch Mission / Sandbox mode'), ('G','Mission/Advisor step-by-step guide'),
        ('K','Cabinet Mix builder: combine 2–4 policies'), ('ENTER','Deploy Cabinet Mix when builder is active'),
        ('Q','Quarterly economic brief / causal drivers'), ('P','Economic legacy snapshot'),
        ('F1','Open or close this controls guide'), ('F2','Return to Mission/Sandbox mode menu'), ('R','Start a new game in the current mode')
    ]
    y=rect.y+66
    colw=(rect.width-60)//2
    for i,(key,desc) in enumerate(rows):
        col=i%2; row=i//2; x=rect.x+22+col*(colw+15); yy=y+row*31
        pygame.draw.rect(surf,CARD2,(x,yy,colw,25),border_radius=5)
        draw_text(surf,fonts[1],key,(x+8,yy+4),CYAN)
        draw_text(surf,fonts[0],desc,(x+118,yy+5),TEXT)
    draw_text(surf,fonts[0],'Tip: Focus Mode is for exploring the city; normal mode keeps the charts and policy room visible.',(rect.centerx,rect.bottom-26),YELLOW,'midtop')

def draw_map_mode_badges(surf, rect, fonts, visual_mode, focus_mode, show_labels):
    pygame.draw.rect(surf,(10,15,22),rect,border_radius=8)
    text=f'F Focus: {"ON" if focus_mode else "OFF"} • V Graphics: {visual_mode} • L Labels: {"ON" if show_labels else "OFF"} • G Guide • K Mix • Q Brief • P Legacy • F1 Keys'
    draw_text(surf,fonts[0],text,(rect.x+10,rect.y+6),TEXT)

def city_to_screen(wx,wy,view_rect,camera,zoom):
    cx,cy=camera;return (view_rect.centerx+(wx-cx)*zoom, view_rect.centery+(wy-cy)*zoom)

def screen_to_city(px,py,view_rect,camera,zoom):
    cx,cy=camera;return (cx+(px-view_rect.centerx)/zoom, cy+(py-view_rect.centery)/zoom)

def blit_city_view(target,world,view_rect,camera,zoom):
    cx,cy=camera;src_w=min(WORLD_W,view_rect.width/max(.01,zoom));src_h=min(WORLD_H,view_rect.height/max(.01,zoom))
    sx=clamp(cx-src_w/2,0,WORLD_W-src_w);sy=clamp(cy-src_h/2,0,WORLD_H-src_h)
    sr=pygame.Rect(int(sx),int(sy),max(1,int(src_w)),max(1,int(src_h)))
    img=pygame.transform.smoothscale(world.subsurface(sr),(view_rect.width,view_rect.height));target.blit(img,view_rect)
    return sr
# =============================================================================
# MACROSTATE FINAL — decision feedback / end-of-run presentation
# =============================================================================

def _signed_pp(v):
    return f'{v*100:+.2f}pp'


def draw_policy_preview(surf, preview, rect, fonts):
    """Compact counterfactual card for a hovered policy or package."""
    pygame.draw.rect(surf, CARD, rect, border_radius=9)
    pygame.draw.rect(surf, GRID, rect, 1, border_radius=9)
    draw_text(surf, fonts[1], 'EXPECTED POLICY PATH', (rect.x+12, rect.y+9), CYAN)
    if not preview:
        draw_text(surf, fonts[0], 'Hover a policy to compare it with a no-new-policy baseline.', (rect.x+12, rect.y+38), MUTED)
        return
    if not preview.get('available', True):
        draw_text(surf, fonts[1], preview.get('label','Policy'), (rect.x+12, rect.y+37), TEXT)
        for i,line in enumerate(wrap_text(fonts[0], preview.get('reason','Unavailable'), rect.width-24)[:4]):
            draw_text(surf, fonts[0], line, (rect.x+12, rect.y+65+i*16), RED)
        return
    draw_text(surf, fonts[1], preview.get('label','Policy'), (rect.x+12, rect.y+35), WHITE)
    risk=preview.get('risk','MEDIUM')
    rc=GREEN if risk=='LOW' else YELLOW if risk=='MEDIUM' else RED
    draw_text(surf, fonts[0], 'Model risk: '+risk, (rect.right-12, rect.y+38), rc, 'topright')
    imm=preview.get('immediate',{})
    now_bits=[]
    if abs(imm.get('policy_rate',0))>.00001: now_bits.append(f"Rate {_signed_pp(imm.get('policy_rate',0))}")
    if abs(imm.get('debt',0))>.00001: now_bits.append(f"Debt/GDP {_signed_pp(imm.get('debt',0))}")
    if abs(imm.get('treasury',0))>.01: now_bits.append(f"Treasury {imm.get('treasury',0):+.0f}B")
    if now_bits: draw_text(surf,fonts[0],'NOW: '+' • '.join(now_bits),(rect.x+12,rect.y+58),YELLOW)
    headers=[('1Q', preview.get('q1',{})), ('4Q', preview.get('q4',{}))]
    y=rect.y+80
    for title,data in headers:
        draw_text(surf, fonts[1], title, (rect.x+12,y), CYAN)
        vals=[
            ('GDP', _signed_pp(data.get('gdp',0))),
            ('Inflation', _signed_pp(data.get('inflation',0))),
            ('Unemployment', _signed_pp(data.get('unemployment',0))),
            ('Debt/GDP', _signed_pp(data.get('debt',0))),
        ]
        x=rect.x+62
        for label,val in vals:
            draw_text(surf, fonts[0], f'{label} {val}', (x,y+1), TEXT)
            x += 85 if label=='GDP' else 118
        y += 24
    note=preview.get('note','')
    if note:
        draw_text(surf, fonts[0], note[:90], (rect.x+12, rect.bottom-20), MUTED)


def draw_advisor_council(surf, perspectives, rect, fonts):
    """Compact three-desk council. Every line is width-bounded and non-overlapping."""
    pygame.draw.rect(surf, CARD, rect, border_radius=9)
    pygame.draw.rect(surf, GRID, rect, 1, border_radius=9)
    draw_text(surf, fonts[1], 'CABINET COUNCIL', (rect.x+12, rect.y+8), CYAN)
    draw_text(surf, fonts[0], 'three different priorities', (rect.right-12, rect.y+10), MUTED, 'topright')
    top = rect.y + 31
    usable = rect.bottom - top - 7
    row_h = max(42, usable // 3)
    for i,p in enumerate(perspectives[:3]):
        y = top + i * row_h
        rr=pygame.Rect(rect.x+8, y, rect.width-16, row_h-4)
        pygame.draw.rect(surf, CARD2, rr, border_radius=6)
        col=(BLUE,CYAN,PURPLE)[i%3]
        pygame.draw.rect(surf,col,(rr.x,rr.y,4,rr.height),border_radius=3)
        name = fit_text(fonts[1], p.get('name','ADVISOR'), rr.width*0.48)
        priority = fit_text(fonts[0], p.get('priority',''), rr.width*0.43)
        draw_text(surf, fonts[1], name, (rr.x+10,rr.y+4), col)
        draw_text(surf, fonts[0], priority, (rr.right-8,rr.y+6), MUTED,'topright')
        action=f"{p.get('tab','')} → {p.get('label','')}"
        action=fit_text(fonts[0], action, rr.width-20)
        draw_text(surf, fonts[0], action, (rr.x+10,rr.y+21), WHITE if p.get('ready',True) else RED)
        stance=fit_text(fonts[0], p.get('stance',''), rr.width-20)
        draw_text(surf, fonts[0], stance, (rr.x+10,rr.y+36), MUTED)


def draw_custom_mix_panel(surf, e, actions, rect, fonts):
    pygame.draw.rect(surf, (25,31,41), rect, border_radius=10)
    pygame.draw.rect(surf, PURPLE, rect, 2, border_radius=10)
    draw_text(surf, fonts[1], 'CABINET MIX BUILDER', (rect.x+12,rect.y+8), PURPLE)
    if not actions:
        draw_text(surf, fonts[0], 'K builder ON • click 2–4 individual policies • ENTER deploy • BACKSPACE clear', (rect.x+12,rect.y+35), MUTED)
        return
    cap,pol=e.custom_mix_cost(actions) if hasattr(e,'custom_mix_cost') else (0,0)
    ok,reason=e.can_enact_custom_mix(actions) if hasattr(e,'can_enact_custom_mix') else (False,'Unavailable')
    draw_text(surf, fonts[0], f'{len(actions)}/4 levers • Capacity {cap:.0f} • Political {pol:.0f}', (rect.right-12,rect.y+10), GREEN if ok else YELLOW,'topright')
    y=rect.y+36
    names=[ACTION_LABEL.get(a,a) for a in actions]
    for line in wrap_text(fonts[0],' + '.join(names),rect.width-24)[:3]:
        draw_text(surf, fonts[0], line, (rect.x+12,y), TEXT); y+=16
    draw_text(surf, fonts[0], 'ENTER: deploy mix' if ok else 'BLOCKED: '+reason, (rect.x+12,rect.bottom-20), GREEN if ok else RED)


def draw_quarter_report(surf, e, rect, fonts):
    """Explain what changed this quarter and why."""
    shade=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA);shade.fill((8,12,18,246));surf.blit(shade,rect.topleft)
    pygame.draw.rect(surf,CYAN,rect,2,border_radius=12)
    report=getattr(e,'last_quarter_report',{}) or {}
    draw_text(surf,fonts[2],f"QUARTERLY ECONOMIC BRIEF — {report.get('period',f'Q{e.quarter} {e.year}')}",(rect.x+22,rect.y+18),WHITE)
    draw_text(surf,fonts[0],'Q closes • changes are versus the previous quarter; drivers are model attribution, not certainty.',(rect.right-22,rect.y+25),MUTED,'topright')
    cards=[
        ('GDP',f"{report.get('gdp_change',0):+,.1f}B",GREEN if report.get('gdp_change',0)>=0 else RED),
        ('INFLATION',_signed_pp(report.get('inflation_change',0)),GREEN if report.get('inflation_change',0)<=0 else RED),
        ('UNEMPLOYMENT',_signed_pp(report.get('unemployment_change',0)),GREEN if report.get('unemployment_change',0)<=0 else RED),
        ('DEBT/GDP',_signed_pp(report.get('debt_change',0)),GREEN if report.get('debt_change',0)<=0 else YELLOW),
        ('APPROVAL',_signed_pp(report.get('approval_change',0)),GREEN if report.get('approval_change',0)>=0 else RED),
    ]
    gap=8; cw=(rect.width-44-gap*4)//5; y=rect.y+60
    for i,(name,val,col) in enumerate(cards):
        rr=pygame.Rect(rect.x+22+i*(cw+gap),y,cw,58);pygame.draw.rect(surf,CARD2,rr,border_radius=7)
        draw_text(surf,fonts[0],name,(rr.centerx,rr.y+8),MUTED,'midtop');draw_text(surf,fonts[1],val,(rr.centerx,rr.y+29),col,'midtop')
    y += 78
    colw=(rect.width-52)//2
    left=pygame.Rect(rect.x+22,y,colw,rect.height-y+rect.y-74)
    right=pygame.Rect(left.right+8,y,colw, left.height)
    for rr,title in ((left,'INFLATION — WHY'),(right,'GDP — WHY')):
        pygame.draw.rect(surf,CARD,rr,border_radius=8);draw_text(surf,fonts[1],title,(rr.x+12,rr.y+10),CYAN)
    inf=sorted(getattr(e,'inflation_drivers',{}).items(),key=lambda kv:abs(kv[1]),reverse=True)[:6]
    gdp=sorted(getattr(e,'gdp_drivers',{}).items(),key=lambda kv:abs(kv[1]),reverse=True)[:5]
    yy=left.y+38
    for k,v in inf:
        col=RED if v>0 else GREEN
        draw_text(surf,fonts[0],k,(left.x+12,yy),TEXT);draw_text(surf,fonts[0],_signed_pp(v),(left.right-12,yy),col,'topright');yy+=22
    yy=right.y+38
    for k,v in gdp:
        col=GREEN if v>0 else RED
        draw_text(surf,fonts[0],k,(right.x+12,yy),TEXT);draw_text(surf,fonts[0],_signed_pp(v),(right.right-12,yy),col,'topright');yy+=22
    draw_text(surf,fonts[0],'SPACE / Q closes • use the result to adapt rather than stack policies immediately.',(rect.centerx,rect.bottom-29),YELLOW,'midtop')


def draw_legacy_report(surf, report, rect, fonts, game_status='RUNNING', reason=''):
    shade=pygame.Surface((rect.width,rect.height),pygame.SRCALPHA);shade.fill((6,10,16,250));surf.blit(shade,rect.topleft)
    border=GREEN if game_status=='WON' else YELLOW if game_status=='RUNNING' else RED
    pygame.draw.rect(surf,border,rect,2,border_radius=14)
    draw_text(surf,fonts[2],'YOUR ECONOMIC LEGACY',(rect.centerx,rect.y+18),WHITE,'midtop')
    draw_text(surf,fonts[1],report.get('title','Economic Legacy'),(rect.centerx,rect.y+56),border,'midtop')
    if reason:
        for i,line in enumerate(wrap_text(fonts[0],reason,rect.width-90)[:2]):draw_text(surf,fonts[0],line,(rect.centerx,rect.y+86+i*16),MUTED,'midtop')
    pillars=report.get('pillars',{})
    y=rect.y+126; gap=12; cw=(rect.width-56-gap*3)//4
    for i,(name,val) in enumerate(pillars.items()):
        rr=pygame.Rect(rect.x+22+i*(cw+gap),y,cw,90);pygame.draw.rect(surf,CARD,rr,border_radius=8)
        col=GREEN if val>=68 else YELLOW if val>=48 else RED
        draw_text(surf,fonts[0],name.upper(),(rr.centerx,rr.y+10),MUTED,'midtop');draw_text(surf,fonts[2],f'{val:.0f}',(rr.centerx,rr.y+32),col,'midtop')
        pygame.draw.rect(surf,(48,56,68),(rr.x+12,rr.bottom-18,rr.width-24,7),border_radius=3);pygame.draw.rect(surf,col,(rr.x+12,rr.bottom-18,int((rr.width-24)*clamp(val/100,0,1)),7),border_radius=3)
    av=report.get('averages',{});start=report.get('start',{});end=report.get('end',{})
    y+=112
    left=pygame.Rect(rect.x+22,y,(rect.width-52)//2,185);right=pygame.Rect(left.right+8,y,left.width,185)
    pygame.draw.rect(surf,CARD,left,border_radius=8);pygame.draw.rect(surf,CARD,right,border_radius=8)
    draw_text(surf,fonts[1],'MANDATE AVERAGES',(left.x+12,left.y+10),CYAN)
    rows=[('Growth',pct(av.get('growth',0))),('Inflation',pct(av.get('inflation',0))),('Unemployment',pct(av.get('unemployment',0))),('Missions',f"{report.get('missions_completed',0)} completed"),('Quarters',str(report.get('quarters',0)))]
    yy=left.y+40
    for k,v in rows:draw_text(surf,fonts[0],k,(left.x+12,yy),MUTED);draw_text(surf,fonts[0],v,(left.right-12,yy),TEXT,'topright');yy+=27
    draw_text(surf,fonts[1],'START → FINISH',(right.x+12,right.y+10),CYAN)
    rows=[('Real GDP',f"{start.get('real_gdp',0):.0f} → {end.get('real_gdp',0):.0f}"),('Debt/GDP',f"{pct(start.get('debt_ratio',0))} → {pct(end.get('debt_ratio',0))}"),('Poverty',f"{pct(start.get('poverty',0))} → {pct(end.get('poverty',0))}"),('Housing',f"{start.get('housing_affordability',0):.2f} → {end.get('housing_affordability',0):.2f}"),('Tech',f"{start.get('technology_index',0):.0f} → {end.get('technology_index',0):.0f}")]
    yy=right.y+40
    for k,v in rows:draw_text(surf,fonts[0],k,(right.x+12,yy),MUTED);draw_text(surf,fonts[0],v,(right.right-12,yy),TEXT,'topright');yy+=27
    draw_text(surf,fonts[0],f"Strongest: {report.get('strongest','-')} • Weakest: {report.get('weakest','-')}",(rect.centerx,rect.bottom-46),YELLOW,'midtop')
    footer = 'P / ESC / ENTER: close snapshot' if game_status == 'RUNNING' else 'ENTER: new game • ESC: mode menu'
    draw_text(surf,fonts[0],footer,(rect.centerx,rect.bottom-25),MUTED,'midtop')
