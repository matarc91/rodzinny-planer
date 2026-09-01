/* global Buffer, process */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Tło squircle z gradientem Obsidian Dark -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#24242A"/>
      <stop offset="50%" stop-color="#151518"/>
      <stop offset="100%" stop-color="#0A0A0C"/>
    </linearGradient>

    <!-- Złoty obrys squircle -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.7"/>
      <stop offset="50%" stop-color="#D97706" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#B45309" stop-opacity="0.6"/>
    </linearGradient>

    <!-- Główny złoty gradient łuku dachu -->
    <linearGradient id="goldRoof" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A"/>
      <stop offset="35%" stop-color="#F59E0B"/>
      <stop offset="70%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#92400E"/>
    </linearGradient>

    <!-- Złoty gradient ścian i fundamentów -->
    <linearGradient id="goldRibbon" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>

    <!-- Gradient Iskry Centralnej -->
    <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="30%" stop-color="#FEF08A"/>
      <stop offset="70%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>

    <!-- Poświata wewnątrz domu -->
    <radialGradient id="centerGlow" cx="50%" cy="53%" r="42%">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.4"/>
      <stop offset="55%" stop-color="#F59E0B" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#151518" stop-opacity="0"/>
    </radialGradient>

    <!-- Cień -->
    <filter id="dropShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <!-- Tło: Zaokrąglony Squircle (Dark Obsidian) -->
  <rect x="18" y="18" width="476" height="476" rx="116" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="5"/>

  <!-- Subtelna poświata centralna -->
  <circle cx="256" cy="270" r="150" fill="url(#centerGlow)"/>

  <!-- Elementy główne z miękkim cieniem -->
  <g filter="url(#dropShadow)">
    <!-- 1. Dach / Ochronny łuk domu (Sleek Geometric Canopy) -->
    <path d="M 120 236 L 256 128 L 392 236 C 398 241 398 250 392 255 L 378 266 C 373 270 364 269 359 265 L 256 182 L 153 265 C 148 269 139 270 134 266 L 120 255 C 114 250 114 241 120 236 Z" 
          fill="url(#goldRoof)"/>

    <!-- 2. Podstawa / Ściany domu z zaokrąglonymi narożnikami -->
    <path d="M 160 252 L 160 352 C 160 376 180 396 204 396 L 308 396 C 332 396 352 376 352 352 L 352 252 L 322 276 L 322 350 C 322 358 316 364 308 364 L 204 364 C 196 364 190 358 190 350 L 190 276 Z" 
          fill="url(#goldRibbon)"/>

    <!-- 3. Iskra Rodziny (Family 4-Point Star & Sparkle) w centrum domu -->
    <path d="M 256 215 C 256 252 269 270 298 274 C 269 278 256 296 256 333 C 256 296 243 278 214 274 C 243 270 256 252 256 215 Z" 
          fill="url(#sparkleGrad)"/>

    <!-- Druga, mniejsza gwiazdka akcentowa -->
    <path d="M 315 198 C 315 212 320 219 331 221 C 320 223 315 230 315 244 C 315 230 310 223 299 221 C 310 219 315 212 315 198 Z" 
          fill="#FEF08A"/>

    <!-- 4. Kropki domowników (Harmonia i jedność) -->
    <circle cx="218" cy="340" r="7.5" fill="#FDE68A" opacity="0.95"/>
    <circle cx="256" cy="340" r="9" fill="#F59E0B"/>
    <circle cx="294" cy="340" r="7.5" fill="#FDE68A" opacity="0.95"/>
  </g>
</svg>
`;

// Monochromatyczna wersja badge'a do powiadomień systemowych
const SVG_BADGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <path d="M 20 44 L 48 22 L 76 44 L 70 49 L 48 31 L 26 49 Z" fill="#FFFFFF"/>
  <path d="M 28 47 L 28 72 C 28 76 32 80 36 80 L 60 80 C 64 80 68 76 68 72 L 68 47 L 62 52 L 62 72 C 62 74 60 76 58 76 L 38 76 C 36 76 34 74 34 72 L 34 52 Z" fill="#FFFFFF"/>
  <path d="M 48 40 C 48 49 51 53 58 54 C 51 55 48 59 48 68 C 48 59 45 55 38 54 C 45 53 48 49 48 40 Z" fill="#FFFFFF"/>
</svg>`;

async function run() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Zapis wektorowych SVG
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), SVG_LOGO.trim(), 'utf8');
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), SVG_LOGO.trim(), 'utf8');
  console.log('✓ Zapisano public/favicon.svg oraz public/logo.svg');

  // 2. Generowanie PNG o różnych rozmiarach
  const svgBuffer = Buffer.from(SVG_LOGO);

  // 512x512 PWA Icon / Splash Screen
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ Wygenerowano public/icon-512.png (512x512)');

  // 512x512 Logo PNG
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'logo.png'));
  console.log('✓ Wygenerowano public/logo.png (512x512)');

  // 192x192 PWA Icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ Wygenerowano public/icon-192.png (192x192)');

  // 72x72 Notification Badge
  const badgeBuffer = Buffer.from(SVG_BADGE);
  await sharp(badgeBuffer)
    .resize(72, 72)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'badge-72.png'));
  console.log('✓ Wygenerowano public/badge-72.png (72x72)');

  // 96x96 Notification Badge
  await sharp(badgeBuffer)
    .resize(96, 96)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'badge.png'));
  console.log('✓ Wygenerowano public/badge.png (96x96)');
}

run().catch((err) => {
  console.error('Błąd generowania ikon:', err);
  process.exit(1);
});
