#!/usr/bin/env python
"""Capsule animée « tournée du chef » en motion design (outil de développement, hors du produit).

Prend de vraies images de la scène du bureau (canvas de public/app.js, temps simulé, état simulé : aucun envoi
réel, aucune donnée personnelle) et les compose dans une mise en page animée : titre, étapes qui s'enchaînent
(délégation, tournée du chef, sous-agents en brainstorming, veille d'un agent, mission accomplie), journée accélérée du
matin au soir avec les lampes qui s'allument, fenêtre arrondie et ombre. Sorties : MP4 et WebM (site) et GIF (README).

Dépendances : Python 3, Pillow, Playwright (Chromium) et ffmpeg. Usage : python scripts/outils/capsule.py [dossier-de-sortie]
"""
import base64, io, json, math, os, subprocess, sys, threading, http.server
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUBLIC = os.path.join(RACINE, 'public')
SORTIE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(RACINE, 'site', 'assets')
PORT = 4407
W, H, FPS, SS = 1280, 720, 30, 2          # taille finale, images par seconde, suréchantillonnage
PAS_SIM = 70.0                            # ms de temps simulé par image (la scène est accélérée d'environ x2)
DUREE_SIM = 46000.0                       # ms de temps simulé au total
ETAPES = [
    'Une mission est déléguée',
    'Le chef traverse l’atelier',
    'Les sous-agents en brainstorming',
    'Un agent se met en veille',
    'Mission accomplie, courrier reçu',
]
H_DEBUT, H_FIN = 6.5, 20.4                # la journée défile du lever du soleil à la nuit, lampes allumées dès 19 h
POLICE = 'C:/Windows/Fonts/'
def police(noms, taille):
    for n in noms:
        try: return ImageFont.truetype(POLICE + n, taille * SS)
        except OSError: pass
    return ImageFont.load_default()
GRAS, SEMI, NORMAL = ['segoeuib.ttf'], ['seguisb.ttf', 'segoeuib.ttf'], ['segoeui.ttf']

class Silencieux(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=PUBLIC, **k)
    def log_message(self, *a): pass

def agent(id_, nom, genre, statut, boss=False, deleg=None):
    return {'id': id_, 'paneId': id_, 'name': nom, 'kind': genre, 'status': statut, 'ready': statut == 'idle', 'boss': boss,
            'cwd': '/projet', 'activity': {'found': True}, 'delegations': deleg or []}
ETAT = {'connected': True, 'agents': [agent('w1:p1', 'Claude', 'Claude', 'idle', True), agent('w1:p2', 'Codex', 'Codex', 'working'),
        agent('w1:p3', 'OpenCode', 'OpenCode', 'working'), agent('w1:p4', 'Antigravity', 'Antigravity', 'idle')],
        'direction': {'source': 'regle', 'since': '2026-10-18T10:00:00.000Z'}, 'updatedAt': '2026-10-18T14:30:00.000Z', 'token': 'essai'}
REPONSES = {'/api/pied': {'gauche': '', 'droite': '', 'enseigne': ''}, '/api/crise': {'active': False, 'since': None, 'reason': None},
            '/api/autonomie': {'actif': False, 'arret': None, 'journal': []}, '/api/todos': {'project': [], 'agents': {}},
            '/api/discussion': {'bulles': [], 'sources': []}, '/api/places': {}, '/api/traitement': {'dossiers': []}, '/api/sante': {}}

FAUSSE_DATE = """
(() => {
  const Reelle = Date; let heure = null;
  window.__setHeure = h => { heure = h; };
  class Fausse extends Reelle {
    constructor(...a) {
      if (a.length) { super(...a); return; }
      const d = new Reelle();
      if (heure != null) d.setHours(Math.floor(heure), Math.floor((heure % 1) * 60), Math.floor(((heure * 60) % 1) * 60), 0);
      super(d.getTime());
    }
    static now() { return new Fausse().getTime(); }
  }
  window.Date = Fausse;
})();
"""

