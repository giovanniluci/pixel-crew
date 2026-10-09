// Every word the pane and /crew show, in English and Italian.
import type { Hat, Lang, Mode, Reason, Settings } from '../types'
import { MODEL_LABEL, PALETTE } from './config'

const EN = {
  waiting: 'waiting',
  jobs: (n: number) => `${n} jobs`,
  steps: 'steps',
  tokens: 'tokens',
  cached: 'cached',
  commandCost: 'Cost',
  commandTokens: 'Tokens',
  commandTime: 'Time',
  crew: 'Crew',
  crewDone: (done: number, all: number) => `${done}/${all} done`,
  crewAllDone: 'all done ✓',
  crewIdle: 'waiting for a command',
  session: 'Session',
  saved: (usd: string, percent: number) => `saved ${usd} (${percent}%) vs always Opus`,
  limits: 'Usage limits',
  noLimits: 'No reading yet (it comes after the first message, on Pro/Max only).',
  limitLabel: { five_hour: 'Session (5 hours)', seven_day: 'Week (7 days)', spend_limit: 'Spend limit' } as Record<string, string>,
  resetsNow: 'resets now',
  resetsIn: (d: number, h: number, m: number) => (d > 0 ? `resets in ${d}d ${h}h` : `resets in ${h}h ${m}m`),
  customize: 'Customize',
  closeCustomize: 'Close',
  body: 'Body color',
  hat: 'Hat',
  hatColor: 'Hat color',
  restore: 'Restore',
  hats: { none: 'None', cap: 'Cap', chef: 'Chef', helmet: 'Helmet', crown: 'Crown', beanie: 'Beanie' } as Record<Hat, string>,
  colors: ['Orange', 'Red', 'Pink', 'Purple', 'Blue', 'Cyan', 'Green', 'Gold', 'White', 'Grey', 'Black', 'Brown'],
  reason: (r: Reason): string => {
    switch (r.kind) {
      case 'rule': return `rule: "${r.word}"`
      case 'classifier': return `Haiku says: ${r.answer}`
      case 'classifier-off': return 'no rule, classifier off: medium'
      case 'classifier-failed': return 'classifier did not answer: medium'
      case 'pinned': return 'picked by hand'
      case 'follow-up': return 'same as before'
      case 'short-reply': return 'short reply: always Haiku'
      case 'cache': return `stays: long context, the cache is worth more than ${MODEL_LABEL[r.wanted]}`
      case 'escalation': return 'last answer did not work: one tier up'
      case 'agent-type': return `agent: ${r.type}`
      case 'agent-default': return 'agent: normal work'
      case 'agent-asked': return 'model asked by Claude'
    }
  },
  commandDescription: 'Pixel Crew: open the pane or change settings (help). Models: /crew-auto /crew-haiku /crew-sonnet /crew-opus',
  status: (mode: Mode, s: Settings) => [
    `Pixel Crew · mode ${MODE_NAME[mode]}`,
    `classifier ${s.useClassifier ? 'on' : 'off'} · cache guard ${s.keepCacheAbove === null ? 'off' : `above ${s.keepCacheAbove.toLocaleString('en')} tokens`} · language en`,
  ].join('\n'),
  modeSet: (mode: Mode) => `Pixel Crew: mode ${MODE_NAME[mode]}.`,
  cleared: 'Pixel Crew: crew cleared.',
  classifierSet: (on: boolean) => `Pixel Crew: classifier ${on ? 'on' : 'off'}.`,
  cacheSet: (n: number | null) => `Pixel Crew: cache guard ${n === null ? 'off' : `above ${n.toLocaleString('en')} tokens`}.`,
  langSet: 'Pixel Crew: language English.',
  help: [
    '/crew                    open the pane and show the settings',
    '/crew-auto               automatic routing (default)',
    '/crew-haiku  /crew-sonnet  /crew-opus   one model for every message',
    '/crew classifier on|off  ask Haiku when the keywords cannot decide',
    '/crew cache <tokens>|off keep the model above this much context',
    '/crew lang en|it         language of the pane',
    '/crew reset              clear the crew',
  ].join('\n'),
}

