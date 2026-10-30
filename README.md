<p align="center">
   <img src="./front/src/favicon.png" width="192px" />
</p>

# MicroCRM (P7 - Développeur Full-Stack - Java et Angular - Mettez en œuvre l'intégration et le déploiement continu d'une application Full-Stack)

MicroCRM est une application de démonstration basique ayant pour être objectif de servir de socle pour le module "P7 - Développeur Full-Stack".

L'application MicroCRM est une implémentation simplifiée d'un ["CRM" (Customer Relationship Management)](https://fr.wikipedia.org/wiki/Gestion_de_la_relation_client). Les fonctionnalités sont limitées à la création, édition et la visualisations des individus liés à des organisations.

![Page d'accueil](./misc/screenshots/screenshot_1.png)
![Édition de la fiche d'un individu](./misc/screenshots/screenshot_2.png)

## Code source

### Organisation

Ce [monorepo](https://en.wikipedia.org/wiki/Monorepo) contient les 2 composantes du projet "MicroCRM":

- La partie serveur (ou "backend"), en Java SpringBoot 3;
- La partie cliente (ou "frontend"), en Angular 17.

### Démarrer avec les sources

#### Serveur

##### Dépendances

- [OpenJDK >= 17](https://openjdk.org/)

##### Procédure

1. Se positionner dans le répertoire `back` avec une invite de commande:

   ```shell
   cd back
   ```

2. Construire le JAR:

   ```shell
   # Sur Linux
   ./gradlew build

   # Sur Windows
   gradlew.bat build
   ```

3. Démarrer le service:

   ```shell
   java -jar build/libs/microcrm-0.0.1-SNAPSHOT.jar
   ```

Puis ouvrir l'URL http://localhost:8080 dans votre navigateur.

#### Client

##### Dépendances

- [NPM >= 10.2.4](https://www.npmjs.com/)

##### Procédure

1. Se positionner dans le répertoire `front` avec une invite de commande:

   ```shell
   cd front
   ```

2. (La première fois seulement) Installer les dépendances NodeJS:

   ```shell
   npm install
   ```

3. Démarrer le service de développement:

   ```shell
   npx @angular/cli serve
   ```

Puis ouvrir l'URL http://localhost:4200 dans votre navigateur.

### Exécution des tests

#### Client

**Dépendances**

- Google Chrome ou Chromium

Dans votre terminal:

```shell
cd front
CHROME_BIN=</path/to/google/chrome> npm test
```

#### Serveur

Dans votre terminal:

```shell
cd back
./gradlew test
```

### Images Docker

Un seul [`Dockerfile`](Dockerfile) multi-étapes produit les images de l'application.

| Cible | Contenu | Port |
|---|---|---|
| `front` | Fichiers statiques Angular servis par Caddy | 80 |
| `back` | JAR Spring Boot sur JRE 21 | 8080 |

#### Avec Docker Compose (recommandé)

```shell
docker compose up --build
```

L'application est disponible sur http://localhost et l'API sur http://localhost:8080. Le service `front` démarre une fois le `back` déclaré sain par son healthcheck. `docker compose down` arrête et supprime les conteneurs.

L'URL de l'API est écrite en dur dans le front (`http://localhost:8080`) : l'application fonctionne donc sur la machine qui publie les ports 80 et 8080, pas derrière un autre nom d'hôte. La base HSQLDB est en mémoire : les données sont réinitialisées à chaque démarrage.

#### Sans Docker Compose

```shell
docker build --target back -t orion-microcrm-back:latest .
docker run -it --rm -p 8080:8080 orion-microcrm-back:latest

docker build --target front -t orion-microcrm-front:latest .
docker run -it --rm -p 80:80 orion-microcrm-front:latest
```

#### Choix techniques

- **Images de base officielles et versionnées** : `node:22-alpine` (même version que la CI), `gradle:8.7-jdk17` (version du wrapper, JDK 17 de la compilation), `eclipse-temurin:21-jre-alpine` (distribution OpenJDK de l'Eclipse Foundation) et `caddy:2-alpine` (image officielle de Caddy). Les images sans tag précis de l'ancien Dockerfile (`node`, `gradle:jdk17`) sont abandonnées.
- **Images légères** : variantes Alpine, JRE seul à l'exécution (ni JDK, ni Gradle, ni Node). Les étapes de build ne sont pas livrées. Taille mesurée : front 25 Mo, back 117 Mo (contenu compressé).
- **Build reproductible et rapide** : `npm ci` et la compilation Gradle sont séparés de la copie des sources pour profiter du cache ; les tests ne sont pas rejoués dans l'image, ils le sont par la CI. Le [`.dockerignore`](.dockerignore) exclut `.git`, les dépendances et les sorties de build.
- **Sécurité** : exécution sous un utilisateur non privilégié, aucun secret ni variable sensible dans les images, HTTPS désactivé dans Caddy (pas de domaine ni de certificat en local : à terminer au niveau d'un reverse proxy en production), healthchecks sur les deux services.
- **Maintenance** : les tags sont à faire évoluer à la main (changement de version de Node dans la CI, du wrapper Gradle ou de Java) ; après chaque modification, `docker compose up --build` doit repasser en `healthy`, et le scan Trivy est à relancer pour contrôler les nouvelles vulnérabilités.
- **Corrections par rapport à l'ancien Dockerfile** : port exposé du back (8080 et non 4200), alignement des versions de Java, Caddy installé depuis son image officielle plutôt que par `apk` au démarrage, suppression de la cible `standalone` (hors besoin : Compose orchestre un conteneur par service).

#### Analyse des images

Les images ont été scannées avec [Trivy](https://trivy.dev/), outil libre qui remplit le même rôle que Twistlock :

```shell
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest \
  image --severity HIGH,CRITICAL orion-microcrm-back:latest
```

| Image | Système (Alpine) | Dépendances applicatives |
|---|---|---|
| `back` | 0 vulnérabilité | 39 (8 critiques) dans le JAR : Spring Boot 3.2.5, Tomcat, Jackson |
| `front` | 0 vulnérabilité | 5 (HIGH) dans le binaire Caddy (Go) |

Les vulnérabilités du back viennent des versions de Spring Boot en fin de vie et ne se corrigent pas en changeant d'image : elles relèvent de la montée de version. Celles de Caddy seront corrigées par une nouvelle image `caddy:2-alpine` : il suffit de reconstruire l'image.

## Intégration continue

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (GitHub Actions) s'exécute sur `push` et `pull_request` vers `main`, chaque lundi à 6 h UTC (`schedule`) et à la demande (`workflow_dispatch`).

| Job | Contenu |
|---|---|
| `back` | JDK 17 (Temurin), `./gradlew build` (compilation, tests JUnit, rapport de couverture JaCoCo) |
| `front` | Node 22, `npm ci`, `ng build --optimization`, tests Karma en Chrome headless avec couverture |
| `sonar` | Après `back` et `front` : analyse SonarQube Cloud avec les rapports de couverture ; le Quality Gate est consulté sur le tableau de bord mais ne bloque pas la CI |
| `compose` | Après `back` et `front` : `docker compose up --build --wait`, puis vérification que l'API (`/persons`) et le front répondent |
| `audit` | Planifié ou manuel uniquement : analyse Trivy du JAR (dépendances Gradle, rapport sans blocage) puis `npm audit --audit-level=high` |

`back` et `front` tournent en parallèle. Les résultats des tests apparaissent dans les *checks* du commit ou de la PR (« Tests back », « Tests front »), et les rapports complets (JUnit XML, HTML, couverture) sont conservés 14 jours en artefacts. Le projet utilise Gradle, pas Maven.

### Choix techniques

- **Jobs `back` et `front` indépendants et parallèles** : les deux suites n'ont pas de dépendance entre elles, et un échec d'un côté n'est pas masqué par l'autre.
- **Quality Gate non bloquant** (`sonar.qualitygate.wait=false`) : le code d'origine ne passe pas le gate par défaut (bugs, une vulnérabilité mineure, couverture insuffisante). Les corriger n'entre pas dans le périmètre du pipeline ; l'analyse reste publiée à chaque exécution et ses résultats alimentent le plan de sécurité et le suivi de la dette technique. Le gate pourra redevenir bloquant une fois ces points traités.
- **`sonar` après `back` et `front`** : il réutilise leurs rapports de couverture (artefacts) au lieu de rejouer les tests, et `fetch-depth: 0` donne à Sonar l'historique Git pour détecter le code nouveau.
- **JDK 17 (Temurin)** : version de compilation du projet (`build.gradle`), la même que dans le Dockerfile. **Node 22** : même version que l'image `node:22-alpine`.
- **Cache npm et Gradle** (`setup-node`, `setup-gradle`) : accélère les runs sans changer leur résultat ; `npm ci` et le wrapper Gradle garantissent des versions identiques à celles du dépôt.
- **Publication des résultats et artefacts** : les checks « Tests back » / « Tests front » rendent les résultats lisibles sur la PR, et les rapports bruts restent téléchargeables 14 jours.
- **`concurrency`** : un nouveau push annule le run obsolète de la même branche.
- **Exécution hebdomadaire** : détecte une nouvelle vulnérabilité ou une dépendance cassée sans modification du code (plan de testing périodique).

### Commandes

| Commande | Objectif | Définie dans | Exécutée |
|---|---|---|---|
| `./gradlew build` | Compiler le back, lancer les tests JUnit et produire le rapport JaCoCo | `back/build.gradle` | CI (job `back`), local |
| `npm ci` | Installer les dépendances du front aux versions verrouillées | `front/package-lock.json` | CI (jobs `front`, `audit`), local |
| `npx ng build --optimization` | Compiler le front | `front/angular.json` | CI (job `front`) |
| `npm test -- --watch=false --browsers=ChromeHeadlessNoSandbox --code-coverage` | Lancer les tests Karma en Chrome headless avec couverture | script `test` de `front/package.json`, `front/karma.conf.js` | CI (job `front`), local |
| `SonarSource/sonarqube-scan-action` | Analyser le code et la couverture, attendre le Quality Gate | `ci.yml`, `sonar-project.properties` | CI (job `sonar`) |
| `npm audit --audit-level=high` | Signaler les dépendances npm vulnérables | `ci.yml` | CI planifiée ou manuelle (job `audit`) |

### Configuration requise

1. Créer le projet sur SonarQube Cloud en important le dépôt GitHub, et désactiver l'analyse automatique (l'analyse est faite par le workflow).
2. Dans *Settings > Secrets and variables > Actions* du dépôt GitHub, créer le secret `SONAR_TOKEN` avec le jeton généré dans SonarQube Cloud.
3. Renseigner `sonar.organization` et `sonar.projectKey` dans [`sonar-project.properties`](sonar-project.properties) : ce ne sont pas des secrets.

Les PR venant d'un fork n'ont pas accès aux secrets : l'analyse Sonar et la publication des checks y sont ignorées.

### Reproduire en local

```shell
cd back && ./gradlew build
cd front && npm ci && npm test -- --watch=false --browsers=ChromeHeadlessNoSandbox --code-coverage
```

Les rapports sont écrits dans `back/build/reports/` et `front/test-results/`, `front/coverage/`.

## Déploiement continu

Le workflow [`.github/workflows/cd.yml`](.github/workflows/cd.yml) publie les images Docker sur le registre GitHub (GHCR). Il se déclenche à la fin du workflow `CI` (`workflow_run`) et ne s'exécute que si la CI a réussi sur un `push` vers `main` : jamais pour une PR, une exécution planifiée ou une CI en échec. Le commit publié est celui que la CI a validé (`head_sha`).

Le job `publish` construit en parallèle les cibles `back` et `front` du [`Dockerfile`](Dockerfile), analyse chaque image avec Trivy (vulnérabilités HIGH et CRITICAL, affichées dans les logs) puis la pousse :

| Image | Tags |
|---|---|
| `ghcr.io/alt-dev7/orion-microcrm-back` | `latest`, `sha-<commit>`, `X.Y.Z` (releases) |
| `ghcr.io/alt-dev7/orion-microcrm-front` | `latest`, `sha-<commit>`, `X.Y.Z` (releases) |

### Choix techniques

- **GHCR** : registre intégré à GitHub, authentifié par le `GITHUB_TOKEN` du workflow. Aucun compte ni secret supplémentaire, contrairement à Docker Hub.
- **Workflow séparé du CI** : le CD ne dépend que du résultat de la CI et se lit à part. Un commit dont les tests échouent n'est jamais publié.
- **Matrice `back` / `front`** : une seule définition d'étapes pour les deux images, construites en parallèle.
- **Deux tags** : `latest` pour la dernière version, `sha-<commit>` pour une version précise, qui permet de revenir en arrière.
- **Trivy sans blocage** (`--exit-code 0`) : le back embarque des vulnérabilités critiques liées à Spring Boot 3.2.5 en fin de vie, qui ne se corrigent pas en changeant d'image. Bloquer la publication l'interromprait en permanence ; le rapport est lu dans les logs et la montée de version relève du plan de dette technique. Le seuil pourra devenir bloquant après cette montée.
- **Cache de build** (`type=gha`) : réutilise les couches Docker d'une publication à l'autre, avec un cache distinct par image.
- **Pas de déploiement sur un serveur** : l'URL de l'API est écrite en dur dans le front (`http://localhost:8080`), l'application ne fonctionne que sur la machine qui publie les ports. La publication des images est donc l'étape de déploiement automatisée.

### Commandes

| Commande | Objectif | Définie dans | Exécutée |
|---|---|---|---|
| `docker/login-action` | S'authentifier sur GHCR | `cd.yml` | CD, après une CI réussie sur `main` |
| `docker/metadata-action` | Calculer le nom de l'image et ses tags | `cd.yml` | CD |
| `docker/setup-buildx-action` | Installer Buildx, nécessaire au cache de build | `cd.yml` | CD |
| `docker/build-push-action` (`target: back` / `front`) | Construire chaque image, puis la publier une fois analysée | `cd.yml`, `Dockerfile` | CD |
| `docker run aquasec/trivy … image` | Lister les vulnérabilités de l'image avant publication | `cd.yml` (même commande qu'en local) | CD |
| `docker compose up --build` | Construire et lancer l'application | `docker-compose.yml` | Local |
| `docker pull ghcr.io/alt-dev7/orion-microcrm-back:latest` | Récupérer une image publiée | — | Local, après publication |
| `docker run -p 8080:8080 …:sha-<commit>` | Lancer une version précise (reprise) | — | Local ou serveur, en cas de retour arrière |

### Lancer l'application depuis les images publiées

```shell
docker run -d --name back -p 8080:8080 ghcr.io/alt-dev7/orion-microcrm-back:latest
docker run -d --name front -p 80:80 ghcr.io/alt-dev7/orion-microcrm-front:latest
```

L'application est disponible sur http://localhost. `docker rm -f back front` arrête et supprime les conteneurs.

### Sécurité

Le workflow s'authentifie avec le `GITHUB_TOKEN` fourni par GitHub, éphémère : aucun secret n'est à créer. La permission `packages: write` est limitée au job `publish`, et aucun secret n'est copié dans les images.

### Risques et procédure de reprise

| Risque | Parade |
|---|---|
| Image défectueuse publiée | Le CD ne part qu'après des tests verts ; reprise avec le tag `sha-<commit>` précédent (ci-dessous) |
| Publication interrompue ou en échec | `latest` n'est mise à jour qu'à la fin du push : relancer le workflow `CD` depuis l'onglet *Actions* |
| Vulnérabilité dans une image de base | Rapport Trivy dans les logs du CD ; reconstruire l'image (nouveau push sur `main`) |
| Perte des données | La base HSQLDB est en mémoire et rechargée avec les données initiales à chaque démarrage : rien à restaurer à ce stade |

Procédure de reprise :

1. Identifier le dernier commit sain (onglet *Actions* ou `git log`).
2. Arrêter la version défectueuse : `docker rm -f back front`.
3. Relancer les deux images avec le tag `sha-<commit>` de ce commit à la place de `latest`.
4. Vérifier que les conteneurs passent en `healthy` (`docker ps`) et que http://localhost répond.
5. Corriger sur `main` : le CD republie ensuite `latest`.

### Configuration

- Les paquets sont privés à leur première publication : les rendre publics (ou les lier au dépôt) dans les réglages du paquet sur GitHub si nécessaire.
- `workflow_run` utilise la version de `cd.yml` présente sur `main` : une modification du workflow n'a d'effet qu'une fois fusionnée.

## Releases

Le workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) crée les releases GitHub avec [semantic-release](https://github.com/semantic-release/semantic-release). Comme le CD, il se déclenche à la fin du workflow `CI` et ne s'exécute que si la CI a réussi sur un `push` vers `main`. Le JAR et le build Angular sont ceux produits et testés par la CI (artefacts `jar` et `front-dist`) : rien n'est reconstruit.

Le workflow vérifie d'abord que l'application démarre depuis ces artefacts (le JAR répond sur `/persons`, le build Angular est servi), puis semantic-release analyse les commits depuis la dernière release. S'il en déduit une nouvelle version, il crée le tag `vX.Y.Z` et la release avec ses notes, puis le workflow y joint :

| Artefact | Contenu |
|---|---|
| `microcrm-X.Y.Z.jar` | JAR Spring Boot exécutable (`java -jar`) |
| `microcrm-front-X.Y.Z.tar.gz` | Build Angular optimisé (fichiers statiques uniquement) |

Les images GHCR `orion-microcrm-back` et `orion-microcrm-front` reçoivent aussi le tag `X.Y.Z` : c'est l'image `sha-<commit>` publiée par le CD, déjà analysée, simplement re-étiquetée (le workflow attend sa publication si besoin).

### Politique de versioning

[SemVer](https://semver.org/lang/fr/) (`MAJOR.MINOR.PATCH`), déduit des titres de commit au format Conventional Commits :

| Titre de commit | Version |
|---|---|
| `fix: …` | PATCH |
| `feat: …` | MINOR |
| `feat!: …` ou `BREAKING CHANGE:` dans le corps | MAJOR |
| `docs:`, `ci:`, `chore:`… | aucune release |

`main` est protégée : les changements passent par une PR fusionnée en squash, dont le titre (au format ci-dessus) devient le commit analysé. Sans tag existant, la première release est `1.0.0`.

### Choix techniques

- **Pas de release candidate par commit** : chaque commit utile sur `main` produit une version stable, déjà validée par la CI.
- **Pas d'action manuelle** : la fusion de la PR suffit, l'humain décide de la version en choisissant le type du titre. Aucun tag n'est posé à la main.
- **Pas de branche par release** : une seule branche `main`, les versions sont des tags.
- **Changelog dans les notes de release** : semantic-release ne pousse que le tag, ce qui reste possible sur une branche protégée ; un `CHANGELOG.md` commité exigerait de contourner la protection.
- **Workflow séparé du CI** : les droits d'écriture (`contents: write`) sont limités à ce job, et la CI reste en lecture seule sur les PR.
- **Pas de fichier de configuration** : semantic-release est lancé avec ses options en ligne de commande (`--branches`, `--plugins`) ; seuls l'analyse des commits, les notes et la publication GitHub sont activés, sans npm.
- **Artefacts sans fichier sensible** : seuls le JAR et le dossier `dist` du build y sont placés, jamais le code source ni les secrets.

### Commandes

| Commande | Objectif | Définie dans | Exécutée |
|---|---|---|---|
| `actions/download-artifact` (`run-id`) | Récupérer le JAR et le build front de la CI | `release.yml` | Release, après une CI réussie sur `main` |
| `java -jar` puis `curl /persons` | Vérifier que le JAR démarre et répond | `release.yml` | Release |
| `python3 -m http.server` puis `curl` | Vérifier que le build Angular est servi | `release.yml` | Release |
| `semantic-release` | Calculer la version, créer le tag, la release et ses notes | `release.yml` | Release |
| `gh release upload` | Joindre le JAR et l'archive front à la release | `release.yml` | Release, si une version a été créée |
| `docker buildx imagetools create` | Ajouter le tag `X.Y.Z` à l'image `sha-<commit>` sans la reconstruire | `release.yml` | Release, si une version a été créée |

### Release « test »

Avant la première vraie release, simuler sur le dépôt local pour voir la version calculée sans rien publier :

```shell
GITHUB_TOKEN=<jeton> npx -p semantic-release@24 semantic-release --dry-run --no-ci --branches main \
  --plugins @semantic-release/commit-analyzer @semantic-release/release-notes-generator
```

### Risques et reprise

| Risque | Parade |
|---|---|
| Version erronée (mauvais type de commit) | Ne jamais réécrire un tag publié : corriger par un nouveau commit `fix:` ou `feat:` |
| Release créée sans artefacts (échec de l'ajout) | Relancer le workflow `Release` (onglet *Actions*) après avoir supprimé la release et son tag |
| Artefact défectueux | Le JAR et le front viennent d'une CI verte et sont démarrés avant publication ; en cas de souci, reprendre la version précédente depuis la page *Releases* |

Les versions des actions et de semantic-release (`@24`) sont à revoir régulièrement.

## Monitoring

Une stack locale centralise les logs de l'application et les affiche dans un tableau de bord. Elle est séparée de l'application et n'est pas lancée par la CI/CD, car elle est trop lourde pour ça.

```
back (JSON) ─┐
             ├─ pilote Docker GELF ─> Logstash ─> Elasticsearch ─> Kibana
front (JSON) ┘
```

| Service | Rôle | Accès local |
|---|---|---|
| `logstash` | Reçoit les logs, les met au même format, écarte les healthchecks | `udp://127.0.0.1:5044` |
| `elasticsearch` | Stocke et indexe les logs (`microcrm-logs-AAAA.MM.JJ`) | http://localhost:9200 |
| `kibana` | Affiche le tableau de bord | http://localhost:5601 |
| `kibana-setup` | Importe le tableau de bord dans Kibana, puis s'arrête | aucun |

### Commandes

```shell
docker compose -f docker-compose-elk.yml up -d
docker compose up --build -d
```

Le tableau de bord est sur http://localhost:5601/app/dashboards#/view/microcrm. Logstash met environ une minute à démarrer : attendre qu'il soit prêt avant de lancer l'application pour ne pas perdre les logs de démarrage.

`docker compose -f docker-compose-elk.yml down` arrête la stack ; ajouter `-v` supprime aussi les logs stockés.

### Choix techniques

- **Kibana** : visualisation native de la stack ELK. Le tableau de bord est un export Kibana versionné ([`misc/elk/kibana/dashboard.ndjson`](misc/elk/kibana/dashboard.ndjson)), réimporté à chaque démarrage. Pour le modifier : l'éditer dans Kibana, puis remplacer ce fichier par un nouvel export (*Stack Management > Saved Objects*).
- **Pilote Docker GELF** : même chemin pour le back et le front, sans conteneur de collecte en plus. `docker compose logs` reste disponible.
- **Back** : logs JSON avec `logstash-logback-encoder`, y compris en développement. Les logs d'accès de Tomcat, activés par configuration dans `application.properties`, ajoutent une ligne JSON par requête (méthode, chemin, statut, durée).
- **Front** : logs d'accès de Caddy en JSON, dont Logstash garde le niveau et le statut, mais pas la requête.
- **Niveaux** : les logs d'accès étant écrits en `INFO`, Logstash passe en `ERROR` ceux dont le statut est 5xx.
- **Données personnelles** : ni query string ni adresse IP ne sont conservées, car `findByEmail` transporte un email dans l'URL.
- **Mémoire** : conteneurs plafonnés à 2 Go pour Elasticsearch, 1 Go pour Logstash et 1 Go pour Kibana, soit 4 Go au maximum, avec une heap de 1 Go pour Elasticsearch et de 512 Mo pour Logstash. La stack consomme environ 3 Go une fois démarrée.
- **Versions** : Elasticsearch, Logstash et Kibana 8.19.23.

### Tableau de bord

| Panneau | Ce qu'il montre |
|---|---|
| Nombre total de logs | Volume sur la période |
| Erreurs | Logs de niveau `ERROR` et réponses HTTP 5xx |
| Volume de logs par service | Fréquence et pics d'activité, back et front |
| Logs par niveau | Tendance `INFO`, `WARN`, `ERROR` |
| Temps de réponse du back (p95) | Performances de l'API |

### Limites

- Configuration réservée à un poste local : sécurité Elasticsearch désactivée, donc Kibana sans authentification, ports limités à `127.0.0.1`.
- Les erreurs JavaScript du navigateur ne sont pas collectées : côté front, seuls les accès HTTP le sont. Les collecter demanderait un point d'entrée public supplémentaire pour recevoir ces logs.
- Le front renvoie `index.html` pour toute URL inconnue : une ressource manquante y apparaît en 200, pas en 404.
- GELF passe par UDP : les logs émis quand Logstash est arrêté sont perdus, mais l'application continue de fonctionner.
- Seuls les conteneurs lancés avec `docker-compose.yml` envoient leurs logs, pas ceux lancés avec `docker run`.
- Aucune rétention n'est configurée : les index s'accumulent jusqu'à leur suppression avec `down -v`.
