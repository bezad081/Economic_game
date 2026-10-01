import pygame
import random
import math
import asyncio
import sys

from economy import (
    EconomyV12, Advisor, CityEconomy, TransportSystem, POLICY_PACKAGES, ACTION_LABEL, 
    advisor_route, clamp, money, pct
)
from visuals import (
    DESIGN_W, DESIGN_H, WORLD_W, WORLD_H, FPS, BG, PANEL, CARD, CARD2, GRID, 
    TEXT, MUTED, GREEN, RED, YELLOW, BLUE, PURPLE, CYAN, ORANGE, WHITE,
    SPECIALS, NARUTO_HOME, CitizenV4, SwayTree, CityAnimal, MovingCar, 
    Motorcycle, RoadServiceVehicle, CargoShip, MetroTrainV4, IntercityTrainV8, 
    AirportPlane, FireTruck, Button, anchors_from_buildings, build_homes, building_rect, 
    draw_world, metric_card, draw_text, wrap_text, fit_text, draw_policy_impact_hud, 
    draw_citizen_panel, draw_business_panel, pick_citizen_at, pick_building_at, 
    build_buttons_v4, broadcast_reaction, transmission_reaction, blit_city_view, 
    draw_chirper_feed, draw_event_ticker, draw_policy_capacity, draw_macro_driver_panel, draw_macro_driver_compact, draw_game_banner,
    draw_objective_panel, draw_package_brief, draw_help_overlay, draw_mission_guidance, draw_map_mode_badges,
    draw_policy_preview, draw_advisor_council, draw_custom_mix_panel, draw_quarter_report, draw_legacy_report,
    choose_profession, screen_to_city, BUILDINGS, TrafficController, draw_atmosphere_overlay
)

GAME_NAME = 'MACROSTATE'
GAME_SUBTITLE = 'THE ECONOMIC STRATEGY GAME'
GAME_EDITION = 'WEB V2 — SYSTEMS EDITION'
IS_WEB = sys.platform == 'emscripten'

