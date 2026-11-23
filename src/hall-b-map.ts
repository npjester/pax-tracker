// Approximate booth rectangles and aisle access points, traced from the 2026 PAX expo map.
export type MapPosition = {
  number: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aisle: number;
  access: 'top' | 'bottom';
};

type BoothRow = [number: string, name: string, x: number, y: number, width: number, height: number, aisle: number, access?: 'top'];
const rows: BoothRow[] = [
  ['1859', 'Baron of Dice', 136, 111, 48, 31, 96, 'top'],
  ['1857', 'Turbo Dork', 136, 151, 48, 31, 195],
  ['1957', 'Floodgate Games', 190, 111, 47, 71, 195],
  ['2057', 'Limithron', 270, 111, 47, 71, 195],
  ['2157', 'Mantic Games', 350, 111, 47, 71, 195],
  ['2257', 'Plaid Hat Games', 430, 111, 46, 71, 195],
  ['2359', 'Wolff Designa', 480, 111, 49, 31, 96, 'top'],
  ['2357', 'APE Games', 480, 151, 49, 31, 195],
  ['2556', 'Lethal Shadows', 562, 111, 100, 71, 195],
  ['2757', 'Elderwood Academy', 774, 111, 45, 71, 195],
  ['2857', 'Many Worlds Tavern', 822, 111, 46, 71, 195],
  ['2957', 'Rollacrit', 901, 111, 58, 71, 195],
  ['3057', 'Modiphius Entertainment', 963, 111, 58, 71, 195],
  ['1851', 'Red Raven Games', 136, 213, 48, 72, 300],
  ['1951', 'Calliope Games', 190, 213, 47, 72, 300],
  ['2051', 'Inside Up Games', 270, 213, 47, 72, 300],
  ['2153', 'Dispel', 347, 213, 50, 40, 195, 'top'],
  ['2151', 'Grand Gamers Guild', 347, 256, 50, 29, 300],
  ['2251', 'Archon Games', 430, 213, 46, 72, 300],
  ['2353', 'Creature Curation', 480, 213, 49, 33, 195, 'top'],
  ['2351', 'Fowers Games', 480, 250, 49, 35, 300],
  ['2451', 'Contention Games', 562, 213, 50, 72, 300],
  ['2551', 'GameHead', 615, 213, 47, 72, 300],
  ['2651', 'Dragon Shield', 695, 213, 47, 72, 300],
  ['2753', 'Off the Page Games', 774, 213, 45, 33, 195, 'top'],
  ['2751', 'Mighty Boards', 774, 250, 45, 35, 300],
  ['2853', 'R&R Games', 822, 213, 46, 33, 195, 'top'],
  ['2851', 'Mythworks', 822, 250, 46, 35, 300],
  ['2951', 'Studio 2 Publishing', 901, 213, 120, 72, 300],
  ['1843', 'Wyrmwood', 136, 315, 48, 112, 450],
  ['2043', 'Cephalofair Games', 270, 315, 47, 112, 450],
  ['2143', 'Goliath Games / Pressman Toy', 350, 315, 47, 112, 450],
  ['2243', 'Bandai', 430, 315, 99, 112, 450],
  ['2542', 'Foam Brain', 589, 315, 62, 112, 450],
  ['2643', 'Luma Imports', 695, 315, 47, 112, 450],
  ['2747', 'Snap Ships', 774, 315, 74, 40, 300, 'top'],
  ['2743', 'Mindclash Games', 774, 359, 74, 68, 450],
  ['2943', 'Chip Theory Games', 901, 315, 120, 112, 450],
  ['1833', 'Restoration Games', 136, 483, 101, 111, 610],
  ['2033', 'Ultra PRO', 270, 483, 76, 111, 610],
  ['2233', 'Chaotic Great Games', 350, 483, 47, 111, 610],
  ['2333', 'Dice Throne', 430, 483, 89, 111, 610],
  ['2433', 'Paverson Games', 535, 483, 23, 111, 610],
  ['2532', 'Runaway Parade Games', 560, 483, 23, 111, 610],
  ['1827', 'Capstone Games', 136, 625, 101, 72, 710],
  ['2027', 'Tycoon Games', 270, 625, 126, 72, 710],
  ['2326', 'Chaosium', 430, 625, 46, 72, 710],
  ['2426', 'Glass Cannon Unplugged', 480, 625, 23, 72, 710],
  ['2427', 'Blue Orange Games', 535, 625, 48, 72, 710],
  ['1821', 'Renegade Game Studios', 136, 727, 61, 70, 865],
  ['2019', 'Dire Wolf Digital', 270, 727, 126, 112, 865],
  ['2318', 'IV Studio', 430, 727, 72, 112, 865],
  ['2518', 'Roxley Games', 535, 801, 48, 38, 865],
];

export const mappedBooths: MapPosition[] = rows.map(([number, name, x, y, width, height, aisle, access]) => ({
  number, name, x, y, width, height, aisle, access: access ?? 'bottom',
}));

export const queueEntrance = { id: 'queue', name: 'Queue entrance near booth 1821', x: 130, y: 865 };
