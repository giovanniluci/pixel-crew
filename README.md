# 🦀 Pixel Crew

**Smart model routing for Claude Code. Every message goes to the cheapest model that can do the job, and a crew of three pixel workers shows you who is doing what.**

Haiku, Sonnet and Opus each get their own pixel mascot and their own progress bar in a side pane. You see which model picked up your request and why, how many tokens it used, what it cost, and how much you saved compared with running everything on Opus.

*🇮🇹 Italiano più sotto.*

<!-- Add a screenshot of the pane here: ![Pixel Crew pane](docs/pane.png) -->

## Why

Most of what you ask a coding agent is light work: find a file, list some functions, rename a variable. Running all of it on the biggest model burns tokens and usage limits for nothing. Pixel Crew sends light work to Haiku, normal work to Sonnet and hard work to Opus, without you switching models by hand.

## How it routes

1. **Keyword rules (free).** "find", "list", "show", "summarize"… go to Haiku. "refactor", "debug", "design", "security"… go to Opus. Keywords match whole words, so "bug" does not fire inside "debugger" and "error" does not fire after "no" ("no errors").
2. **Haiku classifier (a few tokens).** When the rules can't decide (no keyword, mixed signals, a long message or code), Haiku answers *easy / medium / hard*. If it takes more than 2.5 s or fails, the message goes to Sonnet.
3. **Cache guard.** The prompt cache belongs to one model, so switching models in a long conversation re-reads everything at full price. Above 40k tokens of context the model is never changed, up or down.
4. **Escalation.** Reply "still not working" (or "non funziona ancora") and the next turn moves one tier up.
5. **Follow-ups.** "ok", "go on", "continue" keep the current model.
6. **Subagents by type.** Explorers and searchers → Haiku; planners, reviewers and architects → Opus, plugin agents included (`feature-dev:code-explorer`, `pr-review-toolkit:code-reviewer`…); everything else by its task.

The model never changes in the middle of a turn, so the cache stays warm.

## The pane

- **Three workers, always on screen:** Haiku, Sonnet and Opus. Each one shows its current job, the reason it was picked, steps, fresh tokens, cached tokens and time.
- **Honest progress bars:** a sliding block while a worker is busy (the number of steps is unknown, so no fake percentage), full with ✓ when it is done, empty while it waits.
- **Per command:** a new command clears the crew and restarts the bars. Subagents still working for the previous command stay until they finish.
- **Cost:** the current command's estimated cost, tokens and time, plus the session cost and the saving versus always-Opus.
- **Usage limits:** session (5 h) and weekly (7 days) bars with reset times, on Pro/Max plans.
- **Customize:** body color, hat and hat color for each worker, saved across sessions.
- **Zero tokens for the graphics:** everything is drawn locally.

## Install

In a Claude Code terminal session:

```
/plugin install pixel-crew --marketplace <owner>/pixel-crew
```

Answer `y` to add the marketplace, then choose the user scope. Installed at user scope, it also runs in the desktop app's Code tab.

To try it from a local folder:

```bash
claude --plugin-dir /path/to/pixel-crew
```

## Commands

| Command | What it does |
| --- | --- |
| `/crew` | opens the pane and shows the current settings |
| `/crew-auto` | automatic routing (default) |
| `/crew-haiku` · `/crew-sonnet` · `/crew-opus` | one model for every message |
| `/crew classifier on\|off` | ask Haiku when the keywords can't decide |
| `/crew cache 60k` · `/crew cache off` | cache-guard threshold |
| `/crew lang en\|it` | language of the pane |
| `/crew reset` | clears the crew |

Only the first words count, and the model commands ignore anything typed after them. The buttons at the top of the pane switch the mode too.

## Configure

Everything else lives in `hooks/config.ts`: the model of each tier, effort levels, keywords, negations, complaint phrases, the long-message threshold, prices (used only for the savings estimate), colors and default mascots.

## Develop

```bash
claude plugin validate .
claude plugin test .
```

The tests cover the keyword rules (word boundaries, negations, long messages, code), the cache guard, escalation, subagent routing, `/crew` parsing, cost and savings, crew state and the pane on every surface.

Built on the Claude Code function hooks API (early access): `turn.start`, `turn.step`, `turn.complete`, `agent.spawn`, `session.measure`, `ui.render`.

The savings figure is an estimate from public per-token prices. It assumes the same tokens would have been used on Opus, and it does not include the cost of the Haiku classifier.

---

## 🇮🇹 Italiano

**Pixel Crew** manda ogni messaggio al modello più economico che basta per il lavoro (Haiku, Sonnet oppure Opus). Tre omini pixel, uno per modello, mostrano in un riquadro chi sta lavorando, perché, quanti token usa e quanto hai risparmiato rispetto a usare sempre Opus.

- **Smistamento:** prima le parole chiave (gratis, parole intere, ignora le negazioni come "nessun errore"); se non bastano decide Haiku in massimo 2,5 secondi, altrimenti Sonnet.
- **Protezione cache:** con più di 40k token di contesto non cambia modello, né in su né in giù.
- **Escalation:** se rispondi "non funziona ancora", il turno dopo sale di un livello.
- **Riquadro:** tre operatori sempre visibili, ognuno con la sua barra; un nuovo comando azzera le barre.
- **Comandi:** `/crew`, `/crew-auto`, `/crew-haiku`, `/crew-sonnet`, `/crew-opus`, `/crew classifier on|off`, `/crew cache 60k|off`, `/crew lang it`, `/crew reset`.
- **Personalizza:** colore del corpo, cappello e colore del cappello per ogni omino, dal riquadro.

> Anthropic misura i limiti in due finestre, 5 ore e 7 giorni. Le barre compaiono solo con un abbonamento Pro/Max, dopo il primo messaggio.

## License

MIT
