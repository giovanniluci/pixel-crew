# 🦀 Pixel Crew

**Smart model routing for Claude Code, with a crew of pixel agents and your usage limits in a side pane.**

Pixel Crew picks the cheapest model that can do the job — Haiku, Sonnet or Opus — for every message and every subagent, so you spend fewer tokens. A pane on the right shows who is working, on which model and why, with a customizable pixel mascot for each one, plus bars for your 5‑hour and weekly usage limits.

*🇮🇹 Italiano più sotto.*

## Features

- **Hybrid routing**
  1. **Keyword rules (free):** "read / find / list…" → Haiku, "design / refactor / debug…" → Opus.
  2. **Haiku classifier (a few tokens):** only when the rules can't tell, Haiku answers *easy / medium / hard*.
  3. **Cache guard:** with a long context it never steps *down* a model, because the new model would re‑read everything without the prompt cache.
- **One model per turn:** the model never changes mid‑turn, so the prompt cache stays warm.
- **Subagents routed by type:** `Explore` → Haiku, `Plan` and reviewers → Opus, the rest by its task.
- **Side pane:** running and finished agents, with model, effort, the reason for the choice, steps, tokens and time.
- **Usage limits:** session (5 h) and weekly (7 days) bars with reset times. Shown on Pro/Max subscriptions.
- **Pixel mascots:** body color, hat (cap, chef, helmet, crown, beanie) and hat color for each tier, saved across sessions.
- **The graphics cost zero tokens:** everything is drawn locally by the app.

## Install

In a Claude Code terminal session:

```
/plugin install pixel-crew --marketplace <owner>/pixel-crew
```

Answer `y` to add the marketplace, then pick the scope (user). Once it is installed at user scope, it also runs in the desktop app's Code tab.

To try it from a local folder:

```bash
claude --plugin-dir /path/to/pixel-crew
```

## Use

| Command | What it does |
| --- | --- |
| `/crew` | opens the pane |
| `/crew auto` | automatic routing (default) |
| `/crew haiku` · `/crew sonnet` · `/crew opus` | pins every message to one model |
| `/crew reset` | clears the agent list |

The pane's buttons do the same, and **Customize** changes the mascots.

## Configure

Edit `hooks/config.ts`:

- `MODELS`: the model id of each tier
- `USE_CLASSIFIER`: `false` for rules only (zero extra tokens)
- `KEEP_CACHE_ABOVE_TOKENS`: the cache‑guard threshold
- `LIGHT_WORDS` / `HEAVY_WORDS`: the keywords
- `PALETTE`, `DEFAULT_LOOKS`: colors and default mascots

## Develop

```bash
claude plugin validate .
claude plugin test .
```

Uses the Claude Code function hooks API (early access): `turn.start`, `turn.step`, `agent.spawn`, `session.measure`, `ui.render`.

---

## 🇮🇹 Italiano

**Pixel Crew** sceglie per ogni messaggio e per ogni agent il modello più economico che basta per il lavoro (Haiku, Sonnet oppure Opus), così risparmi token. Un riquadro a destra mostra chi sta lavorando, con quale modello e perché, con un omino pixel personalizzabile, più le barre dei limiti di utilizzo (sessione di 5 ore e settimana).

- **Smistamento ibrido:** prima le parole chiave (gratis). Se non bastano, Haiku classifica la richiesta come facile, media o difficile (pochi token).
- **Protezione cache:** con un contesto lungo non scende mai a un modello inferiore, perché costerebbe di più.
- **Comandi:** `/crew`, `/crew auto`, `/crew haiku|sonnet|opus`, `/crew reset`.
- **Personalizza omini:** pulsante nel riquadro per colore del corpo, cappello e colore del cappello.
- **La grafica non consuma token.**

> Nota: Anthropic misura i limiti in due finestre, 5 ore e 7 giorni; non esiste un limite "giornaliero". Le barre compaiono solo con un abbonamento Pro/Max, dopo il primo messaggio.

## License

MIT
