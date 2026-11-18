import type { NewsEdition, NewsEditionPayload } from './types';

/** Demo mode never touches PostgreSQL. The briefing still has to render so the
 *  public preview and the browser check can exercise the page. */
export function makeDemoEdition(date: string): NewsEdition {
  const generatedAt = `${date}T06:30:00.000Z`;
  const payload: NewsEditionPayload = {
    version: 1,
    date,
    headline: 'Gold sucht nach dem Ausverkauf eine Basis, Tech bleibt der Gegenspieler',
    marketPulse: [
      { label: 'Gold', stance: 'neutral', note: 'Nach dem scharfen Rücksetzer fehlt noch ein höheres Tief.' },
      { label: 'US-Dollar', stance: 'bullish', note: 'Hohe Renditen halten den Dollar fest, das bremst Gold.' },
      { label: 'Tech', stance: 'bullish', note: 'KI-Infrastruktur trägt, Halbleiter führen die Erholung an.' },
      { label: 'Risiko', stance: 'neutral', note: 'VIX entspannt sich, aber die Anleiherenditen bleiben der Störfaktor.' },
    ],
    today: {
      summary: 'Gold hat den Ausverkauf gestoppt, aber noch keinen Impuls nach oben. Der starke Dollar und die hohe US-Rendite bleiben die entscheidenden Gegenkräfte. Für Intraday zählt, ob 3.760 hält und ob der Dollar am Nachmittag dreht.',
      bullets: [
        { text: 'Gold stabilisiert sich über 3.760; ein Bruch darunter würde die nächste Verkaufsrunde auslösen.', impact: 'bearish', assets: ['XAU/USD'], refs: [{ title: 'Gold holds near $3,780 after sharp selloff', url: 'https://example.com/gold', source: 'Demo Wire' }] },
        { text: 'Die US-10-Jahres-Rendite über 5 % stützt den Dollar und begrenzt Gold-Rallys.', impact: 'bearish', assets: ['XAU/USD', 'DXY'], refs: [{ title: 'Treasury yields stay above 5%', url: 'https://example.com/yields', source: 'Demo Wire' }] },
        { text: 'Halbleiter erholen sich, Nvidia und TSMC führen; das stützt die Tech-Watchlist.', impact: 'bullish', assets: ['NVDA', 'TSM'], refs: [{ title: 'Chip stocks rebound as AI demand holds', url: 'https://example.com/chips', source: 'Demo Wire' }] },
      ],
    },
    week: {
      summary: 'Die Woche wird von US-Daten und Fed-Sprechern bestimmt. Gold reagiert empfindlich auf jede Verschiebung der Zinserwartungen; Tech läuft parallel zur Renditekurve.',
      bullets: [
        { text: 'Arbeitsmarktdaten am Donnerstag sind der nächste Trigger für Dollar und Gold.', impact: 'neutral', assets: ['XAU/USD', 'DXY'], refs: [] },
        { text: 'Mehrere Fed-Redner könnten die Zinserwartung nach oben oder unten verschieben.', impact: 'neutral', assets: ['US10Y'], refs: [] },
      ],
    },
    month: {
      summary: 'Im November dominiert die Frage, ob die hohen Renditen den KI-Investitionszyklus bremsen. Gold hat einen großen Teil der Rally abgegeben, Tech hält sich besser als der breite Markt.',
      bullets: [
        { text: 'Der Monat läuft für Gold negativ; eine nachhaltige Wende braucht fallende Realzinsen.', impact: 'bearish', assets: ['XAU/USD'], refs: [] },
        { text: 'KI-Capex und Rechenzentren bleiben die stärkste strukturelle Story im Tech-Sektor.', impact: 'bullish', assets: ['NVDA', 'ASML'], refs: [] },
      ],
    },
    year: {
      summary: '2026 ist bislang ein Jahr der Extreme: Gold markierte im Frühjahr ein Rekordhoch, korrigierte danach aber scharf. Tech blieb getragen vom KI-Zyklus, während die Anleiherenditen die Bewertungen deckelten.',
      bullets: [
        { text: 'Gold ist nach dem Rekordhoch deutlich unter Druck; die Volatilität bleibt hoch.', impact: 'bearish', assets: ['XAU/USD'], refs: [] },
        { text: 'KI-Infrastruktur ist die dominante Wachstumsstory des Jahres geblieben.', impact: 'bullish', assets: ['NVDA'], refs: [] },
        { text: 'Hohe Staatsverschuldung und Renditen sind der rote Faden des Makro-Jahres.', impact: 'neutral', assets: ['US10Y'], refs: [] },
      ],
    },
    lastYear: {
      summary: '2025 endete mit einer Gold-Rally und einem starken KI-Jahr. Die Fed begann vorsichtig zu lockern, doch die Renditen blieben hoch. Das setzte die Bühne für den scharfen Gold-Ausverkauf 2026.',
      bullets: [
        { text: 'Gold beendete 2025 nahe einem Rekordhoch, getragen von Zentralbankkäufen.', impact: 'bullish', assets: ['XAU/USD'], refs: [] },
        { text: 'KI-Investitionen beschleunigten sich, Halbleiter wurden knapp.', impact: 'bullish', assets: ['NVDA', 'TSM'], refs: [] },
      ],
    },
    outlook: [
      { horizon: 'Nächste Woche', bias: 'neutral', summary: 'Gold bleibt zwischen 3.700 und 3.900 gefangen, solange die Renditen nicht drehen. Ein schwächerer Dollar wäre der erste Hinweis auf eine Erholung.' },
      { horizon: 'Nächster Monat', bias: 'bearish', summary: 'Wenn die Fed falkenhaft bleibt, testet Gold die 3.600er-Zone. Tech kann sich nur halten, solange die Gewinne der KI-Infrastruktur stimmen.' },
      { horizon: 'Bis Jahresende', bias: 'neutral', summary: 'Das Jahr endet wahrscheinlich mit hoher Volatilität. Die entscheidende Frage ist, ob die Realzinsen fallen, bevor die Gold-Nachfrage endgültig kippt.' },
    ],
    ai: {
      summary: 'KI-News bleiben marktbewegend, aber der Markt unterscheidet zunehmend zwischen Infrastruktur und Anwendungen. Rechenzentren und Chips tragen, Anwendungsfirmen brauchen Beweise.',
      bullets: [
        { text: 'Neue Modellgenerationen erhöhen den Bedarf an Speicher und Rechenleistung.', impact: 'bullish', assets: ['MU', 'NVDA'], refs: [] },
        { text: 'Regulierung bleibt ein Risiko für Anwendungsfirmen, weniger für Infrastruktur.', impact: 'neutral', assets: ['MSFT'], refs: [] },
      ],
    },
    movers: [
      { title: 'Führungswechsel im Halbleitersektor', detail: 'Ein CEO-Abgang verschiebt die Strategie eines Watchlist-Unternehmens.', impact: 'neutral' },
      { title: 'Übernahme im KI-Umfeld', detail: 'Konsolidierung bei Infrastruktur-Software hält an.', impact: 'bullish' },
    ],
    watchlist: [
      { symbol: 'NVDA', name: 'NVIDIA', sentiment: 'bullish', note: 'KI-Nachfrage intakt, Rücksetzer werden gekauft.' },
      { symbol: 'MU', name: 'Micron Technology', sentiment: 'bullish', note: 'Speicherpreise ziehen an.' },
      { symbol: 'ASML', name: 'ASML Holding', sentiment: 'neutral', note: 'Auftragslage gut, China-Risiko bleibt.' },
      { symbol: 'TSLA', name: 'Tesla', sentiment: 'bearish', note: 'Margendruck und Gegenwind in Europa.' },
      { symbol: 'RHM.DE', name: 'Rheinmetall', sentiment: 'bullish', note: 'Verteidigungsausgaben bleiben strukturell hoch.' },
      { symbol: 'SIE.DE', name: 'Siemens', sentiment: 'neutral', note: 'Industrie schwach, Software stützt.' },
    ],
    sources: [
      { title: 'Gold holds near $3,780 after sharp selloff', url: 'https://example.com/gold', source: 'Demo Wire' },
      { title: 'Treasury yields stay above 5%', url: 'https://example.com/yields', source: 'Demo Wire' },
      { title: 'Chip stocks rebound as AI demand holds', url: 'https://example.com/chips', source: 'Demo Wire' },
    ],
    meta: {
      generatedAt,
      model: 'demo',
      sourceCount: 12,
      itemCount: 84,
      feedCount: 23,
      failedFeeds: [],
      unsupportedNumbers: [],
      quotes: [
        { symbol: 'XAU/USD', label: 'Gold', price: 3784.45, changePercent: -2.09, note: 'Spot' },
        { symbol: 'DX-Y.NYB', label: 'DXY', price: 103.775, changePercent: 0.28 },
        { symbol: '^TNX', label: 'US 10Y', price: 5.103, changePercent: null, changeBp: -1.0 },
        { symbol: 'NQ=F', label: 'Nasdaq 100', price: 27416.75, changePercent: 1.26 },
      ],
      coverage: { today: 38, week: 120, month: 160, year: 180, lastYear: 24 },
    },
  };

  return {
    date,
    status: 'ready',
    generatedAt,
    startedAt: generatedAt,
    model: 'demo',
    sourceCount: payload.sources.length,
    error: null,
    payload,
  };
}
