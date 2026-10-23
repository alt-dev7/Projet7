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

#### Client

##### Construire l'image

```shell
docker build --target front -t orion-microcrm-front:latest .
```

##### Exécuter l'image

```shell
docker run -it --rm -p 80:80 -p 443:443 orion-microcrm-front:latest
```

L'application sera disponible sur https://localhost.

#### Serveur

##### Construire l'image

```shell
docker build --target back -t orion-microcrm-back:latest .
```

##### Exécuter l'image

```shell
docker run -it --rm -p 8080:8080 orion-microcrm-back:latest
```

L'API sera disponible sur http://localhost:8080.

#### Tout en un

```shell
docker build --target standalone -t orion-microcrm-standalone:latest .
```

##### Exécuter l'image

```shell
docker run -it --rm -p 8080:8080 -p 80:80 -p 443:443 orion-microcrm-standalone:latest
```

L'application sera disponible sur https://localhost et l'API sur http://localhost:8080.

## Intégration continue

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (GitHub Actions) s'exécute sur `push` et `pull_request` vers `main`, chaque lundi à 6 h UTC (`schedule`) et à la demande (`workflow_dispatch`).

| Job | Contenu |
|---|---|
| `back` | JDK 17 (Temurin), `./gradlew build` (compilation, tests JUnit, rapport de couverture JaCoCo) |
| `front` | Node 22, `npm ci`, `ng build --optimization`, tests Karma en Chrome headless avec couverture |
| `sonar` | Après `back` et `front` : analyse SonarQube Cloud avec les rapports de couverture ; le Quality Gate est consulté sur le tableau de bord mais ne bloque pas la CI |
| `audit` | Planifié ou manuel uniquement : `npm audit --audit-level=high` |

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
