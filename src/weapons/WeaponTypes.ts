export interface WeaponConfig {
  name: string;
  damage: number;
  fireRate: number;
  magazineSize: number;
  reloadTime: number;
  range: number;
  spread: number;
  automatic: boolean;
}

export interface WeaponState {
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  canFire: boolean;
  lastFireTime: number;
}

export const WEAPONS: Record<string, WeaponConfig> = {
  PISTOL: {
    name: 'Pistol',
    damage: 25,
    fireRate: 4,
    magazineSize: 12,
    reloadTime: 1.5,
    range: 100,
    spread: 1,
    automatic: false,
  },
  RIFLE: {
    name: 'Assault Rifle',
    damage: 20,
    fireRate: 10,
    magazineSize: 30,
    reloadTime: 2.5,
    range: 150,
    spread: 2,
    automatic: true,
  },
  SHOTGUN: {
    name: 'Shotgun',
    damage: 15,
    fireRate: 1,
    magazineSize: 8,
    reloadTime: 2,
    range: 30,
    spread: 10,
    automatic: false,
  },
};
