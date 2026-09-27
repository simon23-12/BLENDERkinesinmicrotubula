// Inhalte der Annotationen und Phasen-Beschreibungen (Deutsch).
// Koordinaten: 1 Einheit = 1 nm, glTF Y-up (Blender z -> three y, Blender y -> three -z).

export const ANNOTATIONS = [
  {
    id: 'heads',
    title: 'Motorköpfe',
    kicker: 'Kinesin · Motordomäne',
    color: '#f39a2e',
    meshes: ['Head_A', 'Head_B'],
    markers: [{ node: 'Head_A', offset: [0, 3.2, 0], label: 'Motorkopf A' }, { node: 'Head_B', offset: [0, 3.2, 0], label: 'Motorkopf B' }],
    focus: { node: 'Head_A', distance: 42 },
    live: 'heads',
    text:
      'Die beiden identischen Köpfe sind die eigentlichen Motoren. Jeder Kopf ist ein Enzym (ATPase), das ATP spaltet und dabei seine Form verändert. ' +
      'Ein Kopf bleibt immer am Mikrotubulus gebunden, während der andere nach vorn schwingt – deshalb kann ein einzelnes Kinesin hunderte Schritte laufen, ohne abzufallen (Prozessivität).',
    facts: [
      ['Größe', '≈ 7 × 4,5 nm, ~340 Aminosäuren'],
      ['Schritt pro Kopf', '16 nm'],
      ['Schritt des Moleküls', '8 nm = 1 Tubulin-Dimer'],
      ['Tempo (real)', '≈ 800 nm/s, ~100 Schritte/s'],
      ['Maximale Kraft', '≈ 6 pN'],
    ],
  },
  {
    id: 'atp',
    title: 'ATP → ADP + Pᵢ',
    kicker: 'Treibstoff',
    color: '#ff9a1a',
    meshes: ['ADP_', 'Pi_'],
    markers: [{ node: '@activeNucleotide', offset: [0, 2.2, 0] }],
    focus: { node: '@activeNucleotide', distance: 22 },
    live: 'atp',
    text:
      'Pro 8-nm-Schritt wird genau ein ATP-Molekül verbraucht. Die Bindung von ATP (nicht seine Spaltung!) löst den Kraftschlag aus; ' +
      'die Hydrolyse zu ADP und Phosphat (Pᵢ) und die Freisetzung der Produkte takten den Zyklus. ' +
      'Atomfarben: Phosphor orange, Sauerstoff rot, Stickstoff blau, Kohlenstoff grau. Zur Sichtbarkeit ≈ 2,5× vergrößert.',
    facts: [
      ['Verbrauch', '1 ATP pro 8-nm-Schritt'],
      ['Freie Energie', '≈ 80–100 pN·nm pro ATP'],
      ['Mechanische Arbeit', '6 pN × 8 nm ≈ 48 pN·nm'],
      ['Wirkungsgrad', '≈ 50 %'],
    ],
  },
  {
    id: 'necklinker',
    title: 'Neck-Linker',
    kicker: 'Kraftschlag',
    color: '#ffd23f',
    meshes: ['NeckLinker_'],
    markers: [{ node: 'NeckLinker_A', offset: [0, 0.55, 0] }],
    focus: { node: 'Kinesin_Root', distance: 30 },
    text:
      'Ein kurzes, flexibles Peptid (~14 Aminosäuren), das jeden Kopf mit dem Hals verbindet. Bindet ATP an den vorderen Kopf, ' +
      '„dockt“ sein Neck-Linker an die Kopfoberfläche an und zeigt nach vorn. Dadurch wird der hintere Kopf an den gebundenen Kopf vorbei nach vorn geworfen.',
    facts: [
      ['Länge', '~14 Aminosäuren (≈ 5 nm gestreckt)'],
      ['Zustand ohne ATP', 'ungedockt, flexibel'],
      ['Zustand mit ATP', 'gedockt → zeigt zum Plus-Ende'],
    ],
  },
  {
    id: 'neckcoil',
    title: 'Hals (Neck-Coiled-Coil)',
    kicker: 'Dimerisierung',
    color: '#e56b1f',
    meshes: ['NeckCoil'],
    markers: [{ node: 'NeckCoil', bbox: true, offset: [1.5, 0, 0] }],
    focus: { node: 'Kinesin_Root', distance: 34 },
    text:
      'Hier treffen sich die beiden schweren Ketten: Zwei α-Helices winden sich umeinander (Coiled-Coil) und halten die Köpfe als Paar zusammen. ' +
      'Der Hals ist der Drehpunkt, an dem beide Neck-Linker ziehen.',
    facts: [['Aufbau', 'zwei α-Helices, Heptaden-Wiederholungen'], ['Funktion', 'koppelt die beiden Köpfe']],
  },
  {
    id: 'stalk',
    title: 'Stiel',
    kicker: 'Coiled-Coil',
    color: '#e56b1f',
    meshes: ['Stalk'],
    markers: [{ node: 'Kinesin_Root', offset: [-6.2, 16.5, 0] }],
    focus: { node: 'Kinesin_Root', distance: 90, offset: [-12, 22, 0] },
    text:
      'Ein langer, seilartiger Abschnitt aus zwei umeinander gewundenen α-Helices (linksgängige Superhelix). ' +
      'Er überbrückt den Abstand zwischen Motor und Fracht, damit das große Cargo den Mikrotubulus nicht berührt.',
    facts: [['Gesamtlänge Kinesin-1', '≈ 80 nm'], ['Struktur', 'Coil 1 + Coil 2, dazwischen das Scharnier']],
  },
  {
    id: 'hinge',
    title: 'Scharnier',
    kicker: 'Hinge · Regulation',
    color: '#ffe0a8',
    meshes: ['Hinge'],
    markers: [{ node: 'Hinge', bbox: true, offset: [1.8, 0, 0] }],
    focus: { node: 'Kinesin_Root', distance: 60, offset: [-12, 27, 0] },
    text:
      'Eine Unterbrechung der Coiled-Coil macht den Stiel biegsam. Ohne Fracht klappt Kinesin hier zusammen, der Schwanz legt sich auf die Köpfe ' +
      'und blockiert sie (Autoinhibition). So verschwendet ein unbeladener Motor kein ATP.',
    facts: [['Funktion', 'Flexibilität & Selbsthemmung'], ['Ohne Cargo', 'gefaltet, inaktiv']],
  },
  {
    id: 'tail',
    title: 'Schwanzdomäne',
    kicker: 'C-Terminus',
    color: '#d95a1a',
    meshes: ['Tail'],
    markers: [{ node: 'Tail', offset: [1.5, 2.6, 0] }],
    focus: { node: 'Tail', distance: 40 },
    text:
      'Das Ende der schweren Ketten. Es trägt die leichten Ketten und bindet Fracht-Adapter. Ein kurzes Motiv (IAK) kann bei fehlender Fracht ' +
      'direkt an die Köpfe binden und sie hemmen.',
    facts: [['Bindet', 'leichte Ketten, Adapter'], ['Regulation', 'IAK-Motiv hemmt die Köpfe']],
  },
  {
    id: 'klc',
    title: 'Leichte Ketten (KLC)',
    kicker: 'Fracht-Erkennung',
    color: '#b98be0',
    meshes: ['LightChain_'],
    markers: [{ node: 'LightChain_1', bbox: true, offset: [0, 1.5, 0] }],
    focus: { node: 'Tail', distance: 45 },
    text:
      'Zwei leichte Ketten mit TPR-Domänen (Tetratricopeptid-Wiederholungen) bilden die Greifhand des Motors. ' +
      'Sie erkennen Adapterproteine auf der Fracht und bestimmen so, was transportiert wird.',
    facts: [['Domänen', 'TPR-Wiederholungen'], ['Partner', 'z. B. JIP1, Calsyntenin']],
  },
  {
    id: 'adaptor',
    title: 'Adapterprotein',
    kicker: 'Motor ↔ Membran',
    color: '#7a64c8',
    meshes: ['Adaptor'],
    markers: [{ node: 'Adaptor', bbox: true, offset: [0, 0.5, 0] }],
    focus: { node: 'Tail', distance: 55 },
    text:
      'Adapter- und Rezeptorproteine verankern den Motor in der Membran der Fracht. Unterschiedliche Adapter sorgen dafür, ' +
      'dass Mitochondrien, synaptische Vesikel oder mRNA-Partikel zum richtigen Ort gebracht werden.',
    facts: [['Beispiele', 'JIP1/JIP3, TRAK/Milton (Mitochondrien)']],
  },
  {
    id: 'cargo',
    title: 'Fracht (Vesikel)',
    kicker: 'Cargo',
    color: '#84d2b0',
    meshes: ['Vesicle', 'MembraneProteins'],
    markers: [{ node: 'Cargo', offset: [0, 21.5, 0] }],
    focus: { node: 'Cargo', distance: 110 },
    text:
      'Ein von einer Lipiddoppelschicht umhülltes Bläschen mit eingebetteten Membranproteinen. In Nervenzellen transportiert Kinesin-1 solche Fracht ' +
      'vom Zellkörper bis zur Synapse – teils über einen Meter weit.',
    facts: [['Durchmesser hier', '≈ 40 nm'], ['Real', 'oft 50–1000 nm (Vesikel bis Mitochondrium)']],
  },
  {
    id: 'microtubule',
    title: 'Mikrotubulus',
    kicker: 'Cytoskelett · Schiene',
    color: '#5aa7d8',
    meshes: [],
    markers: [{ node: 'ANCHOR_Protofilament', offset: [0, 0, 0] }],
    focus: { node: 'ANCHOR_Protofilament', distance: 150 },
    text:
      'Ein hohler Zylinder aus 13 Protofilamenten, die aus αβ-Tubulin-Dimeren aufgebaut sind. Mikrotubuli bilden das „Schienennetz“ der Zelle, ' +
      'auf dem Motorproteine Fracht transportieren, und sie ziehen bei der Zellteilung die Chromosomen auseinander.',
    facts: [
      ['Durchmesser', '≈ 25 nm außen, 15 nm innen'],
      ['Protofilamente', '13'],
      ['Gitter', 'B-Gitter, 3-Start-Helix mit Naht'],
      ['Dimer-Abstand', '8 nm'],
    ],
  },
  {
    id: 'alpha',
    title: 'α-Tubulin',
    kicker: 'Baustein',
    color: '#a9dcec',
    meshes: ['Microtubule_Alpha'],
    markers: [{ node: 'ANCHOR_Alpha', offset: [0, 0.6, 0] }],
    focus: { node: 'ANCHOR_Alpha', distance: 40 },
    text:
      'Die eine Hälfte jedes Tubulin-Dimers. α-Tubulin bindet GTP fest an einer Stelle, an der es nie gespalten wird (N-Site). ' +
      'Im Protofilament zeigt α-Tubulin zum Minus-Ende.',
    facts: [['Masse', '≈ 50 kDa'], ['Größe', '≈ 4 nm'], ['GTP', 'N-Site, nicht hydrolysiert']],
  },
  {
    id: 'beta',
    title: 'β-Tubulin',
    kicker: 'Baustein · Bindestelle',
    color: '#2f7fc1',
    meshes: ['Microtubule_Beta'],
    markers: [{ node: 'ANCHOR_Beta', offset: [0, 0.6, 0] }],
    focus: { node: 'ANCHOR_Beta', distance: 40 },
    text:
      'Die zweite Hälfte des Dimers, am Plus-Ende freiliegend. Sein GTP wird nach dem Einbau gespalten – die „GTP-Kappe“ am Ende stabilisiert den Mikrotubulus. ' +
      'Die Kinesin-Köpfe binden überwiegend auf β-Tubulin, genau an der Grenze zum α-Tubulin desselben Dimers.',
    facts: [['GTP', 'E-Site, wird hydrolysiert'], ['Kinesin-Bindung', 'Schleife L11 & Helix α4 des Kopfes']],
  },
  {
    id: 'plusend',
    title: 'Plus-Ende',
    kicker: 'Richtung des Transports',
    color: '#f39a2e',
    meshes: [],
    markers: [{ node: 'ANCHOR_PlusEnd', offset: [0, 0, 0] }],
    focus: { node: 'ANCHOR_PlusEnd', distance: 90 },
    text:
      'Das dynamische Ende: Hier wächst und schrumpft der Mikrotubulus (dynamische Instabilität). Beim Abbau biegen sich die Protofilamente ' +
      'nach außen wie Widderhörner. Kinesin-1 läuft immer in diese Richtung – in Nervenzellen also vom Zellkörper zur Synapse (anterograd).',
    facts: [['Wachstum', 'schnell'], ['Motor dorthin', 'Kinesin (anterograd)']],
  },
  {
    id: 'minusend',
    title: 'Minus-Ende',
    kicker: 'Verankerung',
    color: '#5aa7d8',
    meshes: [],
    markers: [{ node: 'ANCHOR_MinusEnd', offset: [0, 13.5, 0] }],
    focus: { node: 'ANCHOR_MinusEnd', distance: 90 },
    text:
      'Das langsamere Ende ist meist im Mikrotubuli-organisierenden Zentrum (Zentrosom) verankert. Der Gegenspieler Dynein transportiert Fracht zu diesem Ende (retrograd).',
    facts: [['Verankert an', 'γ-Tubulin-Ringkomplex'], ['Motor dorthin', 'Dynein (retrograd)']],
  },
  {
    id: 'seam',
    title: 'Naht (Seam)',
    kicker: 'Gitter-Besonderheit',
    color: '#8fb8d8',
    meshes: [],
    markers: [{ node: 'ANCHOR_Seam', offset: [0, 0, 0] }],
    focus: { node: 'ANCHOR_Seam', distance: 60 },
    text:
      'Weil die Protofilamente um 3 Monomere versetzt schrauben, passt das Gitter an einer Stelle nicht nahtlos: Dort liegt α-Tubulin seitlich neben β-Tubulin. ' +
      'Diese Naht verläuft hier auf der Unterseite – dreh die Ansicht, um sie zu sehen.',
    facts: [['Kontakt an der Naht', 'α–β (A-Gitter)'], ['Sonst', 'α–α / β–β (B-Gitter)']],
  },
];

