# T-REX Product Agent — hackathon AI Tinkerers Paris, 12 sept. 2026

Thème "Agents, Everywhere". **Gel dépassé (14h15), rendu 15h45. Corrections de bugs uniquement.**
Le jury voit : une vidéo de 90 s, ce repo public, un texte de soumission. Pas de démo live.
Une seule personne code (Valentin). Plusieurs sessions Claude peuvent tourner en parallèle — voir "Règles multi-sessions".

## Le pitch

Un Product Manager agent qui vit **dans** le produit (T-REX, cockpit de taux de fret de CMA CGM, vendu à des brokers et des chargeurs).

1. **Le client** envoie un feedback depuis le cockpit (bouton Feedback → formulaire propre). Un ticket apparaît aussitôt sur le GitHub Project de l'entreprise, première colonne.
2. **L'agent** relit ce feedback avec ce que le client **fait** (télémétrie d'usage que personne n'a tapée) et le contexte business (board review d'août, objectifs, capacité). Il évalue la **valeur** (High/Medium/Low), l'**effort tech** (XS→XL), une **priorité /100**, et réécrit le ticket sur le kanban : titre impératif, besoin réel, preuves chiffrées, recommandation. Le ticket passe dans la deuxième colonne.
3. **L'humain** décide sur le board (go / no-go = déplacer la card). Les agents de delivery prennent le relais — hors scope aujourd'hui.

Ce qu'un chatbot ne peut pas faire : le broker qui demande 7 fois un module documents mais ouvre l'écran 2 fois par mois ; les 43 comptes qui abandonnent le drawer Filters à 61 % sans jamais se plaindre.

## Fichiers

