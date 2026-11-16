export interface Palette {
  suit: number
  trim: number
  glow: number
  visor: number
}

export type Style = 'Futuristic' | 'Sporty' | 'Streetwear' | 'Casual' | 'Adventure' | 'Fun'
export type Mood = 'cheerful' | 'cool' | 'shy' | 'bold' | 'goofy' | 'calm'
export type HairStyle =
  | 'none' | 'buzz' | 'quiff' | 'slick' | 'spikes' | 'afro' | 'curly' | 'mohawk'
  | 'bun' | 'twinbuns' | 'ponytail' | 'bob' | 'pigtails' | 'long'
export type Accessory =
  | 'none' | 'headphones' | 'headband' | 'shades' | 'glasses' | 'goggles' | 'cap' | 'capback'
  | 'beanie' | 'bandana' | 'antennae' | 'halo' | 'bow' | 'catears' | 'flower' | 'visor'
export type Outfit = 'jacket' | 'hoodie' | 'armor' | 'jersey' | 'techsuit' | 'puffer' | 'overalls' | 'dress' | 'vest'
export type PackStyle = 'core' | 'wings' | 'tank' | 'bag' | 'none'

/**
 * Characters are cosmetic only: every runner shares the same speed, hitbox and abilities.
 * Everything here changes how the model looks and how its face behaves, never how it plays.
 */
export interface Character {
  id: string
  name: string
  gender: 'female' | 'male'
  style: Style
  mood: Mood
  tagline: string
  /** outfit colours (colorways may override these) */
  palette: Palette
  /** character-only colouring */
  skin: number
  hair: number
  eye: number
  /** accessory / secondary outfit colour */
  accent: number
  /** proportions */
  chest: number
  hip: number
  height: number
  headW: number
  headH: number
  eyeScale: number
  hairStyle: HairStyle
  accessory: Accessory
  outfit: Outfit
  pack: PackStyle
  scarf: boolean
  sleeves: 'long' | 'short' | 'none'
  legs: 'pants' | 'shorts'
  /** 0 none, 1 mini skirt, 2 long skirt */
  skirt: 0 | 1 | 2
}

const P = (suit: number, trim: number, glow: number, visor = 0xffffff): Palette => ({ suit, trim, glow, visor })

