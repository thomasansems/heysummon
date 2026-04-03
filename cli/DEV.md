# CLI — lokale ontwikkeling

## Lokaal linken

Bouwt de TypeScript en registreert het `heysummon` commando globaal op je machine:

```bash
cd cli
pnpm run build
pnpm link --global
```

Het binaire bestand (`heysummon`) wordt gesymlinkt naar de globale pnpm-bin. Je kunt daarna gewoon `heysummon` typen in elke terminal.

### Waar wordt het geïnstalleerd?

```bash
pnpm root -g        # globale node_modules map
pnpm bin -g         # map waar de symlink staat
which heysummon     # bevestigt het pad van de symlink
```

---

## Updaten (na codewijzigingen)

Rebuild en de symlink pikt de nieuwe `dist/` automatisch op:

```bash
pnpm run build
```

Geen re-link nodig — de symlink wijst al naar deze map.

---

## Unlinken

Verwijdert de globale symlink:

```bash
pnpm remove -g heysummon
```

Of vanuit de cli-map:

```bash
cd cli
pnpm unlink
```

Controleer of het weg is:

```bash
which heysummon     # mag niets teruggeven
```

---

## Opnieuw installeren / verse start

```bash
cd cli
pnpm remove -g heysummon  # verwijder oude symlink
pnpm run build            # hercompileer
pnpm link --global        # link opnieuw
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
pnpm remove -g heysummon
```

> **Let op:** `pnpm remove` verwijdert alléén de CLI-binary, niet `~/.heysummon/`.
> Gebruik `heysummon uninstall` voor een volledige schone verwijdering.

---

## Productie installeren (vanuit npm)

Zodra het pakket gepubliceerd is:

```bash
pnpm add -g heysummon
# updaten
pnpm update -g heysummon
# verwijderen
pnpm remove -g heysummon
```