def capturer_scene():
    """Images de la scène à pas de temps simulé fixe, avec la phase de l'histoire et l'heure du bureau de chaque image :
    le rendu ne dépend ni de la machine ni de sa charge."""
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Silencieux); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    images = []
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, locale='fr-FR', timezone_id='Europe/Paris')
        ctx.add_init_script("localStorage.setItem('bureau.aideVue','1')")
        ctx.add_init_script(FAUSSE_DATE)
        page = ctx.new_page()
        def route(r):
            u = r.request.url
            if '/api/state' in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps(ETAT))
            for cle, val in REPONSES.items():
                if cle in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps(val))
            r.continue_()
        page.route('**/*', route)
        page.goto(f'http://127.0.0.1:{PORT}/'); page.wait_for_selector('#office'); page.wait_for_timeout(800)
        page.evaluate("() => { window.simNow = 1000.0; window.requestAnimationFrame = () => {}; window.performance.now = () => window.simNow; window.__setHeure(%f); trackChanges(); draw(window.simNow); }" % H_DEBUT)
        def image():
            brut = base64.b64decode(page.evaluate("() => document.querySelector('#office').toDataURL('image/png')").split(',')[1])
            return Image.open(io.BytesIO(brut)).convert('RGB')
        def heure_de(t): k = max(0.0, min(1.0, t / DUREE_SIM)); k = k * k * (3 - 2 * k) * 0.35 + k * 0.65; return H_DEBUT + (H_FIN - H_DEBUT) * k
        for _ in range(8): images.append((image(), -1, H_DEBUT))     # le bureau est calme au petit matin
        # événements de l'histoire, en ms de temps simulé : (instant, phase, script)
        evenements = [
            (0, 0, "() => { state.agents[0].delegations = [{id:'del-1', target:'w1:p4', title:'Mission', at:'2026-10-18T14:30:00.000Z'}]; state.agents[3].status='working'; trackChanges(); syncOffice(layout(), window.simNow); }"),
            (2500, 1, None),
            (14500, 2, "() => { state.agents[3].activity = {found:true, subagents:[{id:'s1',description:'Brainstorming : accroche'},{id:'s2',description:'Brainstorming : parcours'},{id:'s3',description:'Brainstorming : tests'}]}; }"),
            (25500, 3, "() => { state.agents[1].activity = {found:true, limitReached:true, resetsAt:new Date(Date.now()+7200000).toISOString(), source:'terminal'}; trackChanges(); }"),
            (35500, 4, "() => { state.agents[3].activity = {found:true, subagents:[]}; state.agents[3].status='idle'; state.agents[1].activity = {found:true}; trackChanges(); syncOffice(layout(), window.simNow); }"),
        ]
        phase, i = 0, 0
        t = 0.0
        while t <= DUREE_SIM:
            while i < len(evenements) and t >= evenements[i][0]:
                phase = evenements[i][1]
                if evenements[i][2]: page.evaluate(evenements[i][2])
                i += 1
            h = heure_de(t)
            page.evaluate("(h) => { window.__setHeure(h); window.simNow += %f; draw(window.simNow); }" % PAS_SIM, h)
            images.append((image(), phase, h))
            t += PAS_SIM
        for _ in range(12): images.append((images[-1][0], 4, H_FIN))   # le soir tombe, retour au calme avant la boucle
        nav.close()
    srv.shutdown()
    return images

def ease(x): x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3
def rond(img, rayon):
    m = Image.new('L', img.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width, img.height), rayon, fill=255); return m

