export const TILE = 16
export const COLS = 32
export const ROWS = 20
export const VIEW_W = COLS * TILE  
export const VIEW_H = ROWS * TILE   
export const HUD_H = 32             

export const PHYSICS = {
  walkSpeed: 1.5,
  swampSpeed: 0.6,       
  jumpVelocity: -4.6,    
  gravity: 0.2,
  maxFall: 4,
  climbSpeed: 1.25,
  fatalFallTiles: 8,     
  crumbleTime: 30,       
}

export const HERO_BOX = { w: 10, h: 30 }
export const SKELETON_BOX = { w: 10, h: 30 }
export const SKELETON_SPEED = 0.6
