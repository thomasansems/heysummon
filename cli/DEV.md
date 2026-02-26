# CLI — lokale ontwikkeling

## Lokaal linken

Bouwt de TypeScript en registreert het `heysummon` commando globaal op je machine:

```bash
cd cli
npm run build
npm link
```

Het binaire bestand (`heysummon`) wordt gesymlinkt naar de globale npm-bin. Je kunt daarna gewoon `heysummon` typen in elke terminal.

### Waar wordt het geïnstalleerd?

```bash
npm root -g         # globale node_modules map
npm bin -g          # map waar de symlink staat, bv. ~/.nvm/versions/node/v20.x.x/bin/
which heysummon     # bevestigt het pad van de symlink
```

---

## Updaten (na codewijzigingen)

Rebuild en de symlink pikt de nieuwe `dist/` automatisch op:

```bash
npm run build
```

Geen re-link nodig — de symlink wijst al naar deze map.

---

## Unlinken

Verwijdert de globale symlink:

```bash
npm unlink -g heysummon
```

Of vanuit de cli-map:

```bash
cd cli
npm unlink
```

Controleer of het weg is:

```bash
which heysummon     # mag niets teruggeven
```

---

## Opnieuw installeren / verse start

```bash
cd cli
npm unlink -g heysummon   # verwijder oude symlink
npm run build             # hercompileer
npm link                  # link opnieuw
heysummon --help          # test
```

---

## Volledig verwijderen (uninstall)

Stop de server, verwijder `~/.heysummon/` (app, database, config) en vraagt bevestiging:

```bash
heysummon uninstall
```

Het commando:
1. Toont exact wat verwijderd wordt
2. Biedt een database-backup aan (standaard: ja)
3. Vraagt om het woord `uninstall` te typen ter bevestiging
4. Stopt de server
5. Verwijdert `~/.heysummon/`
6. Herinnert je de CLI-binary apart te verwijderen:

```bash
npm uninstall -g heysummon
```

> **Let op:** `npm uninstall` verwijdert alléén de CLI-binary, niet `~/.heysummon/`.
> Gebruik `heysummon uninstall` voor een volledige schone verwijdering.

---

## Productie installeren (vanuit npm)

Zodra het pakket gepubliceerd is:

```bash
npm install -g heysummon
# updaten
npm update -g heysummon
# verwijderen
npm uninstall -g heysummon
```