def _scale_button_rect(screen, w, h, cy):
    sw, sh = screen.get_size()
    return pygame.Rect(sw//2-w//2, int(cy-h/2), w, h)

async def run_cinematic_intro(screen, clock, fonts):
    """Short self-contained intro: skyline + economic pulse + logo reveal."""
    start = pygame.time.get_ticks()/1000.0
    duration = 3.2
    rng = random.Random(42)
    skyline = [(i*46-20, rng.randint(70,210), rng.randint(30,42)) for i in range(34)]
    particles = [(rng.random(), rng.random(), rng.uniform(.25,.75)) for _ in range(45)]
    while True:
        now = pygame.time.get_ticks()/1000.0
        t = now-start
        if t >= duration: break
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT: return False
            if ev.type in (pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN): return True
        sw,sh=screen.get_size(); screen.fill((5,9,15))
        # Vertical atmospheric bands.
        for y in range(0,sh,8):
            k=y/max(1,sh); col=(5+int(8*k),9+int(15*k),15+int(24*k)); pygame.draw.rect(screen,col,(0,y,sw,8))
        for px,py,sp in particles:
            x=int((px*sw + t*24*sp)%sw); y=int(py*sh*.72); pygame.draw.circle(screen,(35,70,95),(x,y),1)
        base_y=int(sh*.78)
        for x,h,w in skyline:
            sx=int(x*sw/1440); bw=max(8,int(w*sw/1440)); bh=int(h*sh/900)
            pygame.draw.rect(screen,(13,24,34),(sx,base_y-bh,bw,bh))
            if t>1.0:
                for wy in range(base_y-bh+10,base_y-8,16):
                    if (wy+sx)//7%3: pygame.draw.rect(screen,(80,125,145),(sx+6,wy,max(2,bw-12),3))
        # Animated market line.
        pts=[]
        for i in range(90):
            x=sw*.10+i*(sw*.80/89); phase=i/9
            y=sh*.62 - math.sin(phase)*14 - i*(sh*.11/89) + math.sin(phase*.37+1.4)*7
            pts.append((int(x),int(y)))
        reveal=max(2,int(len(pts)*clamp((t-.35)/1.35,0,1)))
        if reveal>2: pygame.draw.lines(screen,(65,190,210),False,pts[:reveal],2)
        alpha=clamp((t-.55)/.75,0,1)
        if alpha>0:
            title=fonts[3].render(GAME_NAME,True,(240,246,252)); title.set_alpha(int(255*alpha)); screen.blit(title,title.get_rect(center=(sw//2,int(sh*.31))))
            sub=fonts[1].render(GAME_SUBTITLE,True,(95,205,220)); sub.set_alpha(int(255*alpha)); screen.blit(sub,sub.get_rect(center=(sw//2,int(sh*.38))))
        if t>2.0:
            cap=fonts[0].render('Every decision moves the economy.',True,(155,172,192)); screen.blit(cap,cap.get_rect(center=(sw//2,int(sh*.45))))
        skip=fonts[0].render('Press any key to skip',True,(100,115,135)); screen.blit(skip,skip.get_rect(center=(sw//2,sh-28)))
        pygame.display.flip(); clock.tick(60)
        await asyncio.sleep(0)
    return True

async def show_title_menu(screen, clock, fonts, play_intro=True):
    if play_intro and not await run_cinematic_intro(screen,clock,fonts): return 'quit'
    pulse=0.0
    while True:
        dt=clock.tick(60)/1000.0; pulse+=dt
        sw,sh=screen.get_size(); screen.fill((6,10,17))
        # skyline backdrop
        base=int(sh*.82)
        for i in range(26):
            bw=max(16,int(sw/32)); h=int((55+(i*37)%150)*sh/900); x=i*(sw//25)-8
            pygame.draw.rect(screen,(12,23,34),(x,base-h,bw,h))
            for yy in range(base-h+12,base-8,19):
                if (i+yy//19)%3: pygame.draw.rect(screen,(45,78,96),(x+5,yy,max(3,bw-10),3))
        title=fonts[3].render(GAME_NAME,True,(242,247,252)); screen.blit(title,title.get_rect(center=(sw//2,int(sh*.20))))
        sub=fonts[1].render(GAME_SUBTITLE,True,(72,198,210)); screen.blit(sub,sub.get_rect(center=(sw//2,int(sh*.27))))
        edition=fonts[0].render(GAME_EDITION,True,(145,160,180)); screen.blit(edition,edition.get_rect(center=(sw//2,int(sh*.315))))
        start_r=_scale_button_rect(screen,min(420,sw-80),64,sh*.52)
        how_r=_scale_button_rect(screen,min(420,sw-80),54,sh*.63)
        quit_r=_scale_button_rect(screen,min(420,sw-80),54,sh*.72)
        mouse=pygame.mouse.get_pos()
        for rect,label,accent in ((start_r,'START',(65,190,110)),(how_r,'HOW TO PLAY',(75,145,245)),(quit_r,'QUIT',(180,76,82))):
            hover=rect.collidepoint(mouse); basec=(29,39,52) if not hover else (38,53,69)
            pygame.draw.rect(screen,basec,rect,border_radius=12);pygame.draw.rect(screen,accent,rect,2+(1 if hover else 0),border_radius=12)
            f=fonts[2] if label=='START' else fonts[1]; txt=f.render(label,True,(242,246,250));screen.blit(txt,txt.get_rect(center=rect.center))
        foot=fonts[0].render('Mission campaign • Free economy • Living citizens • Policy trade-offs',True,(115,132,153));screen.blit(foot,foot.get_rect(center=(sw//2,sh-32)))
        pygame.display.flip()
        await asyncio.sleep(0)
        for ev in pygame.event.get():
            if ev.type==pygame.QUIT:return 'quit'
            if ev.type==pygame.KEYDOWN:
                if ev.key in (pygame.K_RETURN,pygame.K_SPACE): return 'start'
                if ev.key==pygame.K_ESCAPE:return 'quit'
                if ev.key==pygame.K_h:return 'help'
            if ev.type==pygame.MOUSEBUTTONDOWN and ev.button==1:
                if start_r.collidepoint(ev.pos):return 'start'
                if how_r.collidepoint(ev.pos):return 'help'
                if quit_r.collidepoint(ev.pos):return 'quit'

async def show_title_help(screen,clock,fonts):
    while True:
        sw,sh=screen.get_size();screen.fill((7,11,18))
        panel=pygame.Rect(max(25,sw//2-480),max(25,sh//2-310),min(960,sw-50),min(620,sh-50))
        pygame.draw.rect(screen,(18,24,33),panel,border_radius=16);pygame.draw.rect(screen,(72,198,210),panel,2,border_radius=16)
        screen.blit(fonts[2].render('HOW MACROSTATE PLAYS',True,(242,246,250)),(panel.x+28,panel.y+24))
        lines=[
            '1. OBSERVE — read the city, dashboard, news and household/business signals.',
            '2. DIAGNOSE — use Advisor, inflation/GDP drivers and competing cabinet views.',
            '3. DECIDE — enact one policy, a preset package, or build a custom Cabinet Mix.',
            '4. WAIT — policies have lags. Advancing immediately can create policy clashes.',
            '5. EXPLAIN — press Q after a quarter to see what moved GDP and inflation.',
            '6. ADAPT — missions teach progressively; Sandbox creates its own economic story.',
            '',
            'Core keys: G guide • K custom mix • Q quarterly brief • F focus map • F1 controls',
            'Mission: complete objectives and preserve a viable mandate. Sandbox: no fixed ending.',
        ]
        y=panel.y+80
        for line in lines:
            col=(72,198,210) if line and line[0].isdigit() else (190,202,218)
            screen.blit(fonts[0].render(line,True,col),(panel.x+32,y));y+=34
        back=fonts[1].render('ESC / ENTER — BACK',True,(240,192,80));screen.blit(back,back.get_rect(center=(panel.centerx,panel.bottom-35)))
        pygame.display.flip()
        await asyncio.sleep(0)
        for ev in pygame.event.get():
            if ev.type==pygame.QUIT:return False
            if ev.type==pygame.KEYDOWN and ev.key in (pygame.K_ESCAPE,pygame.K_RETURN,pygame.K_SPACE):return True
        clock.tick(60)

def create_session(anchors):
    """Create a complete, internally consistent game session."""
    e = EconomyV12()
    citizens = []
    for i, special in enumerate(SPECIALS):
        ax, ay = anchors['police'] if special in {'Naruto', 'Sasuke', 'Kakashi', 'Guy'} else anchors['hospital'] if special == 'Sakura' else anchors['hokage']
        citizens.append(CitizenV4(i, ax + random.uniform(-45, 45), ay + random.uniform(-35, 35), special=special))
    for i in range(len(citizens), 165):
        citizens.append(CitizenV4(i, random.uniform(120, 1260), random.uniform(120, 980), profession=choose_profession()))

    cityecon = CityEconomy(citizens)
    homes = build_homes(citizens)
    e.housing.initialize_households(citizens, homes, e)
    for c in citizens:
        if c.special == 'Naruto':
            c.home_anchor = NARUTO_HOME
            c.home_type = 'villa'
            c.home_id = -99
    return e, citizens, cityecon, homes


async def choose_game_mode(screen, clock, fonts):
    """Simple start screen that makes Mission Campaign and Free Economy distinct modes."""
    while True:
        sw, sh = screen.get_size()
        screen.fill((7, 11, 18))
        title = fonts[3].render(GAME_NAME, True, (240, 244, 250))
        screen.blit(title, title.get_rect(center=(sw//2, max(70, sh//6))))
        sub = fonts[1].render('Choose a campaign structure', True, (155, 172, 192))
        screen.blit(sub, sub.get_rect(center=(sw//2, max(112, sh//6 + 52))))

        bw, bh = min(430, sw//2-40), 190
        gap = 28
        left = pygame.Rect(sw//2-bw-gap//2, sh//2-bh//2, bw, bh)
        right = pygame.Rect(sw//2+gap//2, sh//2-bh//2, bw, bh)
        mouse = pygame.mouse.get_pos()
        for rect, accent in ((left,(75,145,245)),(right,(65,190,110))):
            base = (27,36,49) if not rect.collidepoint(mouse) else (34,47,64)
            pygame.draw.rect(screen, base, rect, border_radius=16)
            pygame.draw.rect(screen, accent, rect, 3, border_radius=16)

        screen.blit(fonts[2].render('MISSION CAMPAIGN', True, (235,240,248)), (left.x+24,left.y+20))
        lines = [
            'Periodic objectives with deadlines and rewards.',
            'Press G for exact step-by-step policy guidance.',
            'Crises and random economic developments still happen.',
            'Win the national mandate by completing missions.',
        ]
        for i,line in enumerate(lines):
            screen.blit(fonts[0].render(line, True, (170,184,202)), (left.x+24,left.y+62+i*25))

        screen.blit(fonts[2].render('FREE ECONOMY / SANDBOX', True, (235,240,248)), (right.x+24,right.y+20))
        lines = [
            'No formal missions and no fixed victory condition.',
            'Inflation, housing booms, FX pressure and slumps arise.',
            'Occasional crises interrupt the normal economy.',
            'Use the Advisor and build your own strategy.',
        ]
        for i,line in enumerate(lines):
            screen.blit(fonts[0].render(line, True, (170,184,202)), (right.x+24,right.y+62+i*25))

        foot = fonts[0].render('Click a mode  •  1 = Mission  •  2 = Sandbox  •  Esc = Title', True, (130,145,165))
        screen.blit(foot, foot.get_rect(center=(sw//2, min(sh-35, sh//2+bh//2+55))))
        pygame.display.flip()
        await asyncio.sleep(0)

        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                return None
            if ev.type == pygame.KEYDOWN:
                if ev.key == pygame.K_ESCAPE: return 'title'
                if ev.key == pygame.K_1: return 'mission'
                if ev.key == pygame.K_2: return 'sandbox'
            if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1:
                if left.collidepoint(ev.pos): return 'mission'
                if right.collidepoint(ev.pos): return 'sandbox'
        clock.tick(60)

async def main():
    pygame.init()
    pygame.display.set_caption(f'{GAME_NAME} — {GAME_SUBTITLE}')
    screen = pygame.display.set_mode((1280, 780), pygame.RESIZABLE)
    clock = pygame.time.Clock()
    canvas = pygame.Surface((DESIGN_W, DESIGN_H))
    fonts = (
        pygame.font.SysFont('segoeui', 14),
        pygame.font.SysFont('segoeui', 17, bold=True),
        pygame.font.SysFont('segoeui', 25, bold=True),
        pygame.font.SysFont('segoeui', 34, bold=True)
    )
    first_title = True
    while True:
        title_action = await show_title_menu(screen, clock, fonts, play_intro=first_title)
        first_title = False
        if title_action == 'quit':
            pygame.quit(); return
        if title_action == 'help':
            if not await show_title_help(screen, clock, fonts):
                pygame.quit(); return
            continue
        selected_mode = await choose_game_mode(screen, clock, fonts)
        if selected_mode is None:
            pygame.quit(); return
        if selected_mode == 'title':
            continue
        break
    
    advisor = Advisor()
    groups = build_buttons_v4()
    tabs = ['Monetary', 'Fiscal', 'Structural', 'Trade', 'Combined', 'Crisis', 'Emergency', 'Advisor']
    active_tab = 'Monetary'
    paused = False
    speed = 1
    acc = 0
    running = True
    selected = None
    selected_business = None
    random_weather = True
    raining = False
    show_heatmap = False
    show_help = False
    show_mission_guide = False
    guided_action = None
    focus_mode = False
    visual_mode = '2.5D'
    show_labels = False
    show_chirper = False
    show_objectives = True
    show_quarter_report = False
    quarter_notice_timer = 0.0
    report_was_paused = False
    show_legacy = False
    legacy_manual = False
    legacy_was_paused = False
    mix_mode = False
    custom_mix = []

    world = pygame.Surface((WORLD_W, WORLD_H))
    anchors = anchors_from_buildings()
    e, citizens, cityecon, homes = create_session(anchors)
    if selected_mode != 'mission':
        e.set_game_mode(selected_mode)
    transport = TransportSystem()

    trees = [
        SwayTree(45 + (i * 91) % 1280, 145 + (i * 137) % 760, random.uniform(0.75, 1.25)) 
        for i in range(34) 
        if not any(building_rect(k).inflate(35, 35).collidepoint(45 + (i * 91) % 1280, 145 + (i * 137) % 760) for k in BUILDINGS)
    ]
    
    animals = (
        [CityAnimal(random.uniform(860, 1040), random.uniform(660, 735), random.choice(['cow', 'goat'])) for _ in range(8)] + 
        [CityAnimal(random.uniform(120, 1180), random.uniform(350, 920), random.choice(['dog', 'cat'])) for _ in range(7)]
    )
    
    cars = [MovingCar(y, d) for y in [285, 535, 810] for d in [1, -1] for _ in range(3)]
    motorcycles = [Motorcycle() for _ in range(10)]
    buses = [RoadServiceVehicle('bus') for _ in range(4)]
    taxis = [RoadServiceVehicle('taxi') for _ in range(8)]
    traffic = TrafficController()
    ships = [CargoShip() for _ in range(6)]
    firetruck = FireTruck()
    
    transport.refresh(citizens, buses, taxis, e)
    metro = MetroTrainV4()
    intercity = IntercityTrainV8()
    plane = AirportPlane()
    
    world_time = 8.0
    last_period = (e.year, e.quarter)
    buttons = []
    zoom = 0.92
    camera = [900.0, 540.0]
    dragging = False
    drag_last = (0, 0)
    last_action = 'None'
    last_impulse = None
    was_night = False
    hovered_action = None

    def sync_quarter_state():
        nonlocal last_period, raining, quarter_notice_timer, show_legacy, legacy_manual, paused
        if (e.year, e.quarter) != last_period:
            for c in citizens:
                c.macro_update(e)
            cityecon.step_quarter(citizens, e)
            e.housing.step_quarter(citizens, e)
            transport.refresh(citizens, buses, taxis, e)
            last_period = (e.year, e.quarter)
            quarter_notice_timer = 4.0
            if random_weather and random.random() < 0.20:
                raining = not raining
        if getattr(e, 'game_status', 'RUNNING') != 'RUNNING':
            legacy_manual = False
            show_legacy = True
            paused = True

    def advance_quarter(manual=False):
        nonlocal acc
        e.step_quarter()
        acc = 0
        sync_quarter_state()

    def reset_session(mode):
        nonlocal e, citizens, cityecon, homes, selected, selected_business, camera, zoom
        nonlocal last_period, last_action, last_impulse, world_time, acc, paused, guided_action
        nonlocal show_legacy, legacy_manual, show_quarter_report, quarter_notice_timer, mix_mode, custom_mix
        e, citizens, cityecon, homes = create_session(anchors)
        if mode != 'mission':
            e.set_game_mode(mode)
        transport.refresh(citizens, buses, taxis, e)
        selected = None; selected_business = None; guided_action = None
        camera = [900.0, 540.0]; zoom = 0.92
        last_period = (e.year, e.quarter); last_action = 'New ' + mode + ' session'; last_impulse = None
        world_time = 8.0; acc = 0; paused = False
        show_legacy = False; legacy_manual = False; show_quarter_report = False; quarter_notice_timer = 0.0
        mix_mode = False; custom_mix = []

    while running:
        dt = min(clock.tick(FPS) / 1000, 0.05)
        if quarter_notice_timer > 0:
            quarter_notice_timer = max(0.0, quarter_notice_timer - dt)
        sw, sh = screen.get_size()
        fit = min(sw / DESIGN_W, sh / DESIGN_H)
        ow = int(DESIGN_W * fit)
        oh = int(DESIGN_H * fit)
        ox = (sw - ow) // 2
        oy = (sh - oh) // 2
        
        panel_w = 0 if focus_mode else 420
        bottom_h = 0 if focus_mode else 245
        view_rect = pygame.Rect(0, 0, DESIGN_W - panel_w, DESIGN_H - bottom_h)
        side = pygame.Rect(DESIGN_W - panel_w, 0, panel_w, DESIGN_H)
        bottom = pygame.Rect(0, DESIGN_H - bottom_h, DESIGN_W - panel_w, bottom_h)
        
        def phys_to_canvas(p):
            return ((p[0] - ox) / max(fit, 0.001), (p[1] - oy) / max(fit, 0.001))

        mouse = phys_to_canvas(pygame.mouse.get_pos())
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                running = False
                continue
            if (show_legacy or show_quarter_report) and ev.type != pygame.KEYDOWN:
                continue
            if ev.type == pygame.KEYDOWN:
                if show_legacy:
                    if legacy_manual and ev.key in (pygame.K_p, pygame.K_ESCAPE, pygame.K_RETURN):
                        show_legacy = False
                        legacy_manual = False
                        paused = legacy_was_paused
                    elif not legacy_manual and ev.key == pygame.K_RETURN:
                        reset_session(getattr(e,'game_mode','mission'))
                    elif not legacy_manual and ev.key == pygame.K_ESCAPE:
                        new_mode = await choose_game_mode(screen, clock, fonts)
                        if new_mode is None:
                            running = False
                        elif new_mode != 'title':
                            reset_session(new_mode)
                    continue
                if show_quarter_report:
                    if ev.key in (pygame.K_q, pygame.K_ESCAPE, pygame.K_SPACE, pygame.K_RETURN):
                        show_quarter_report = False
                        paused = report_was_paused
                    continue
                if ev.key == pygame.K_SPACE:
                    paused = not paused
                elif ev.key == pygame.K_1: speed = 1
                elif ev.key == pygame.K_2: speed = 2
                elif ev.key == pygame.K_3: speed = 4
                elif ev.key == pygame.K_n:
                    advance_quarter(manual=True)
                elif ev.key == pygame.K_r:
                    reset_session(getattr(e, 'game_mode', 'mission'))
                elif ev.key == pygame.K_c: e.random_crises_enabled = not e.random_crises_enabled
                elif ev.key == pygame.K_t: raining = not raining
                elif ev.key == pygame.K_h: show_heatmap = not show_heatmap
                elif ev.key == pygame.K_f: focus_mode = not focus_mode
                elif ev.key == pygame.K_v: visual_mode = '2D' if visual_mode == '2.5D' else '2.5D'
                elif ev.key == pygame.K_l: show_labels = not show_labels
                elif ev.key == pygame.K_j: show_chirper = not show_chirper
                elif ev.key == pygame.K_o: show_objectives = not show_objectives
                elif ev.key == pygame.K_m:
                    e.set_game_mode('sandbox' if getattr(e,'game_mode','mission') == 'mission' else 'mission')
                    last_action = 'Mode: ' + e.game_mode
                elif ev.key == pygame.K_g:
                    show_mission_guide = not show_mission_guide
                    if show_mission_guide:
                        coach_now = advisor.mission_coach(e)
                        primary = coach_now.get('primary') or (coach_now.get('steps') or [None])[0]
                        if primary:
                            guided_action = primary.get('action')
                            if primary.get('tab') in tabs:
                                active_tab = primary.get('tab')
                elif ev.key == pygame.K_p:
                    legacy_was_paused = paused
                    paused = True
                    legacy_manual = True
                    show_legacy = True
                elif ev.key == pygame.K_q:
                    if getattr(e,'last_quarter_report',None):
                        report_was_paused = paused
                        paused = True
                        show_quarter_report = True
                elif ev.key == pygame.K_k:
                    mix_mode = not mix_mode
                    if not mix_mode:
                        custom_mix = []
                    last_action = 'Cabinet Mix builder ' + ('ON' if mix_mode else 'OFF')
                elif ev.key == pygame.K_BACKSPACE and mix_mode:
                    custom_mix = []
                    last_action = 'Cabinet Mix cleared'
                elif ev.key == pygame.K_RETURN and mix_mode:
                    if e.enact_custom_mix(custom_mix):
                        for action in custom_mix:
                            broadcast_reaction(citizens, action, ACTION_LABEL.get(action,action))
                        last_action = 'Custom Cabinet Mix'
                        custom_mix = []
                        mix_mode = False
                    else:
                        last_action = 'Blocked: custom mix'
                elif ev.key == pygame.K_F1: show_help = not show_help
                elif ev.key == pygame.K_F2:
                    new_mode = await choose_game_mode(screen, clock, fonts)
                    if new_mode is None:
                        running = False
                    elif new_mode != 'title':
                        selected_mode = new_mode
                        reset_session(selected_mode)
                elif ev.key == pygame.K_ESCAPE and (show_help or show_mission_guide):
                    show_help = False; show_mission_guide = False
                elif ev.key in (pygame.K_PLUS, pygame.K_EQUALS): zoom = clamp(zoom * 1.15, 0.55, 2.6)
                elif ev.key == pygame.K_MINUS: zoom = clamp(zoom / 1.15, 0.55, 2.6)
                elif ev.key == pygame.K_0: zoom = 0.92; camera = [900.0, 540.0]
            elif ev.type == pygame.MOUSEWHEEL:
                mx, my = phys_to_canvas(pygame.mouse.get_pos())
                if view_rect.collidepoint(mx, my):
                    zoom = clamp(zoom * (1.12 ** ev.y), 0.55, 2.6)
            elif ev.type == pygame.MOUSEBUTTONDOWN:
                p = phys_to_canvas(ev.pos)
                if ev.button == 3 and view_rect.collidepoint(p):
                    dragging = True; drag_last = p
                if ev.button == 1:
                    if not focus_mode:
                        tab_cols = 4
                        tw = (panel_w - 20) // tab_cols
                        for ti, tab in enumerate(tabs):
                            rr, cc = divmod(ti, tab_cols)
                            tr = pygame.Rect(side.x + 10 + cc * tw, 58 + rr * 36, tw - 4, 32)
                            if tr.collidepoint(p): active_tab = tab
                    hit = False
                    for b in buttons:
                        if b.rect.collidepoint(p):
                            hit = True
                            if mix_mode and not b.action.startswith(('shock_','package:')) and active_tab not in {'Advisor','Crisis','Combined'}:
                                if b.action in custom_mix:
                                    custom_mix.remove(b.action)
                                    last_action = 'Mix removed: ' + b.label
                                elif len(custom_mix) < 4:
                                    custom_mix.append(b.action)
                                    last_action = 'Mix added: ' + b.label
                                else:
                                    last_action = 'Cabinet Mix limit: 4 policies'
                                continue
                            if getattr(b, 'disabled', False):
                                last_action = 'Blocked: ' + b.label
                                e.last_policy_message = b.hint or 'Policy unavailable.'
                                e.add_chirp('@cabinet_desk: ' + e.last_policy_message)
                                continue
                            last_action = b.action
                            before = len(e.impulses)
                            success = True
                            if b.action.startswith('shock_'):
                                if getattr(e, 'game_status', 'RUNNING') == 'RUNNING':
                                    e.apply_shock(b.action[6:])
                                else:
                                    success = False
                            elif b.action.startswith('package:'):
                                package_id = b.action.split(':', 1)[1]
                                success = e.enact_package(package_id)
                                if success:
                                    for component in POLICY_PACKAGES[package_id]['actions']:
                                        broadcast_reaction(citizens, component, POLICY_PACKAGES[package_id]['name'])
                            else:
                                success = e.enact(b.action)
                            if success and len(e.impulses) > before:
                                last_impulse = e.impulses[-1]
                            if success and not b.action.startswith('package:'):
                                broadcast_reaction(citizens, b.action, b.label)
                    if not hit and view_rect.collidepoint(p):
                        wx, wy = screen_to_city(p[0], p[1], view_rect, camera, zoom)
                        selected = pick_citizen_at(citizens, wx, wy)
                        selected_business = None if selected else pick_building_at(wx, wy)
            elif ev.type == pygame.MOUSEBUTTONUP and ev.button == 3:
                dragging = False
            elif ev.type == pygame.MOUSEMOTION and dragging:
                p = phys_to_canvas(ev.pos)
                dx = p[0] - drag_last[0]; dy = p[1] - drag_last[1]
                camera[0] -= dx / zoom; camera[1] -= dy / zoom; drag_last = p
                
        keys = pygame.key.get_pressed()
        pan = 520 * dt / max(0.5, zoom)
        if keys[pygame.K_a] or keys[pygame.K_LEFT]: camera[0] -= pan
        if keys[pygame.K_d] or keys[pygame.K_RIGHT]: camera[0] += pan
        if keys[pygame.K_w] or keys[pygame.K_UP]: camera[1] -= pan
        if keys[pygame.K_s] or keys[pygame.K_DOWN]: camera[1] += pan
        camera[0] = clamp(camera[0], 100, WORLD_W - 100)
        camera[1] = clamp(camera[1], 100, WORLD_H - 100)

        if not paused:
            acc += dt * speed
            hour = world_time % 24
            civilians = [
                c for c in citizens 
                if (c.profession not in {'police', 'doctor', 'nurse', 'firefighter'} or c.special == 'Naruto') 
                and c.special not in {'Sasuke', 'Kakashi', 'Guy', 'Hokage Guard'}
            ]
            night_now = (hour >= 20.5 or hour < 7)
            if night_now and not was_night:
                for c in civilians: c.slept_tonight = False; c.sleep_timer = 0
            rested_ratio = sum(c.slept_tonight for c in civilians) / max(1, len(civilians))
            time_rate = 0.035 if (23.0 <= hour < 23.9 and rested_ratio < 0.96) else (0.55 if not (hour >= 23.9 or hour < 7) else 0.72)
            world_time = (world_time + dt * speed * time_rate) % 24
            was_night = night_now
            if acc >= 9:
                advance_quarter(manual=False)
            for c in citizens:
                c.update(dt, e, pygame.Rect(0, 0, WORLD_W, WORLD_H), anchors, world_time, cityecon)
            for i in range(0, len(citizens), 3):
                a = citizens[i]
                for b in citizens[i + 1:i + 5]:
                    if math.hypot(a.x - b.x, a.y - b.y) < 17:
                        cityecon.maybe_social_interaction(a, b)
                        dx = a.x - b.x; dy = a.y - b.y; d = max(1, math.hypot(dx, dy)); push = (17 - d) * 0.35
                        a.x += dx / d * push; a.y += dy / d * push; b.x -= dx / d * push; b.y -= dy / d * push
            road_vehicles = cars + motorcycles + buses + taxis
            traffic.update(dt, e, road_vehicles)
            for vehicle in road_vehicles:
                traffic.step_vehicle(vehicle, dt, road_vehicles)
            for animal in animals: animal.update(dt)
            for ship in ships: ship.update(dt, e)
            firetruck.update(dt, getattr(e, 'active_factory_fire', False))
            metro.update(dt); intercity.update(dt); plane.update(dt, e)

        night = draw_world(
            world, e, citizens, cars, motorcycles, buses, taxis, animals, 
            trees, homes, ships, metro, intercity, plane, firetruck, fonts, selected, 
            world_time, raining, show_heatmap, visual_mode, show_labels
        )
        traffic.draw(world)
        if selected_business:
            br = building_rect(selected_business).inflate(12, 12)
            pygame.draw.rect(world, YELLOW, br, 4, border_radius=10)
        canvas.fill(BG)
        blit_city_view(canvas, world, view_rect, camera, zoom)
        draw_atmosphere_overlay(canvas, view_rect, world_time, raining, getattr(e, "crisis_level", 0.0), e.inflation)
        if focus_mode:
            buttons = []
        
        # Clean map HUD: optional objective/social overlays instead of permanent large panels.
        if show_chirper:
            draw_chirper_feed(canvas, e.chirps, pygame.Rect(14, 12, min(565, view_rect.width-28), 84), fonts[0])
        if show_objectives:
            ow_obj = min(500, max(360, view_rect.width // 3))
            draw_objective_panel(canvas, e, pygame.Rect(view_rect.right-ow_obj-12, 12, ow_obj, 100), fonts, compact=True)
        if mix_mode:
            mix_w = min(720, max(420, view_rect.width - 48))
            draw_custom_mix_panel(canvas, e, custom_mix, pygame.Rect(20, max(120, view_rect.bottom-188), mix_w, 118), fonts)
        if quarter_notice_timer > 0 and getattr(e,'last_quarter_report',None):
            note = pygame.Rect(max(18, view_rect.centerx-230), 126, 460, 38)
            pygame.draw.rect(canvas, (18,28,39), note, border_radius=8); pygame.draw.rect(canvas, CYAN, note, 1, border_radius=8)
            draw_text(canvas, fonts[1], f"{e.last_quarter_report.get('period','Quarter')} closed — press Q for the economic brief", note.center, CYAN, 'center')
        draw_map_mode_badges(canvas, pygame.Rect(12, view_rect.bottom-96, min(650, view_rect.width-130), 30), fonts, visual_mode, focus_mode, show_labels)
        
        if not focus_mode:
            pygame.draw.rect(canvas, PANEL, bottom)
            draw_text(canvas, fonts[1], 'NATIONAL ECONOMIC DASHBOARD', (14, bottom.y + 8), TEXT)
            cols = 4; gap = 7
            cw = (bottom.width - 16 - gap * (cols - 1)) // cols
            ch = (bottom.height - 38 - gap) // 2
            wealths = sorted(c.net_worth for c in citizens)
            rich = wealths[int(len(wealths) * 0.9)]
            metrics = [
                ('REAL GDP', money(e.real_gdp), f'Growth {pct(e.gdp_growth)}', e.histories['gdp'], GREEN if e.gdp_growth >= 0 else RED, None),
                ('INFLATION', pct(e.inflation), f'{e.inflation_regime} • Target 2.5%', e.histories['inflation'], RED if e.inflation < 0.01 or e.inflation > 0.06 else GREEN if 0.015 <= e.inflation <= 0.035 else YELLOW, None),
                ('UNEMPLOYMENT', pct(e.unemployment), f'Employed: {sum(c.employed for c in citizens)}/{len(citizens)}', e.histories['unemployment'], RED if e.unemployment > 0.07 else GREEN, None),
                ('APPROVAL', pct(e.approval), f'Capital {e.political_capital:.0f} • Score {getattr(e, "national_score", 0):.0f}', e.histories['approval'], GREEN if e.approval >= 0.5 else RED, None),
                ('DEBT / GDP', pct(e.debt_ratio), f'Yield {pct(e.bond_yield)} • Spread {pct(getattr(e, "sovereign_spread", 0.0))}', e.histories['debt_ratio'], RED if e.debt_ratio > 1.0 else YELLOW, None),
                ('TRADE / FX', f'{e.exchange_rate:.3f}', f'{getattr(e, "macro_regime", "Balanced")} • FCI {getattr(e, "financial_conditions_index", 50):.0f}', e.histories['fx'], CYAN, None),
                ('HOUSING / WEALTH', f'{e.housing.price_index:.0f}', f'Afford {e.housing.affordability:.2f} • P90 ${rich:,.0f}', None, PURPLE, citizens),
                ('STARTUPS & TECH', f'{e.startups.count} Firms', f'Unicorns: {e.startups.unicorns} • Val ${e.startups.valuation:.0f}M', e.histories['stock'], GREEN if e.startups.unicorns > 0 else YELLOW, None)
            ]
            for i, m in enumerate(metrics):
                rr, cc = divmod(i, cols)
                metric_card(canvas, fonts, pygame.Rect(8 + cc * (cw + gap), bottom.y + 34 + rr * (ch + gap), cw, ch), m[0], m[1], m[2], m[3], m[4], m[5])

            pygame.draw.rect(canvas, (17, 22, 30), side)
            pygame.draw.line(canvas, GRID, (side.x, 0), (side.x, DESIGN_H), 2)
            draw_text(canvas, fonts[2], 'POLICY OPERATIONS ROOM', (side.x + 12, 10), WHITE)
            draw_text(canvas, fonts[0], f'{e.game_mode.upper()} • Capacity {e.policy_capacity:.0f}/100 • Political {e.political_capital:.0f}/100 • Score {e.national_score:.0f}', (side.x + 12, 39), CYAN)
            tab_cols = 4
            tw = (panel_w - 20) // tab_cols
            for ti, tab in enumerate(tabs):
                rr, cc = divmod(ti, tab_cols)
                tr = pygame.Rect(side.x + 10 + cc * tw, 58 + rr * 36, tw - 4, 32)
                pygame.draw.rect(canvas, BLUE if tab == active_tab else CARD2, tr, border_radius=6)
                draw_text(canvas, fonts[0], tab, tr.center, WHITE, 'center')
            buttons = []
            y = 137
            top = advisor.summary(e)
            coach = advisor.mission_coach(e)
            sev = top['severity']
            col = RED if sev == 3 else YELLOW if sev == 2 else GREEN
            mission_active = getattr(e,'game_mode','mission') == 'mission' and e.current_objective().get('kind') not in {'free_window','sandbox'}
            # Advisor uses a compact status card; recommendations live in the dedicated
            # NEXT STEPS section below so information is not repeated or overlapping.
            advisor_view = active_tab == 'Advisor'
            alert_h = 118 if advisor_view else 154
            pygame.draw.rect(canvas, CARD, (side.x + 10, y, panel_w - 20, alert_h), border_radius=8)
            pygame.draw.rect(canvas, col, (side.x + 10, y, 5, alert_h), border_radius=4)
            if advisor_view:
                kicker = 'MISSION STATUS' if mission_active else 'CURRENT DIAGNOSIS'
                title_text = coach.get('title','Mission') if mission_active else top['title']
                draw_text(canvas, fonts[0], kicker, (side.x + 22, y + 8), CYAN)
                draw_text(canvas, fonts[0], 'G: full guide', (side.right - 20, y + 8), MUTED, 'topright')
                draw_text(canvas, fonts[1], fit_text(fonts[1], title_text, panel_w - 48), (side.x + 22, y + 27), col)
                yy = y + 51
                summary_text = coach.get('status','') if mission_active else top['diagnosis']
                for line in wrap_text(fonts[0], summary_text, panel_w - 48)[:3]:
                    draw_text(canvas, fonts[0], line, (side.x + 22, yy), MUTED); yy += 16
            else:
                card_title = ('MISSION COACH: ' + coach.get('title','Mission')) if mission_active else ('ADVISOR: ' + top['title'])
                draw_text(canvas, fonts[1], fit_text(fonts[1], card_title, panel_w - 185), (side.x + 22, y + 8), col)
                draw_text(canvas, fonts[0], f"Mode {getattr(e,'game_mode','mission').upper()} • G guide", (side.right - 20, y + 10), CYAN, 'topright')
                yy = y + 34
                summary_text = coach.get('status','') if mission_active else top['diagnosis']
                for line in wrap_text(fonts[0], summary_text, panel_w - 44)[:2]:
                    draw_text(canvas, fonts[0], line, (side.x + 22, yy), MUTED); yy += 16
                steps = coach.get('steps', [])
                primary_step = coach.get('primary') or (steps[0] if steps else None)
                if primary_step:
                    st = primary_step
                    route = f"{st.get('timing','NOW')}: {st.get('tab','Advisor')} → {st.get('label','Policy')}"
                    draw_text(canvas, fonts[1], fit_text(fonts[1], route, panel_w - 44), (side.x + 22, yy+2), CYAN); yy += 20
                    reason = wrap_text(fonts[0], st.get('reason',''), panel_w - 44)
                    if reason:
                        draw_text(canvas, fonts[0], reason[0], (side.x + 22, yy), TEXT); yy += 16
                    watch = fit_text(fonts[0], 'Watch: ' + st.get('watch','GDP, inflation, unemployment'), panel_w - 44)
                    draw_text(canvas, fonts[0], watch, (side.x + 22, yy), YELLOW)
                else:
                    plan = advisor.action_plan(e, 1)
                    if plan:
                        st = plan[0]
                        route = f"{st['timing']}: {st['tab']} → {st['label']}"
                        draw_text(canvas, fonts[1], fit_text(fonts[1], route, panel_w - 44), (side.x + 22, yy+2), CYAN)
            y += alert_h + 8

            if active_tab != 'Advisor':
                items = groups[active_tab]
                colw = (panel_w - 30) // 2
                for i, (label, action, color) in enumerate(items):
                    rr, cc = divmod(i, 2)
                    rect = pygame.Rect(side.x + 10 + cc * (colw + 8), y + rr * 40, colw, 32)
                    if action.startswith('shock_'):
                        allowed, hint = (getattr(e, 'game_status', 'RUNNING') == 'RUNNING'), 'Scenario controls are disabled after the mandate ends.'
                    elif action.startswith('package:'):
                        package_id = action.split(':', 1)[1]
                        allowed, hint = e.can_enact_package(package_id)
                    else:
                        allowed, hint = e.can_enact(action)
                    guide_target = action == guided_action
                    in_mix = action in custom_mix
                    prefix = '>> ' if guide_target else ('+ ' if in_mix else '')
                    display_label = prefix + label
                    display_color = YELLOW if guide_target else PURPLE if in_mix else color
                    if guide_target:
                        hint = 'RECOMMENDED NEXT STEP — ' + (hint if hint and hint != 'Ready' else 'Ready to enact')
                    if mix_mode and not action.startswith(('shock_','package:')):
                        hint = ('SELECTED IN CABINET MIX — click to remove' if in_mix else 'CABINET MIX — click to add')
                    b = Button(rect, display_label, action, display_color, disabled=not allowed, hint=hint)
                    b.draw(canvas, fonts[0], mouse)
                    buttons.append(b)
                y += math.ceil(len(items) / 2) * 40 + 6
                impact_h = 175
                hovered_action = next((b.action for b in buttons if b.rect.collidepoint(mouse)), None)
                if active_tab == 'Combined':
                    hovered_package = hovered_action.split(':',1)[1] if hovered_action and hovered_action.startswith('package:') else None
                    draw_package_brief(canvas, hovered_package, e, pygame.Rect(side.x + 10, y, panel_w - 20, impact_h), fonts)
                elif hovered_action and not hovered_action.startswith('shock_'):
                    draw_policy_preview(canvas, advisor.policy_preview(e, hovered_action), pygame.Rect(side.x + 10, y, panel_w - 20, impact_h), fonts)
                else:
                    draw_policy_impact_hud(canvas, fonts, pygame.Rect(side.x + 10, y, panel_w - 20, impact_h), last_impulse, e)
                y += impact_h + 6
                rh = max(90, min(145, DESIGN_H - y - 12))
                pygame.draw.rect(canvas, CARD, (side.x + 10, y, panel_w - 20, rh), border_radius=8)
                draw_text(canvas, fonts[1], 'TRANSMISSION CHANNELS', (side.x + 20, y + 9), TEXT)
                yy = y + 35
                if e.impulses:
                    for imp in e.impulses[:3]:
                        progress = 1 - imp.remaining / max(1, imp.duration)
                        draw_text(canvas, fonts[0], f"{imp.name} ({getattr(imp, 'flow_type', 'Policy')})", (side.x + 20, yy), TEXT)
                        pygame.draw.rect(canvas, (50, 58, 70), (side.x + 210, yy + 3, 150, 8), border_radius=4)
                        pygame.draw.rect(canvas, CYAN, (side.x + 210, yy + 3, int(150 * progress), 8), border_radius=4)
                        draw_text(canvas, fonts[0], f'{imp.remaining}q', (side.right - 22, yy), MUTED, 'topright')
                        yy += 24
                else:
                    draw_text(canvas, fonts[0], 'All transmission channels idle.', (side.x + 20, yy), MUTED)
            else:
                coach = advisor.mission_coach(e)

                # 1) Actionable next steps: fixed-height rows, all text constrained to the card.
                guide_h = 174
                guide_rect = pygame.Rect(side.x + 10, y, panel_w - 20, guide_h)
                pygame.draw.rect(canvas, (25, 33, 43), guide_rect, border_radius=8)
                pygame.draw.rect(canvas, GRID, guide_rect, 1, border_radius=8)
                draw_text(canvas, fonts[1], 'NEXT STEPS', (guide_rect.x + 10, guide_rect.y + 8), CYAN)
                draw_text(canvas, fonts[0], 'ranked by current conditions', (guide_rect.right - 10, guide_rect.y + 10), MUTED, 'topright')
                row_y = guide_rect.y + 31
                step_rows = coach.get('steps',[])[:3]
                for i, st in enumerate(step_rows,1):
                    rr = pygame.Rect(guide_rect.x + 7, row_y, guide_rect.width - 14, 43)
                    if i == 1:
                        pygame.draw.rect(canvas, (29, 47, 42), rr, border_radius=6)
                    route = f"{i}. {st.get('tab','Advisor')} → {st.get('label','Policy')}"
                    route = fit_text(fonts[1], route, rr.width - 18)
                    draw_text(canvas, fonts[1], route, (rr.x + 8, rr.y + 3), GREEN if i == 1 else TEXT)
                    detail = st.get('reason','')
                    watch = st.get('watch','GDP / inflation / unemployment')
                    detail_line = fit_text(fonts[0], f"{detail}  •  Watch: {watch}", rr.width - 18)
                    draw_text(canvas, fonts[0], detail_line, (rr.x + 8, rr.y + 24), YELLOW if i == 1 else MUTED)
                    row_y += 45
                y += guide_h + 6

                # 2) Three clearly separated policy lenses.
                council_h = 194
                draw_advisor_council(canvas, advisor.perspectives(e), pygame.Rect(side.x + 10, y, panel_w - 20, council_h), fonts)
                y += council_h + 6

                # 3) Compact scenario table. Risk has its own right-aligned column.
                forecasts = advisor.scenario_forecasts(e)
                fh = 92
                forecast_rect = pygame.Rect(side.x + 10, y, panel_w - 20, fh)
                pygame.draw.rect(canvas, CARD2, forecast_rect, border_radius=8)
                pygame.draw.rect(canvas, GRID, forecast_rect, 1, border_radius=8)
                draw_text(canvas, fonts[1], '4Q STRATEGY OUTLOOK', (forecast_rect.x + 10, forecast_rect.y + 7), CYAN)
                fy = forecast_rect.y + 30
                for name, acts, final, risk in forecasts[:3]:
                    gg, inf, unemp, debt = final
                    risk_col = GREEN if risk == 'LOW' else YELLOW if risk == 'MEDIUM' else RED
                    row = f'{name:<9} GDP {pct(gg)}  INF {pct(inf)}  U {pct(unemp)}'
                    draw_text(canvas, fonts[0], fit_text(fonts[0], row, forecast_rect.width - 72), (forecast_rect.x + 10, fy), TEXT)
                    draw_text(canvas, fonts[0], risk, (forecast_rect.right - 10, fy), risk_col, 'topright')
                    fy += 18
                y += fh + 6

                # 4) Only the key drivers are shown here; Q opens the full attribution report.
                driver_h = max(82, DESIGN_H - y - 12)
                draw_macro_driver_compact(canvas, e, pygame.Rect(side.x + 10, y, panel_w - 20, driver_h), fonts)

            if selected:
                cr = pygame.Rect(max(12, view_rect.right - 345), 12, 330, 465)
                draw_citizen_panel(canvas, selected, cr, fonts)
            elif selected_business and selected_business in cityecon.businesses:
                cr = pygame.Rect(max(12, view_rect.right - 365), 12, 350, 390)
                draw_business_panel(canvas, cityecon.businesses[selected_business], cr, fonts, cityecon)
                
        draw_event_ticker(canvas, e.news, pygame.Rect(12, view_rect.bottom - 64, min(930, view_rect.width - 125), 27), fonts[0])
        pygame.draw.rect(canvas, (8, 12, 18), (12, view_rect.bottom - 34, min(930, view_rect.width - 125), 27), border_radius=6)
        hover_hint = next((b.hint for b in buttons if b.rect.collidepoint(mouse) and b.hint), '')
        detail = hover_hint if hover_hint and hover_hint != 'Ready' else getattr(e, 'last_policy_message', '')
        guide_status = (' • GUIDE: ' + ACTION_LABEL.get(guided_action, guided_action or '')) if guided_action else ''
        status_text = f'Zoom {zoom:.2f}× • Last: {last_action} • {detail}{guide_status} • Bank Run: {"ACTIVE" if e.bank_run else "OFF"}'
        if len(status_text) > 135: status_text = status_text[:132] + '…'
        draw_text(canvas, fonts[0], status_text, (22, view_rect.bottom - 28), YELLOW)
        badge = 'PAUSED' if paused else f'LIVE ×{speed}'
        bc = RED if paused else GREEN
        pygame.draw.rect(canvas, (8, 12, 18), (view_rect.right - 105, view_rect.bottom - 37, 92, 28), border_radius=6)
        draw_text(canvas, fonts[1], badge, (view_rect.right - 59, view_rect.bottom - 23), bc, 'center')
        if show_mission_guide:
            gw, gh = min(1080, DESIGN_W-90), min(650, DESIGN_H-80)
            draw_mission_guidance(canvas, e, advisor, pygame.Rect((DESIGN_W-gw)//2, (DESIGN_H-gh)//2, gw, gh), fonts)
        if show_help:
            hw, hh = min(1040, DESIGN_W-100), min(620, DESIGN_H-90)
            draw_help_overlay(canvas, pygame.Rect((DESIGN_W-hw)//2, (DESIGN_H-hh)//2, hw, hh), fonts)
        if show_quarter_report:
            qw, qh = min(1160, DESIGN_W-80), min(650, DESIGN_H-70)
            draw_quarter_report(canvas, e, pygame.Rect((DESIGN_W-qw)//2, (DESIGN_H-qh)//2, qw, qh), fonts)
        if show_legacy:
            lw, lh = min(1120, DESIGN_W-90), min(640, DESIGN_H-70)
            draw_legacy_report(canvas, e.legacy_report(), pygame.Rect((DESIGN_W-lw)//2, (DESIGN_H-lh)//2, lw, lh), fonts,
                               getattr(e,'game_status','RUNNING'), '' if legacy_manual else getattr(e,'game_over_reason',''))
        screen.fill((5, 8, 12))
        frame = pygame.transform.smoothscale(canvas, (ow, oh))
        screen.blit(frame, (ox, oy))
        pygame.display.flip()
        await asyncio.sleep(0)
    pygame.quit()

if __name__ == "__main__":
    asyncio.run(main())