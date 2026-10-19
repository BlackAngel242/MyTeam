#!/usr/bin/env python
"""Capsule animée « tournée du chef » en motion design (outil de développement, hors du produit).

Prend de vraies images de la scène du bureau (canvas de public/app.js, temps simulé, état simulé : aucun envoi
réel, aucune donnée personnelle) et les compose dans une mise en page animée : titre, étapes qui s'enchaînent,
fenêtre arrondie et ombre. Sorties : MP4 et WebM (site) et GIF léger (README).

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
PAS_SIM = 55.0                            # ms de temps simulé par image (la scène est accélérée d'environ x1,65)
ETAPES = [
    ('1', 'Une mission est déléguée', 0.00, 0.22),
    ('2', 'Le chef traverse l’atelier', 0.22, 0.66),
    ('3', 'Le dossier arrive au bon poste', 0.66, 1.00),
]
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

def capturer_scene():
    """Images de la scène à pas de temps simulé fixe : le rendu ne dépend ni de la machine ni de sa charge."""
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Silencieux); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    images = []
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, locale='fr-FR', timezone_id='Europe/Paris')
        ctx.add_init_script("localStorage.setItem('bureau.aideVue','1')")
        page = ctx.new_page()
        def route(r):
            u = r.request.url
            if '/api/state' in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps(ETAT))
            for cle, val in REPONSES.items():
                if cle in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps(val))
            r.continue_()
        page.route('**/*', route)
        page.goto(f'http://127.0.0.1:{PORT}/'); page.wait_for_selector('#office'); page.wait_for_timeout(800)
        page.evaluate("() => { window.simNow = 1000.0; window.requestAnimationFrame = () => {}; window.performance.now = () => window.simNow; draw(window.simNow); }")
        def image():
            brut = base64.b64decode(page.evaluate("() => document.querySelector('#office').toDataURL('image/png')").split(',')[1])
            return Image.open(io.BytesIO(brut)).convert('RGB')
        for _ in range(8): images.append(image())            # le chef est assis : on garde un instant de calme
        page.evaluate("() => { state.agents[0].delegations = [{id:'del-1', target:'w1:p4', title:'Mission', at:'2026-10-18T14:30:00.000Z'}]; syncOffice(layout(), window.simNow); }")
        total = int(14400 / PAS_SIM)
        for _ in range(total):
            page.evaluate(f"() => {{ window.simNow += {PAS_SIM}; draw(window.simNow); }}")
            images.append(image())
        for _ in range(10): images.append(images[-1])        # retour au calme avant la boucle
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

def composer(scene, t, duree, progres):
    img = fond(t); d = ImageDraw.Draw(img)
    s = SS
    ent = ease(t / 0.7)                     # entrée douce de toute la mise en page
    # titre
    decal = int((1 - ent) * 24 * s)
    ImageDraw.Draw(img)
    d.rounded_rectangle((56 * s, (52 + 0) * s + decal, 104 * s, 100 * s + decal), 12 * s, fill=(31, 53, 82))
    for i, (cx, cy, c) in enumerate([(66, 62, (160, 223, 196)), (82, 62, (157, 187, 255)), (66, 78, (181, 168, 230)), (82, 78, (240, 198, 116))]):
        d.rectangle((cx * s, cy * s + decal, (cx + 12) * s, (cy + 12) * s + decal), fill=c)
    d.text((54 * s, 112 * s + decal), 'MyTeam', font=police(GRAS, 72), fill=(234, 241, 251))
    d.text((58 * s, 200 * s + decal), 'Bureau des agents', font=police(SEMI, 28), fill=(160, 223, 196))
    d.text((58 * s, 244 * s + decal), 'Vos agents d’IA au travail, en direct.', font=police(NORMAL, 20), fill=(139, 156, 181))
    # étapes
    y0 = 330
    for i, (num, texte, a, b) in enumerate(ETAPES):
        actif = ease((progres - a) / 0.05) * (1 - ease((progres - b) / 0.05)) if b < 1 else ease((progres - a) / 0.05)
        passe = 1.0 if progres >= b and b < 1 else 0.0
        y = (y0 + i * 64) * s + decal
        mix = lambda c1, c2, k: tuple(int(c1[j] + (c2[j] - c1[j]) * k) for j in range(3))
        couleur = mix((90, 106, 130), (160, 223, 196), max(actif, 0.55 * passe))
        d.ellipse((58 * s, y, 98 * s, y + 40 * s), fill=mix((24, 38, 62), (20, 64, 47), actif), outline=couleur, width=2 * s)
        d.text((78 * s, y + 20 * s), num, font=police(GRAS, 18), fill=couleur, anchor='mm')
        d.text((112 * s + int(actif * 6 * s), y + 20 * s), texte, font=police(SEMI if actif > 0.5 else NORMAL, 21), fill=mix((120, 136, 160), (234, 241, 251), max(actif, 0.5 * passe)), anchor='lm')
    d.text((58 * s, 640 * s + decal), '100 % local · 24 outils Herdr · licence MIT', font=police(NORMAL, 15), fill=(110, 128, 154))
    # fenêtre de scène
    lf = 830; hf = int(lf * scene.height / scene.width)
    x, y = 420, (H - hf) // 2 + int((1 - ent) * 20)
    # léger zoom de caméra pendant la traversée : le chef et le dossier restent lisibles
    cloche = math.sin(math.pi * max(0.0, min(1.0, (progres - 0.12) / 0.8))) ** 2
    z = 1.0 + 0.08 * cloche
    cw, ch = scene.width / z, scene.height / z
    cxs, cys = scene.width * 0.5, scene.height * 0.5
    gauche = min(max(0, cxs - cw / 2), scene.width - cw); haut = min(max(0, cys - ch / 2), scene.height - ch)
    vignette = scene.resize((lf * s, hf * s), Image.Resampling.LANCZOS, box=(gauche, haut, gauche + cw, haut + ch))
    ombre = Image.new('RGBA', ((lf + 80) * s, (hf + 80) * s), (0, 0, 0, 0))
    ImageDraw.Draw(ombre).rounded_rectangle((40 * s, 52 * s, (lf + 40) * s, (hf + 52) * s), 22 * s, fill=(0, 0, 0, 170))
    ombre = ombre.filter(ImageFilter.GaussianBlur(26 * s))
    img.paste(ombre, ((x - 40) * s, (y - 40) * s), ombre)
    cadre = Image.new('RGB', ((lf + 8) * s, (hf + 8) * s), (42, 71, 104))
    img.paste(cadre, ((x - 4) * s, (y - 4) * s), rond(cadre, 22 * s))
    img.paste(vignette, (x * s, y * s), rond(vignette, 18 * s))
    # barre de progression
    d.rounded_rectangle((x * s, (y + hf + 24) * s, (x + lf) * s, (y + hf + 29) * s), 3 * s, fill=(30, 46, 72))
    d.rounded_rectangle((x * s, (y + hf + 24) * s, (x + int(lf * progres)) * s, (y + hf + 29) * s), 3 * s, fill=(160, 223, 196))
    # entrée et sortie en fondu pour une boucle propre
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
    debut_mission, fin_mission = 8, n - 10
    for i, sc in enumerate(scene):
        progres = max(0.0, min(1.0, (i - debut_mission) / max(1, fin_mission - debut_mission)))
        ff.stdin.write(composer(sc, i / FPS, duree, progres).tobytes())
    ff.stdin.close(); ff.wait()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-pix_fmt', 'yuv420p', os.path.join(SORTIE, 'tournee-du-chef.webm')], check=True)
    palette = os.path.join(SORTIE, '_palette.png'); gif = os.path.join(SORTIE, 'tournee-du-chef.gif')
    filtre = 'fps=12,scale=800:-1:flags=lanczos'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-vf', filtre + ',palettegen=max_colors=96:stats_mode=diff', palette], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-i', palette, '-lavfi', filtre + '[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle', gif], check=True)
    os.remove(palette)
    for f in ('mp4', 'webm', 'gif'):
        p = os.path.join(SORTIE, f'tournee-du-chef.{f}'); print(f, round(os.path.getsize(p) / 1024), 'Ko')

if __name__ == '__main__':
    main()