export const PHASES = {
  atp_binding: {
    title: 'ATP bindet',
    text: 'Ein ATP-Molekül diffundiert heran und bindet an den vorderen Kopf, der fest auf dem β-Tubulin sitzt. Der hintere Kopf hängt mit ADP lose dahinter.',
  },
  neck_docking: {
    title: 'Neck-Linker dockt an',
    text: 'Die ATP-Bindung lässt den Neck-Linker des vorderen Kopfes an dessen Oberfläche andocken – der Kraftschlag beginnt.',
  },
  swing: {
    title: 'Hand über Hand',
    text: 'Der hintere Kopf schwingt 16 nm nach vorn und überholt den gebundenen Kopf – abwechselnd links und rechts. Stiel und Fracht rücken 8 nm vor.',
  },
  landing_adp_release: {
    title: 'Andocken & ADP-Freisetzung',
    text: 'Der neue vordere Kopf bindet an die nächste Bindestelle auf demselben Protofilament und gibt sein ADP ab. Jetzt stehen beide Köpfe.',
  },
  hydrolysis: {
    title: 'ATP-Hydrolyse',
    text: 'Im hinteren Kopf wird ATP in ADP und anorganisches Phosphat (Pᵢ) gespalten.',
  },
  pi_release: {
    title: 'Phosphat wird frei',
    text: 'Pᵢ verlässt die Bindungstasche. Der hintere Kopf verliert dadurch seinen festen Halt am Mikrotubulus.',
  },
  rear_detach: {
    title: 'Hinterer Kopf löst sich',
    text: 'Der ADP-gebundene hintere Kopf löst sich – der Zyklus beginnt von vorn, mit vertauschten Rollen.',
  },
};

export function headStatus(isFront, u) {
  if (isFront) {
    if (u < 0.2) return 'vorne · fest gebunden · wartet auf ATP';
    if (u < 0.3) return 'vorne · ATP gebunden · Neck-Linker dockt';
    if (u < 0.72) return 'vorne · ATP gebunden · zieht den Partner nach vorn';
    if (u < 0.8) return 'jetzt hinten · spaltet ATP';
    if (u < 0.86) return 'hinten · gibt Pᵢ ab';
    return 'hinten · löst sich (ADP)';
  }
  if (u < 0.25) return 'hinten · lose (ADP) · wartet';
  if (u < 0.62) return 'schwingt 16 nm nach vorn';
  if (u < 0.72) return 'neu vorne · bindet · gibt ADP ab';
  return 'vorne · fest gebunden (leer)';
}