| Fichier | Rôle | Statut |
|---|---|---|
| `trex-cockpit.html` | **Le livrable.** Cockpit T-REX fourni par l'équipe + module agent injecté en fin de fichier | actif |
| `context/` | **Le contexte business, en vrais documents** : `index.json` + 6 markdown (board review août 2026, OKRs Q3, ADR-012 "no new modules", capacité & échelle de sizing, politique d'audit RA-2024-11, fiche comptes avec ARR et renouvellements). L'agent les lit au runtime et doit les **citer mot pour mot** | actif |
| `app.html` | Prototype OrderDesk du matin. Obsolète | ne plus toucher |

Pas de build. **Servir le dossier en http** pour que `context/` se charge (`fetch` est bloqué en `file://`) : `python3 -m http.server 8765 --bind 127.0.0.1` puis `http://127.0.0.1:8765/trex-cockpit.html`. En `file://` l'app tourne quand même avec un contexte embarqué de secours et l'indique dans la vue opérateur. Leaflet et les polices viennent de CDN.

## Le board GitHub

`https://github.com/users/valentinpotie/projects/4` — projet **utilisateur** (pas org), privé. Id `PVT_kwHOBdtX484BjQ6E`.
Champs : Status — **le code place les cards par nom de colonne** (`statusFor()` : nouveau ticket → `Todo`, évalué → `Needs human review`, repli sur la position si le nom manque). Les colonnes suivantes appartiennent au dispatcher de `delivery/` : `Approved for delivery` (un humain y glisse la card = go) → `In delivery` → `Delivered` / `Delivery failed`. Ne pas renommer ces colonnes sans mettre `COLUMN` et `delivery/` d'accord. Value (High/Medium/Low), Effort (XS/S/M/L/XL), Priority (number), Account (text), Revenue at stake (text). Ces 5 champs ont été créés par nous via l'API ; les afficher sur la face des cards : vue Board → ⋯ → Fields.
`gh` est authentifié sur le compte avec le scope `project` — `gh api graphql` marche pour tester. **Ne jamais supprimer un item du board qui n'est pas un item de test créé par la session.**

## La base Airtable (contexte business live)

Base `appeGLmP4EhvvujVY` (ex-"Claro" ; contient aussi une table `Agences` d'un autre projet — ne pas y toucher). Tables créées par nous via le connecteur :
- `Accounts` : Name, Plan (Enterprise/Growth), ARR (€), Seats, Renewal date, Health (Healthy/At risk/Churning), Requests logged, Usage notes, Cohort size — 2 lignes (Decathlon, Sézane)
- `Decisions` : Title, Kind (decision/objectives/policy/capacity), Date, Owner, Status, Text — 5 lignes (board review août, OKRs Q3, ADR-012, capacité, politique RA-2024-11)
L'app lit les deux tables **par nom** via l'API REST, avec un token `data.records:read` limité à cette base, saisi dans le panneau opérateur. Airtable est prioritaire sur `context/` ; le contexte est rechargé avant chaque évaluation. Geste de démo : changer Health ou ARR de Decathlon dans Airtable → "Evaluate last ticket again" → la card change sur GitHub.

## Passation à la delivery
Le pipeline complet sur le board : feedback client → `Todo` → l'agent évalue → `Needs human review` → **un humain glisse la card vers `Approved for delivery`** → le dispatcher (`delivery/`, GitHub Action, lit les drafts du Project) la réclame en `In delivery`, planifie, patche, fait passer un critic, ouvre une PR → `Delivered`. Le cockpit ne parle jamais au dispatcher : ils se rencontrent uniquement sur le board. Voir `README.md` et `docs/superpowers/` pour le contrat côté delivery.

## Architecture de `trex-cockpit.html`

Trois blocs `<script>` : (1) cockpit principal — état `S`, `ROWS`, `render()`, drawers ; (2) `bc_*` import tender & cost ; (3) **le module agent**, dernier bloc, précédé de son `<style>` (commence par `/* ── Feedback drawer (customer) + operator view`). Tout ce que nous avons écrit est dans ce dernier `<style>` + `<script>`, encapsulé dans `const AG = (() => { … })()`.

Modifications faites dans le corps du cockpit (et rien d'autre) :
- `<colgroup id="TCOLGROUP">` et `<tr id="THEAD_ROW">` vides — la table est rendue par notre `window.renderTable` depuis `COLUMNS`
- sidebar : `<select id="AC_SEL">` (comptes) + `#AC_AV` ; `#AC_AV2` sur la 2e sidebar (page More information)
- drawer `#FEEDBACK_DRAWER` : titre `.dh-title` ("Feedback" / "Product agent — operator"), corps `#AG_BODY`. Le Google Form iframe et le bouton "Layout" de test ont été retirés
- branding : wordmark texte "CMA CGM" à la place des logos Decathlon (fichiers absents) ; "Decathlon" du glossaire → "the shipper"
- design system CMA CGM (12/09 ~13h) : valeurs des tokens `:root` réassignées (navy `#061D50`, rouge `#E20101`, fond `#F3F5F7`, bordure `#DDDFE3`, angles 2–4 px, pilules 999 px), Roboto + Antonio via Google Fonts à la place de Decathlon VF, sidebar navy avec barre rouge sur l'item actif, couleurs codées en dur alignées. Tout est dans le 1er `<style>` : le bloc `:root` et le bloc `/* ── CMA CGM design system overrides ── */` en fin de style. Les noms `--dkt-*` sont conservés, rien à changer dans le bloc AG

**Règle d'or : on n'édite pas les fonctions du cockpit.** On les enveloppe avec `wrap(name, before, after)` (réassigne `window[name]`). C'est ainsi que la télémétrie capte `openFilterDrawer`, `applyFilters`, `closeFilterDrawer`, `discardChanges`, `clickRow`, `selectPreset`, `setPage`, `bc_showImport`, `bc_showCockpit`, `bc_openDoc`, et que `openFeedbackDrawer` met le focus dans le formulaire.

### Le module AG, dans l'ordre du fichier
- `ACCOUNTS` : `broker` = Decathlon (gros compte bruyant, renouvellement dans 6 semaines), `shipper` = Sézane (1 des 43 comptes silencieux). `AC` = compte courant
- `COLUMNS` / `CELL` / `renderTable`
- `events`, `track()`, `log()`, `wrap()` : télémétrie live + journal
- `HISTORY`, `TILES` : les 30 jours d'historique (données de démo assumées) — les chiffres de la voix off. `BUSINESS_CONTEXT` : résumé embarqué, **utilisé seulement en secours** si `context/` n'est pas joignable
- `DOCS`, `loadContext()`, `contextForPrompt()`, `norm()` : chargement de `context/index.json` + documents, injectés verbatim dans le prompt. `renderContextState()` affiche l'état dans la vue opérateur
- `SYSTEM_PROMPT`, `validate()`, `priority()`, `callModel()`, `evaluate(ticket)` : **gpt-4o** (gpt-4o-mini notait de façon incohérente et inventait des chiffres), `response_format: json_schema` strict, **3 tentatives** avec les erreurs du validateur renvoyées, puis abandon loggé
- `graphql()`, `loadProject()`, `setField()`, `createTicket()`, `enrichTicket()` : GitHub Projects v2 (`addProjectV2DraftIssue` → `updateProjectV2DraftIssue` + `updateProjectV2ItemFieldValue`)
- `VOICE`, `setVoice()`, `startVoice()`, `meter()`, `finishVoice()`, `transcribe()`, `cancelVoice()` : dictée. `MediaRecorder` → blob → `POST /v1/audio/transcriptions` (`whisper-1`, `response_format: text`, prompt de vocabulaire métier), texte ajouté dans le textarea. Mètre de niveau = RMS de l'`AnalyserNode`, 48 barres qui défilent. Le micro est relâché à l'arrêt **et** à la fermeture du drawer (`wrap('closeFeedbackDrawer')`). Rien n'est stocké : le blob vit le temps d'une requête
- `submit()` (client) → `createTicket` → écran de remerciement → `runAgent()` en arrière-plan. `evaluateLast()` relance l'agent sur le dernier ticket
- Vues : `form()`, `thanks()`, `opsPanel()`, `setMode()`, `toggleOps()`, `mount()`, `switchAccount()`
- Exporté : `AG.submit, again, done, pickImportance, voice, count, connect, evaluateLast, reloadContext, openOps, toggleOps, switchAccount, events, summary`

### Schéma de l'évaluation (sortie du modèle, validée avant tout usage)
```json
{ "decision": "recommend|decline", "title": "≤80, impératif", "customer_need": "…",
  "value": "High|Medium|Low", "value_rationale": "…", "effort": "XS|S|M|L|XL", "effort_rationale": "…",
  "revenue_at_stake": "≤60, depuis accounts.md",
  "evidence": ["2 à 4 faits chiffrés"],
  "context_used": [ { "doc": "<id exact>", "quote": "passage littéral 8–200 chars", "effect": "supports|conflicts|constrains", "how": "…" } ],
  "recommendation": "…",
  "scores": { "reach": 1-10, "impact": 1-10, "confidence": 1-10, "business_fit": 1-10, "effort": 1-10 } }
```
`context_used` : 2 à 5 entrées, au moins un document de type decision/objectives, et **chaque `quote` doit exister mot pour mot dans le document** (comparaison normalisée espaces/casse/guillemets) — sinon rejet, un retry, puis abandon. Le corps du ticket contient un tableau "Business context applied" (document, effet, citation, comment ça a pesé) et les lignes Supported by / Conflicts with / Constrained by.
La forme est garantie par l'API (`response_format: json_schema`, `strict: true`, constante `CARD_SCHEMA`) : le modèle ne peut plus omettre une clé. Le validateur maison tourne quand même derrière — c'est lui qui vérifie les comptes et surtout la littéralité des citations. Le retry reste en filet.
Priorité calculée en JS, pas par le modèle : `merit = 0,35·impact + 0,30·business_fit + 0,20·reach + 0,15·confidence` puis `priority = round(10·merit·(1,15 − 0,05·effort))`, borné 1–100. Pondération et non produit : un ticket qui ne sert qu'un compte mais porte un renouvellement de 480 k€ peut monter, sinon "High value / priorité 35" s'affichait côte à côte sur le kanban.

### Démarrage automatique
`DEFAULTS` (dans le module AG) porte les valeurs non secrètes, toujours les mêmes : owner `valentinpotie`, projet `4`, base Airtable `appeGLmP4EhvvujVY` — pré-remplies dans les champs.
Les tokens viennent de **`secrets.local.json`** à la racine (gitignoré, jamais commité ; modèle dans `secrets.local.example.json`). Au chargement, `boot()` remplit les champs, se connecte au board si le token GitHub est là, puis charge le contexte. Les champs modifiés à la main sont mémorisés dans le `sessionStorage` de l'onglet.
Ordre de priorité de remplissage : ce qui est déjà tapé > sessionStorage > `secrets.local.json` > `DEFAULTS`.
**Ne jamais retirer `secrets.local.json` du `.gitignore`, ne jamais coller un token dans le code ou dans `CLAUDE.md`.**

### Vue opérateur (cachée du client)
Icône engrenage en haut de la sidebar (à gauche du bouton de repli), `Cmd/Ctrl + .`, ou `#ops` dans l'URL. Le bouton Feedback ne mène **jamais** à la vue opérateur : il force la vue client. Contient : clé OpenAI, owner GitHub (`valentinpotie`), n° de projet (`4`), token GitHub (`gh auth token` a déjà le scope `project`), bouton Connect, état de l'agent, tuiles de télémétrie, événements bruts, Activity.
Clés **en mémoire du tab uniquement** — jamais dans le code, jamais sur disque, jamais dans un commit. Un reload = les recoller.

## Contraintes
- Un seul fichier livrable, HTML/CSS/JS vanille, zéro dépendance ajoutée, zéro build
- Interface client = client : pas de score, pas de clé, pas de télémétrie visible. Tout ça vit dans la vue opérateur et sur le board
- Échecs visibles : côté client un message sobre ("We couldn't send your feedback right now"), côté opérateur le détail dans Activity. Jamais de silence
- Design : uniquement les primitives du cockpit (`.btn-prim/.btn-sec`, `.text-input`, `.chip`, `.sticker`, `.sb-av`, tokens `--dkt-*` (valeurs CMA CGM), `--font-display` pour les titres, radius 2–4 px et pilules pour chips/boutons, **bordures, pas d'ombres**). Pas d'emoji dans l'UI. Copy en anglais, sobre, B2B
- Pas de refactor, pas de feature non demandée

## Hors scope (ne pas proposer)
Agents de delivery / PR automatiques, KPI temps réel, communication aux utilisateurs, PostHog/Amplitude, frameworks, backend (un serveur de fichiers statiques n'en est pas un), mutation d'interface par l'agent (V1 du matin, abandonnée), conversion des drafts en vraies issues avec commentaires (envisagé, pas fait).

## Feedbacks de démo (mesurés le 12/09)
Les deux textes testés, dans l'ordre de la vidéo :
1. Decathlon / Blocking — *"We need a document management module. I have asked seven times now. It will weigh on the renewal."* → refus + contre-proposition "Surface attached documents on rate rows", High/S, priorité 74–91 selon les runs.
2. Sézane / Nice to have — *"Honestly it's fine, we've got used to it. Pulling up the rates we need takes a bit of clicking every morning, but we manage. Not a priority."* → "Implement one-click saved filters", High/S, **priorité 100**, stable.
Le contraste (le compte silencieux au-dessus du compte bruyant) vient de `reach` et des OKR, pas d'un réglage.
Piège conformité en réserve : *"Can you remove the Active/Inactive column?…"* → RA-2024-11 cité en `constrains`.
Harnais de test headless : `scratchpad/try.sh <broker|shipper> "<feedback>" "<importance>"`.

## Le rapport écrit dans le ticket
`customerSection(t)` = l'état à l'envoi (badges Account + Awaiting evaluation, verbatim, tableau compte). `report(t, o)` = le rapport complet après évaluation, en quatre temps : bandeau de badges → alerte `[!IMPORTANT]` avec la décision → tableau **The three sources that produced this** → `1 · Customer feedback` / `2 · Product signals` / `3 · Business input` → `Decision` + tableau de scoring + alerte `[!NOTE]` sur le human in the loop.
GitHub retire tout CSS d'un corps de ticket : la couleur vient des **badges shields.io** (`badge(label, value, colour)`, navy `061D50`, rouge `E20101`, vert `017F5C`), des **alertes natives** (`[!CAUTION]` rouge pour les contraintes, `[!WARNING]` pour les conflits, `[!TIP]` vert pour les appuis, `[!IMPORTANT]` pour la décision) et des tableaux. Ne pas y mettre de `<style>` ni de HTML coloré, ce sera supprimé.
Les citations doivent être des phrases entières : l'ellipse est refusée par le validateur (`quote is truncated with an ellipsis`), parce que la colonne « Quoted word for word » est la preuve montrée au jury.

## Vérifier sans casser
```bash
python3 -c "import re;s=open('trex-cockpit.html').read();open('/tmp/last.js','w').write(re.findall(r'<script>(.*?)</script>',s,re.S)[-1])" && node --check /tmp/last.js
# micro : headless sort au `load`, donc servir une ressource lente pour tenir la page en vie
#   (`timeout` n'existe pas sur macOS). Flags : --use-fake-device-for-media-stream --use-fake-ui-for-media-stream
#   getUserMedia exige un contexte sûr : http://127.0.0.1 oui, file:// non
# capture headless — vue client
sed 's#</body>#<script>setTimeout(()=>openFeedbackDrawer(),300)</script></body>#' trex-cockpit.html > /tmp/c1.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=3000 --screenshot=/tmp/c1.png "file:///tmp/c1.html"
# vue opérateur : remplacer openFeedbackDrawer() par AG.toggleOps()
```
État au 12/09 14h45 : vues client et opérateur vérifiées par captures ; **toutes les mutations GitHub vérifiées avec `gh`** (création, champs, réécriture, changement de colonne, nettoyage) ; **l'appel OpenAI n'a pas encore été exécuté de bout en bout** (clé côté Valentin).

Scénario de démo : lancer `python3 -m http.server 8765 --bind 127.0.0.1` à la racine → ouvrir `http://127.0.0.1:8765/trex-cockpit.html#ops` (vérifier "6 company documents loaded") → coller les clés → Connect → `Cmd+.` pour revenir client → ouvrir Filters et le fermer sans appliquer (×2) → Feedback → *"We need a document management module. I have asked seven times now. It will weigh on the renewal."* → Blocking → Send. Sur le board : le ticket apparaît en colonne 1, puis est réécrit et passe en colonne 2 avec Value / Effort / Priority / Account remplis.

## Règles multi-sessions
Un seul fichier de code, donc **un seul propriétaire à la fois pour `trex-cockpit.html`** :
- **Session code** : `trex-cockpit.html`, bloc AG uniquement. `node --check` avant de rendre la main
- **Session rédaction** : `README.md`, texte de soumission, script vidéo — ne touche à aucun `.html`
- **Session git** : commits / push — ne modifie pas le contenu

Avant d'éditer `trex-cockpit.html`, relire la fin du fichier : une autre session a pu le changer. Édits chirurgicaux (python/sed sur des ancres uniques), jamais de réécriture du fichier entier. Ne jamais commiter une clé.

## Style de réponse
Court, en français. Code complet et exécutable, jamais en fragments. Après le gel : bugs uniquement, rappeler l'heure du rendu si une feature apparaît.
