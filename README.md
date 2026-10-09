# 🦀 Pixel Crew

**Smart model routing for Claude Code. Every message goes to the cheapest model that can do the job, and a crew of three pixel workers shows you who is doing what.**

Haiku, Sonnet and Opus each get their own pixel mascot and their own progress bar in a side pane. You see which model picked up your request and why, how many tokens it used, what it cost, and how much you saved compared with running everything on Opus.

*🇮🇹 Italiano più sotto.*

<!-- Add a screenshot of the pane here: ![Pixel Crew pane](docs/pane.png) -->

## Why

Most of what you ask a coding agent is light work: find a file, list some functions, rename a variable. Running all of it on the biggest model burns tokens and usage limits for nothing. Pixel Crew sends light work to Haiku, normal work to Sonnet and hard work to Opus, without you switching models by hand.

## How it routes

1. **Keyword rules (free).** Each model has its own keywords, in English and Italian (list below). Keywords match whole words, so "bug" does not fire inside "debugger" and "error" does not fire after "no" ("no errors").
2. **Haiku classifier (a few tokens).** When the rules can't decide (no keyword, mixed signals, a long message or code), Haiku answers *easy / medium / hard*. If it takes more than 2.5 s or fails, the message goes to Sonnet.
3. **Cache guard.** The prompt cache belongs to one model, so stepping down in a long conversation re-reads everything at full price. Above 40k tokens of context the model never steps down; stepping up is always allowed.
4. **Escalation.** Reply "still not working" (or "non funziona ancora") and the next turn moves one tier up.
5. **Short replies.** "no", "yes", "ok", "thanks", "grazie", "ciao"… always go to Haiku. "go on", "continue", "vai", "procedi" keep the current model.
6. **Subagents by type.** Explorers and searchers → Haiku; planners, reviewers and architects → Opus, plugin agents included (`feature-dev:code-explorer`, `pr-review-toolkit:code-reviewer`…); everything else by the keywords of its task.

The model never changes in the middle of a turn, so the cache stays warm.

## Keywords

Write one of these words in your message (or in a subagent's task) to send it to that model. They match the start of a word, so "summar" also matches "summarize" and "summary". The full lists are in `hooks/config.ts`.

| Model | English | Italiano |
| --- | --- | --- |
| 🟢 **Haiku** (light) | read, find, list, search, show, summarize, translate, rename, open, where, what is, which, how many, count, print, display, tell me, check if, look up, grep, locate, format, sort, copy, move, exists, version | leggi, cerca, trova, elenca, mostra, riassumi, traduci, rinomina, apri, dove, quanti, cos'è, qual è, quale, controlla se, verifica se, conta, stampa, visualizza, dimmi, formatta, ordina, copia, sposta, esiste, versione |
| 🔵 **Sonnet** (medium) | write, add, modify, create, update, fix, change, explain, complete, generate, document, comment, convert, extend, integrate, configure, install, connect, edit, build, tests, replace, remove, delete | scrivi, aggiungi, modifica, crea, aggiorna, correggi, cambia, spiega, completa, genera, documenta, commenta, converti, estendi, integra, configura, installa, collega, test, sostituisci, rimuovi, elimina |
| 🟠 **Opus** (heavy) | design, architect, refactor, debug, bug, why does, not working, error, analyze, optimize, security, migrate, strategy, plan, review, rewrite, implement, algorithm, restructure, vulnerability, performance, scalability, concurrency, race condition, deadlock, memory leak, crash, investigate, evaluate, compare, trade-off, from scratch, root cause, deep dive, end-to-end, system design, audit | progetta, architettura, refactor, debug, bug, perché non, non funziona, errore, analizza, ottimizza, sicurezza, migra, strategia, pianifica, revisione, riscrivi, implementa, algoritmo, ristruttura, rifattorizza, vulnerabilità, prestazioni, scalabilità, concorrenza, indaga, valuta, confronta, da zero, causa principale |

When words of different models meet:
- an Opus word wins over Sonnet ("refactor and add tests" → Opus);
- a Sonnet word wins over Haiku ("read the README and write a summary" → Sonnet);
- Opus and Haiku words together ("find the bug") go to the classifier.

Haiku words alone never win on a long message (over 600 characters) or one with code: the classifier decides.

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
| `/crew-auto` or `/crew auto` | automatic routing (default) |
| `/crew-test` | test run: starts one subagent per model in parallel (Explore → Haiku, general-purpose → Sonnet, Plan → Opus) and checks each against the model it really got. Costs the tokens of three subagents |
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
- **Parole chiave:** ogni modello ha le sue, in italiano e in inglese (tabella "Keywords" sopra). Haiku: leggi, cerca, elenca, mostra… Sonnet: scrivi, aggiungi, modifica, spiega… Opus: progetta, refactor, debug, analizza…
- **Risposte brevi:** "no", "sì", "ok", "grazie", "ciao"… vanno sempre su Haiku.
- **Protezione cache:** con più di 40k token di contesto non scende mai di modello; salire è sempre permesso.
- **Escalation:** se rispondi "non funziona ancora", il turno dopo sale di un livello.
- **Riquadro:** tre operatori sempre visibili, ognuno con la sua barra; un nuovo comando azzera le barre.
- **Comandi:** `/crew`, `/crew-auto`, `/crew-haiku`, `/crew-sonnet`, `/crew-opus`, `/crew-test`, `/crew classifier on|off`, `/crew cache 60k|off`, `/crew lang it`, `/crew reset`.
- **Personalizza:** colore del corpo, cappello e colore del cappello per ogni omino, dal riquadro.

> Anthropic misura i limiti in due finestre, 5 ore e 7 giorni. Le barre compaiono solo con un abbonamento Pro/Max, dopo il primo messaggio.

## License

MIT
