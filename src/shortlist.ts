export type Priority = 'must' | 'recommended' | 'regular';
export type Goal = 'demo' | 'buy' | 'promo';
export const goals: Goal[] = ['demo', 'buy', 'promo'];

type Entry = [id: string, name: string, booth: string, priority: Priority, goals: Goal[], games: string[]];

const entries: Entry[] = [
  ['kinson', 'Kinson Key Games', '', 'must', ['demo', 'buy', 'promo'], [
    'Excursions - A Galactic Cruise Game', 'Manoomin: The Food that Grows on Water',
    'Galactic Cruise Perfect Planning Promo Card',
  ]],
  ['buttonshy', 'Button Shy Games', '4017', 'must', ['buy'], [
    'Lands of Amazement', 'Lands of Amazement Expansion Collection', 'The Cursed Cat', 'Reawaken',
    'Forest Rivals', 'Crime Sprawl', 'Astro ROVE', 'Jarl', 'Everything Machine', 'Shaper',
    'Forest Rivals 2p', 'Cursed Cat Solo', 'Agropolis boxed', 'Ugly Gryphon Inn',
  ]],
  ['devir', 'Devir Americas', '2722', 'must', ['demo', 'buy'], [
    'The White Castle Duel', 'Covenant', 'The White Castle: Boeki Expansion', 'Bitoku: Resutoran', 'Bamboo',
  ]],
  ['dicethrone', 'Dice Throne', '2523', 'must', ['demo', 'buy', 'promo'], [
    'Dice Throne: Vanguard (2026)', 'Outcasts (2025) - 4 Heroes',
    'Vanguard Heroes: Forgemaster, Duelist, Sun Elf, Druid', 'Vanguard Sun Elf Accessory Pack',
    'Duel: Bleiche Dame v Kopfloser Reiter', 'Duel: Rabenfürstin v Totenbeschwörer',
  ]],
  ['stonemaier', 'Stonemaier Games', '3931', 'recommended', ['buy'], ['Wyrmspan Expansions']],
  ['direwolf', 'Dire Wolf Digital', '2436', 'recommended', ['demo'], ['Clank! Catacombs']],
  ['goodman', 'Goodman Games', '2547/2551', 'recommended', ['promo'], ['DCC Booth Exclusives']],
  ['brotherming', 'Brother Ming Games', '4308', 'recommended', [], ['Check for a booth demo']],
  ['folded', 'Folded Space', '3623', 'recommended', ['buy'], ['Galactic Cruise Insert']],
  ['lockbox', 'Lockbox Adventures', '4014', 'recommended', [], ['Check new releases']],
  ['qworkshop', 'Q-Workshop', '3739', 'recommended', ['buy'], ['Dice Throne Compatible Sets']],
  ['rtalsorian', 'R. Talsorian Games', '3322', 'recommended', ['demo'], ['Witcher TTRPG New Supplements']],
  ['vesuvius', 'Vesuvius Media', '4001', 'recommended', [], ['Check the current lineup']],
];

export const shortlist = entries.map(([id, name, booth_number, priority, selected, games]) => ({
  id: `seed-${id}`, name, booth_number, priority,
  demo: selected.includes('demo'), buy: selected.includes('buy'), promo: selected.includes('promo'),
  games: games.map((title, index) => ({ id: `seed-${id}-${index + 1}`, title })),
}));