def fond(t):
    bg = Image.new('RGB', (W * SS, H * SS))
    d = ImageDraw.Draw(bg)
    for y in range(0, H * SS, 4):
        k = y / (H * SS); d.rectangle((0, y, W * SS, y + 4), fill=(int(11 + 8 * k), int(20 + 12 * k), int(38 + 18 * k)))
    lueur = Image.new('RGB', (W * SS, H * SS), (0, 0, 0)); dl = ImageDraw.Draw(lueur)
    cx = int((0.78 + 0.04 * math.sin(t * 0.9)) * W * SS); cy = int((0.45 + 0.05 * math.cos(t * 0.7)) * H * SS)
    dl.ellipse((cx - 520 * SS // 2, cy - 380 * SS // 2, cx + 520 * SS // 2, cy + 380 * SS // 2), fill=(26, 70, 80))
    dl.ellipse((int(0.1 * W * SS), int(0.85 * H * SS) - 200, int(0.1 * W * SS) + 560, int(0.85 * H * SS) + 200), fill=(40, 34, 78))
    lueur = lueur.filter(ImageFilter.GaussianBlur(160 * SS // 2))
    from PIL import ImageChops
    return ImageChops.add(bg, lueur)

def melanger(c1, c2, k): return tuple(int(c1[j] + (c2[j] - c1[j]) * k) for j in range(3))

def composer(scene, t, duree, progres, phase, k_phase, heure):
    img = fond(t); d = ImageDraw.Draw(img)
    s = SS
    ent = ease(t / 0.7)                     # entrée douce de toute la mise en page
    decal = int((1 - ent) * 24 * s)
    d.rounded_rectangle((56 * s, 52 * s + decal, 104 * s, 100 * s + decal), 12 * s, fill=(31, 53, 82))
    for i, (cx, cy, c) in enumerate([(66, 62, (160, 223, 196)), (82, 62, (157, 187, 255)), (66, 78, (181, 168, 230)), (82, 78, (240, 198, 116))]):
        d.rectangle((cx * s, cy * s + decal, (cx + 12) * s, (cy + 12) * s + decal), fill=c)
    d.text((54 * s, 108 * s + decal), 'MyTeam', font=police(GRAS, 68), fill=(234, 241, 251))
    d.text((58 * s, 192 * s + decal), 'Bureau des agents', font=police(SEMI, 27), fill=(160, 223, 196))
    d.text((58 * s, 234 * s + decal), 'Vos agents d’IA au travail, en direct.', font=police(NORMAL, 19), fill=(139, 156, 181))
    # les étapes de l'histoire
    y0 = 304
    for i, texte in enumerate(ETAPES):
        actif = 0.0 if phase < i else (k_phase if phase == i else 0.0)
        passe = 1.0 if phase > i else 0.0
        if phase == i + 1: actif = 1.0 - k_phase          # l'étape qui vient de finir s'éteint en douceur
        y = (y0 + i * 56) * s + decal
        couleur = melanger((90, 106, 130), (160, 223, 196), max(actif, 0.55 * passe))
        d.ellipse((58 * s, y, 94 * s, y + 36 * s), fill=melanger((24, 38, 62), (20, 64, 47), actif), outline=couleur, width=2 * s)
        d.text((76 * s, y + 18 * s), str(i + 1), font=police(GRAS, 16), fill=couleur, anchor='mm')
        d.text((108 * s + int(actif * 6 * s), y + 18 * s), texte, font=police(SEMI if actif > 0.5 else NORMAL, 18), fill=melanger((120, 136, 160), (234, 241, 251), max(actif, 0.5 * passe)), anchor='lm')
    d.text((58 * s, 650 * s + decal), '100 % local · 24 outils Herdr · licence MIT', font=police(NORMAL, 14), fill=(110, 128, 154))
    # fenêtre de scène, avec un léger zoom de caméra pendant la tournée du chef
    lf = 830; hf = int(lf * scene.height / scene.width)
    x, y = 420, (H - hf) // 2 + int((1 - ent) * 20)
    z = 1.0 + (0.06 * math.sin(math.pi * k_phase) ** 2 if phase == 1 else 0.0)
    cw, ch = scene.width / z, scene.height / z
    gauche = min(max(0, scene.width * 0.5 - cw / 2), scene.width - cw); haut = min(max(0, scene.height * 0.5 - ch / 2), scene.height - ch)
    vignette = scene.resize((lf * s, hf * s), Image.Resampling.LANCZOS, box=(gauche, haut, gauche + cw, haut + ch))
    ombre = Image.new('RGBA', ((lf + 80) * s, (hf + 80) * s), (0, 0, 0, 0))
    ImageDraw.Draw(ombre).rounded_rectangle((40 * s, 52 * s, (lf + 40) * s, (hf + 52) * s), 22 * s, fill=(0, 0, 0, 170))
    ombre = ombre.filter(ImageFilter.GaussianBlur(26 * s))
    img.paste(ombre, ((x - 40) * s, (y - 40) * s), ombre)
    cadre = Image.new('RGB', ((lf + 8) * s, (hf + 8) * s), (42, 71, 104))
    img.paste(cadre, ((x - 4) * s, (y - 4) * s), rond(cadre, 22 * s))
    img.paste(vignette, (x * s, y * s), rond(vignette, 18 * s))
    # pastille « heure du bureau » : soleil le jour, lune la nuit, la journée défile en accéléré
    hh, mm = int(heure), int((heure % 1) * 60)
    px0, py0 = (x + lf - 150) * s, (y - 46) * s
    d.rounded_rectangle((px0, py0, px0 + 150 * s, py0 + 34 * s), 17 * s, fill=(18, 32, 58), outline=(42, 71, 104), width=s)
    jour = 6.8 < heure < 19.2
    cx, cy = px0 + 20 * s, py0 + 17 * s
    if jour: d.ellipse((cx - 7 * s, cy - 7 * s, cx + 7 * s, cy + 7 * s), fill=(240, 198, 116))
    else:
        d.ellipse((cx - 7 * s, cy - 7 * s, cx + 7 * s, cy + 7 * s), fill=(196, 210, 228)); d.ellipse((cx - 2 * s, cy - 9 * s, cx + 10 * s, cy + 5 * s), fill=(18, 32, 58))
    d.text((px0 + 40 * s, cy), f'{hh:02d}:{mm:02d}', font=police(SEMI, 17), fill=(234, 241, 251), anchor='lm')
    d.text((px0 + 92 * s, cy), 'accéléré', font=police(NORMAL, 12), fill=(110, 128, 154), anchor='lm')
    # barre de progression
    d.rounded_rectangle((x * s, (y + hf + 24) * s, (x + lf) * s, (y + hf + 29) * s), 3 * s, fill=(30, 46, 72))
    d.rounded_rectangle((x * s, (y + hf + 24) * s, (x + int(lf * progres)) * s, (y + hf + 29) * s), 3 * s, fill=(160, 223, 196))
    k = min(ease(t / 0.45), ease((duree - t) / 0.45))
    if k < 1: img = Image.blend(Image.new('RGB', img.size, (11, 20, 38)), img, k)
    return img.resize((W, H), Image.Resampling.LANCZOS)

def main():
    os.makedirs(SORTIE, exist_ok=True)
    print('Capture de la scène...'); scene = capturer_scene(); n = len(scene)
    # temps simulé : la partie utile de l'animation s'étend sur la durée de la vidéo
    duree = n / FPS; print(f'{n} images, {duree:.1f} s')
    mp4 = os.path.join(SORTIE, 'tournee-du-chef.mp4')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], stdin=subprocess.PIPE)
    debut_mission = 8
    depuis, derniere = 0, None
    for i, (sc, phase, heure) in enumerate(scene):
        depuis = depuis + 1 if phase == derniere else 0; derniere = phase
        progres = max(0.0, min(1.0, (i - debut_mission) / max(1, n - debut_mission - 12)))
        ff.stdin.write(composer(sc, i / FPS, duree, progres, max(phase, 0), ease(depuis / 8.0), heure).tobytes())
    ff.stdin.close(); ff.wait()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-pix_fmt', 'yuv420p', os.path.join(SORTIE, 'tournee-du-chef.webm')], check=True)
    palette = os.path.join(SORTIE, '_palette.png'); gif = os.path.join(SORTIE, 'tournee-du-chef.gif')
    filtre = 'fps=10,scale=720:-1:flags=lanczos'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-vf', filtre + ',palettegen=max_colors=80:stats_mode=diff', palette], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-i', palette, '-lavfi', filtre + '[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle', gif], check=True)
    os.remove(palette)
    for f in ('mp4', 'webm', 'gif'):
        p = os.path.join(SORTIE, f'tournee-du-chef.{f}'); print(f, round(os.path.getsize(p) / 1024), 'Ko')

if __name__ == '__main__':
    main()