export const CHARACTERS: Character[] = [
  // ------------------------------------------------------------ futuristic
  {
    id: 'kai', name: 'Kai', gender: 'male', style: 'Futuristic', mood: 'cheerful', tagline: 'Swept quiff, steady stride.',
    palette: P(0x2f6bff, 0xffd23d, 0x35f2ff), skin: 0xf2c29b, hair: 0x1d2a6b, eye: 0x2fb6ff, accent: 0xffd23d,
    chest: 1.0, hip: 1.0, height: 1.0, headW: 1.0, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'quiff', accessory: 'none', outfit: 'jacket', pack: 'core', scarf: true, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'nova', name: 'Nova', gender: 'female', style: 'Futuristic', mood: 'cheerful', tagline: 'Long ponytail, light on her feet.',
    palette: P(0xff5fb0, 0x7af0ff, 0xff9be8), skin: 0xffd2b8, hair: 0x7a3dff, eye: 0xb44fff, accent: 0x7af0ff,
    chest: 0.82, hip: 1.08, height: 0.98, headW: 1.0, headH: 1.0, eyeScale: 1.05,
    hairStyle: 'ponytail', accessory: 'none', outfit: 'jacket', pack: 'core', scarf: false, sleeves: 'long', legs: 'pants', skirt: 1,
  },
  {
    id: 'ravi', name: 'Ravi', gender: 'male', style: 'Futuristic', mood: 'calm', tagline: 'Headphones on, nerves off.',
    palette: P(0x1fbf6a, 0xffe14a, 0x3dff8a, 0xf4fff8), skin: 0x8d5a3b, hair: 0x1c1c26, eye: 0x2a8a4a, accent: 0x2b2f4a,
    chest: 1.15, hip: 1.05, height: 1.03, headW: 1.0, headH: 1.0, eyeScale: 0.95,
    hairStyle: 'curly', accessory: 'headphones', outfit: 'techsuit', pack: 'tank', scarf: false, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'cleo', name: 'Cleo', gender: 'female', style: 'Futuristic', mood: 'cool', tagline: 'Silver slick and a cyber visor.',
    palette: P(0x23324f, 0x35f2ff, 0x35f2ff, 0xd7f6ff), skin: 0xe9b999, hair: 0xdfe9ff, eye: 0x35f2ff, accent: 0x35f2ff,
    chest: 0.88, hip: 1.02, height: 1.08, headW: 0.95, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'slick', accessory: 'visor', outfit: 'techsuit', pack: 'wings', scarf: false, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  // ------------------------------------------------------------ sporty
  {
    id: 'leo', name: 'Leo', gender: 'male', style: 'Sporty', mood: 'bold', tagline: 'Sweatband, sprinter shorts.',
    palette: P(0xe83a3a, 0xffffff, 0xffe14a, 0xffffff), skin: 0x5a3a28, hair: 0x14141c, eye: 0x3a2a1a, accent: 0xffffff,
    chest: 1.12, hip: 1.0, height: 1.04, headW: 1.0, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'buzz', accessory: 'headband', outfit: 'jersey', pack: 'none', scarf: false, sleeves: 'none', legs: 'shorts', skirt: 0,
  },
  {
    id: 'sky', name: 'Sky', gender: 'female', style: 'Sporty', mood: 'bold', tagline: 'High bun, higher jumps.',
    palette: P(0x19c9c0, 0xffffff, 0xfff27a, 0xffffff), skin: 0xf6d3b0, hair: 0x2b6cff, eye: 0x2fb6ff, accent: 0xff5f8a,
    chest: 0.84, hip: 1.04, height: 1.05, headW: 1.0, headH: 1.0, eyeScale: 1.05,
    hairStyle: 'bun', accessory: 'headband', outfit: 'jersey', pack: 'none', scarf: false, sleeves: 'none', legs: 'shorts', skirt: 0,
  },
  {
    id: 'dash', name: 'Dash', gender: 'male', style: 'Sporty', mood: 'goofy', tagline: 'Cap on backwards, always grinning.',
    palette: P(0xffb21f, 0x2b3a67, 0xffffff, 0xffffff), skin: 0xd99a72, hair: 0x4a2c1a, eye: 0x7a4a1a, accent: 0x2b6cff,
    chest: 1.02, hip: 1.0, height: 0.95, headW: 1.08, headH: 1.0, eyeScale: 1.1,
    hairStyle: 'buzz', accessory: 'capback', outfit: 'jersey', pack: 'none', scarf: false, sleeves: 'short', legs: 'shorts', skirt: 0,
  },
  // ------------------------------------------------------------ streetwear
  {
    id: 'zane', name: 'Zane', gender: 'male', style: 'Streetwear', mood: 'cool', tagline: 'Teal pomp, shades, hoodie.',
    palette: P(0xff7a2e, 0xffffff, 0x14d6c1), skin: 0xc98a5f, hair: 0x14d6c1, eye: 0x2a2f3a, accent: 0x242a3a,
    chest: 1.06, hip: 1.0, height: 1.02, headW: 1.0, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'slick', accessory: 'shades', outfit: 'hoodie', pack: 'bag', scarf: false, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'jax', name: 'Jax', gender: 'male', style: 'Streetwear', mood: 'cool', tagline: 'Mohawk, goggles, puffer vest.',
    palette: P(0x6a3dff, 0xffd23d, 0xff3df0), skin: 0xf0be94, hair: 0x35f2ff, eye: 0xff3df0, accent: 0xffd23d,
    chest: 1.08, hip: 1.0, height: 1.0, headW: 1.0, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'mohawk', accessory: 'goggles', outfit: 'puffer', pack: 'core', scarf: false, sleeves: 'none', legs: 'pants', skirt: 0,
  },
  {
    id: 'juno', name: 'Juno', gender: 'female', style: 'Streetwear', mood: 'cool', tagline: 'Cyan pigtails and pink shades.',
    palette: P(0x9a5cff, 0xff7ad9, 0xc49bff), skin: 0x6b4128, hair: 0x35e0f2, eye: 0xff7ad9, accent: 0xff5fb0,
    chest: 0.86, hip: 1.04, height: 1.0, headW: 1.0, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'pigtails', accessory: 'shades', outfit: 'jacket', pack: 'core', scarf: true, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'zoe', name: 'Zoe', gender: 'female', style: 'Streetwear', mood: 'cheerful', tagline: 'Big puff, bigger sound.',
    palette: P(0xff4d8d, 0xfff27a, 0xfff27a), skin: 0x7a4a30, hair: 0x2a1650, eye: 0xff4d8d, accent: 0x35f2ff,
    chest: 0.9, hip: 1.06, height: 1.0, headW: 1.0, headH: 1.0, eyeScale: 1.1,
    hairStyle: 'afro', accessory: 'headphones', outfit: 'hoodie', pack: 'none', scarf: false, sleeves: 'short', legs: 'pants', skirt: 0,
  },
  // ------------------------------------------------------------ casual
  {
    id: 'theo', name: 'Theo', gender: 'male', style: 'Casual', mood: 'shy', tagline: 'Round specs and a man bun.',
    palette: P(0x5a8fd6, 0xf2f2f2, 0xa7d3ff), skin: 0xf2c29b, hair: 0x6a3d22, eye: 0x4a3a2a, accent: 0x2a2a38,
    chest: 0.94, hip: 0.98, height: 1.0, headW: 1.0, headH: 1.0, eyeScale: 1.1,
    hairStyle: 'bun', accessory: 'glasses', outfit: 'hoodie', pack: 'bag', scarf: false, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'rae', name: 'Rae', gender: 'female', style: 'Casual', mood: 'shy', tagline: 'Denim overalls, soft smile.',
    palette: P(0x3f7ac2, 0xffd23d, 0xffd23d, 0xffffff), skin: 0xffd9bf, hair: 0x6a3d22, eye: 0x5a8a4a, accent: 0xfff2d0,
    chest: 0.84, hip: 1.04, height: 0.95, headW: 1.1, headH: 1.04, eyeScale: 1.15,
    hairStyle: 'bob', accessory: 'glasses', outfit: 'overalls', pack: 'none', scarf: false, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'milo', name: 'Milo', gender: 'male', style: 'Casual', mood: 'goofy', tagline: 'Huge magenta afro, overalls.',
    palette: P(0xffd23d, 0xff5fb0, 0xff5fb0), skin: 0xe3ad82, hair: 0xff3db8, eye: 0x2a2f3a, accent: 0x3f7ac2,
    chest: 1.0, hip: 1.0, height: 0.93, headW: 1.1, headH: 1.0, eyeScale: 1.2,
    hairStyle: 'afro', accessory: 'glasses', outfit: 'overalls', pack: 'none', scarf: false, sleeves: 'short', legs: 'pants', skirt: 0,
  },
  {
    id: 'tess', name: 'Tess', gender: 'female', style: 'Casual', mood: 'cheerful', tagline: 'Cozy beanie, copper waves.',
    palette: P(0xe8744a, 0xfff2d0, 0xffd27a), skin: 0xf3c7a3, hair: 0xd9602b, eye: 0x4a8a5a, accent: 0x3f7ac2,
    chest: 0.86, hip: 1.04, height: 1.0, headW: 1.02, headH: 1.0, eyeScale: 1.05,
    hairStyle: 'long', accessory: 'beanie', outfit: 'hoodie', pack: 'bag', scarf: false, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  // ------------------------------------------------------------ adventure
  {
    id: 'atlas', name: 'Atlas', gender: 'male', style: 'Adventure', mood: 'bold', tagline: 'Spiked hair, golden armor.',
    palette: P(0xf2b630, 0x2b3a67, 0xffd54a, 0xfffbe6), skin: 0xe0a878, hair: 0xd9482b, eye: 0x2a2f3a, accent: 0xe03a3a,
    chest: 1.25, hip: 1.1, height: 1.1, headW: 1.0, headH: 1.0, eyeScale: 0.95,
    hairStyle: 'spikes', accessory: 'headband', outfit: 'armor', pack: 'tank', scarf: false, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'finn', name: 'Finn', gender: 'male', style: 'Adventure', mood: 'cheerful', tagline: 'Beanie, vest and a map in the bag.',
    palette: P(0x2f9d6a, 0xffe14a, 0xffe14a), skin: 0xf6d3b0, hair: 0x7a4a1a, eye: 0x2fb6ff, accent: 0xff7a2e,
    chest: 1.04, hip: 1.0, height: 1.06, headW: 1.0, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'buzz', accessory: 'beanie', outfit: 'vest', pack: 'bag', scarf: true, sleeves: 'long', legs: 'pants', skirt: 0,
  },
  {
    id: 'ivy', name: 'Ivy', gender: 'female', style: 'Adventure', mood: 'cheerful', tagline: 'Long green hair, wildflower.',
    palette: P(0x8a5a2e, 0x7be86a, 0xb6ff7a, 0xfff2d0), skin: 0xe9b999, hair: 0x2fbf6a, eye: 0x7a4a1a, accent: 0xff7ad9,
    chest: 0.86, hip: 1.04, height: 1.02, headW: 1.0, headH: 1.0, eyeScale: 1.05,
    hairStyle: 'long', accessory: 'flower', outfit: 'vest', pack: 'bag', scarf: true, sleeves: 'short', legs: 'shorts', skirt: 0,
  },
  {
    id: 'mira', name: 'Mira', gender: 'female', style: 'Adventure', mood: 'calm', tagline: 'Glowing halo, wing blades.',
    palette: P(0xff9a2e, 0xfff1a8, 0xffd54a), skin: 0xc98a5f, hair: 0xff4d6d, eye: 0x7a4a1a, accent: 0xffd54a,
    chest: 0.8, hip: 1.1, height: 1.0, headW: 1.0, headH: 1.0, eyeScale: 1.0,
    hairStyle: 'bob', accessory: 'halo', outfit: 'jacket', pack: 'wings', scarf: false, sleeves: 'long', legs: 'pants', skirt: 1,
  },
  // ------------------------------------------------------------ fun
  {
    id: 'luna', name: 'Luna', gender: 'female', style: 'Fun', mood: 'cheerful', tagline: 'Twin buns and a twirly dress.',
    palette: P(0x8fb8ff, 0xffffff, 0xd9c4ff), skin: 0xffe0cc, hair: 0xe0d0ff, eye: 0x9a5cff, accent: 0xff9be8,
    chest: 0.8, hip: 1.1, height: 0.97, headW: 1.04, headH: 1.0, eyeScale: 1.15,
    hairStyle: 'twinbuns', accessory: 'bow', outfit: 'dress', pack: 'wings', scarf: false, sleeves: 'short', legs: 'pants', skirt: 2,
  },
  {
    id: 'pip', name: 'Pip', gender: 'female', style: 'Fun', mood: 'goofy', tagline: 'Pocket-sized, cat ears, cotton-candy curls.',
    palette: P(0x4fe0b0, 0xff8fd0, 0xfff27a), skin: 0xf9d3b4, hair: 0xff9bd8, eye: 0x4d7dff, accent: 0xff9bd8,
    chest: 0.82, hip: 1.0, height: 0.89, headW: 1.16, headH: 1.1, eyeScale: 1.25,
    hairStyle: 'curly', accessory: 'catears', outfit: 'overalls', pack: 'none', scarf: false, sleeves: 'none', legs: 'shorts', skirt: 0,
  },
  {
    id: 'bolt', name: 'Bolt', gender: 'male', style: 'Fun', mood: 'goofy', tagline: 'Spiky tower hair, full of beans.',
    palette: P(0x35c8ff, 0xffe14a, 0xffe14a), skin: 0xf0be94, hair: 0xfff27a, eye: 0x3a2a1a, accent: 0xff4d4d,
    chest: 1.06, hip: 1.0, height: 0.98, headW: 1.08, headH: 1.12, eyeScale: 1.2,
    hairStyle: 'spikes', accessory: 'none', outfit: 'puffer', pack: 'core', scarf: false, sleeves: 'short', legs: 'shorts', skirt: 0,
  },
]

export const characterById = (id: string): Character => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]

/** The "Signature" colorway uses the character's own palette; other colorways override the outfit colours. */
export function lookFor(character: Character, skin: { id: string } & Palette): Palette {
  return skin.id === 'pulse' ? character.palette : { suit: skin.suit, trim: skin.trim, glow: skin.glow, visor: skin.visor }
}