const IT: typeof EN = {
  waiting: 'in attesa',
  jobs: n => `${n} lavori`,
  steps: 'passi',
  tokens: 'token',
  cached: 'in cache',
  commandCost: 'Costo',
  commandTokens: 'Token',
  commandTime: 'Tempo',
  crew: 'Squadra',
  crewDone: (done, all) => `${done}/${all} completati`,
  crewAllDone: 'tutto completato ✓',
  crewIdle: 'in attesa di un comando',
  session: 'Sessione',
  saved: (usd, percent) => `risparmiati ${usd} (${percent}%) rispetto a sempre Opus`,
  limits: 'Limiti di utilizzo',
  noLimits: 'Nessuna lettura ancora (arriva dopo il primo messaggio; solo con Pro/Max).',
  limitLabel: { five_hour: 'Sessione (5 ore)', seven_day: 'Settimana (7 giorni)', spend_limit: 'Limite di spesa' },
  resetsNow: 'si azzera ora',
  resetsIn: (d, h, m) => (d > 0 ? `si azzera tra ${d}g ${h}h` : `si azzera tra ${h}h ${m}m`),
  customize: 'Personalizza',
  closeCustomize: 'Chiudi',
  body: 'Colore corpo',
  hat: 'Cappello',
  hatColor: 'Colore cappello',
  restore: 'Ripristina',
  hats: { none: 'Nessuno', cap: 'Berretto', chef: 'Cuoco', helmet: 'Casco', crown: 'Corona', beanie: 'Cuffia' },
  colors: ['Arancio', 'Rosso', 'Rosa', 'Viola', 'Blu', 'Azzurro', 'Verde', 'Oro', 'Bianco', 'Grigio', 'Nero', 'Marrone'],
  reason: r => {
    switch (r.kind) {
      case 'rule': return `regola: "${r.word}"`
      case 'classifier': return `Haiku dice: ${r.answer}`
      case 'classifier-off': return 'nessuna regola, smistatore spento: medio'
      case 'classifier-failed': return 'lo smistatore non ha risposto: medio'
      case 'pinned': return 'scelto a mano'
      case 'follow-up': return 'come prima'
      case 'short-reply': return 'risposta breve: sempre Haiku'
      case 'cache': return `resta: contesto lungo, la cache vale più di ${MODEL_LABEL[r.wanted]}`
      case 'escalation': return 'la risposta non andava: un livello sopra'
      case 'agent-type': return `agent: ${r.type}`
      case 'agent-default': return 'agent: lavoro normale'
      case 'agent-asked': return 'modello chiesto da Claude'
    }
  },
  commandDescription: EN.commandDescription,
  status: (mode, s) => [
    `Pixel Crew · modalità ${MODE_NAME[mode]}`,
    `smistatore ${s.useClassifier ? 'acceso' : 'spento'} · protezione cache ${s.keepCacheAbove === null ? 'spenta' : `sopra ${s.keepCacheAbove.toLocaleString('it')} token`} · lingua it`,
  ].join('\n'),
  modeSet: mode => `Pixel Crew: modalità ${MODE_NAME[mode]}.`,
  cleared: 'Pixel Crew: squadra azzerata.',
  classifierSet: on => `Pixel Crew: smistatore ${on ? 'acceso' : 'spento'}.`,
  cacheSet: n => `Pixel Crew: protezione cache ${n === null ? 'spenta' : `sopra ${n.toLocaleString('it')} token`}.`,
  langSet: 'Pixel Crew: lingua italiana.',
  help: [
    '/crew                    apre il riquadro e mostra le impostazioni',
    '/crew-auto               smistamento automatico (predefinito)',
    '/crew-haiku  /crew-sonnet  /crew-opus   un modello per tutti i messaggi',
    '/crew classifier on|off  chiede a Haiku quando le parole chiave non bastano',
    '/crew cache <token>|off  non cambia modello sopra questo contesto',
    '/crew lang en|it         lingua del riquadro',
    '/crew reset              azzera la squadra',
  ].join('\n'),
}

const MODE_NAME: Record<Mode, string> = { auto: 'Auto', ...MODEL_LABEL }

export type Strings = typeof EN

export const strings = (lang: Lang): Strings => (lang === 'it' ? IT : EN)

export const colorOptions = (lang: Lang) =>
  PALETTE.map((value, i) => ({ value, label: strings(lang).colors[i] ?? value }))

export const hatOptions = (lang: Lang, hats: readonly Hat[]) =>
  hats.map(value => ({ value, label: strings(lang).hats[value] }))

export const modeName = (mode: Mode) => MODE_NAME[mode]

/** The pane follows the system language until /crew lang picks one. */
export function systemLang(): Lang {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('it') ? 'it' : 'en'
  } catch {
    return 'en'
  }
}

