import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = path.join(root, 'packages', 'happy-app', 'branding', 'agentic-messenger');
const outputDir = path.join(brandDir, 'generated');

await mkdir(outputDir, { recursive: true });

const paddedSquare = async (source, size, scale) => {
  const insetSize = Math.round(size * scale);
  const inset = await sharp(source, { density: 384 })
    .resize(insetSize, insetSize, { fit: 'contain' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: inset, gravity: 'center' }])
    .png()
    .toBuffer();
};

const mark = await readFile(path.join(brandDir, 'agentic-messenger-icon.png'));
const monochrome = await readFile(path.join(brandDir, 'agentic-messenger-monochrome.svg'));
// Android zooms adaptive foregrounds beyond the final launcher mask. Keeping the
// artwork inside this inset gives the blue mark Messenger-like white breathing room.
const foreground = await paddedSquare(mark, 1024, 0.72);
const monochromeForeground = await paddedSquare(monochrome, 1024, 0.72);

const png = async (source, filename, width, options = {}) => {
  const height = options.height ?? width;
  let pipeline = sharp(source, { density: 384 }).resize(width, height, { fit: 'contain' });
  if (options.background) pipeline = pipeline.flatten({ background: options.background });
  await pipeline.png({ compressionLevel: 9 }).toFile(path.join(outputDir, filename));
};

await Promise.all([
  png(mark, 'app-icon-1024.png', 1024),
  png(mark, 'web-icon-512.png', 512),
  png(mark, 'web-icon-192.png', 192),
  png(mark, 'chat-head-256.png', 256),
  png(mark, 'favicon-48.png', 48),
  png(mark, 'favicon-32.png', 32),
  png(foreground, 'android-adaptive-foreground-1024.png', 1024),
  png(monochromeForeground, 'android-monochrome-1024.png', 1024),
  png(monochrome, 'android-notification-512.png', 512),
]);

const makeWordmark = (textColor) => Buffer.from(`
  <svg width="2500" height="520" xmlns="http://www.w3.org/2000/svg">
    <image href="data:image/png;base64,${mark.toString('base64')}" x="18" y="40" width="440" height="440"/>
    <text x="485" y="322" fill="${textColor}" font-family="Arial, Helvetica, sans-serif" font-size="165" font-weight="700" letter-spacing="0">Agentic Messenger</text>
  </svg>
`);

const darkWordmark = makeWordmark('#102A52');
const lightWordmark = makeWordmark('#FFFFFF');

await Promise.all([
  png(darkWordmark, 'wordmark-dark.png', 1965, { height: 523 }),
  png(darkWordmark, 'wordmark-dark@2x.png', 3930, { height: 1046 }),
  png(darkWordmark, 'wordmark-dark@3x.png', 5895, { height: 1569 }),
  png(lightWordmark, 'wordmark-light.png', 1965, { height: 523 }),
  png(lightWordmark, 'wordmark-light@2x.png', 3930, { height: 1046 }),
  png(lightWordmark, 'wordmark-light@3x.png', 5895, { height: 1569 }),
]);

const badge = Buffer.from(`
  <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <circle cx="835" cy="185" r="145" fill="#F02849" stroke="#FFFFFF" stroke-width="36"/>
  </svg>
`);
await sharp(mark, { density: 384 })
  .resize(1024, 1024)
  .composite([{ input: badge }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(outputDir, 'favicon-active-1024.png'));

const imageDir = path.join(root, 'packages', 'happy-app', 'sources', 'assets', 'images');
const publicDir = path.join(root, 'packages', 'happy-app', 'public');
const androidResDir = path.join(root, 'packages', 'happy-app', 'android', 'app', 'src', 'main', 'res');
const generated = (name) => path.join(outputDir, name);

await Promise.all([
  copyFile(generated('app-icon-1024.png'), path.join(imageDir, 'icon.png')),
  copyFile(generated('android-adaptive-foreground-1024.png'), path.join(imageDir, 'icon-adaptive.png')),
  copyFile(generated('android-monochrome-1024.png'), path.join(imageDir, 'icon-monochrome.png')),
  copyFile(generated('android-notification-512.png'), path.join(imageDir, 'icon-notification.png')),
  copyFile(generated('app-icon-1024.png'), path.join(imageDir, 'favicon.png')),
  copyFile(generated('favicon-active-1024.png'), path.join(imageDir, 'favicon-active.png')),
  copyFile(generated('app-icon-1024.png'), path.join(imageDir, 'logo-black.png')),
  copyFile(generated('app-icon-1024.png'), path.join(imageDir, 'logo-white.png')),
  copyFile(generated('wordmark-dark.png'), path.join(imageDir, 'logotype.png')),
  copyFile(generated('wordmark-dark.png'), path.join(imageDir, 'logotype-dark.png')),
  copyFile(generated('wordmark-dark@2x.png'), path.join(imageDir, 'logotype-dark@2x.png')),
  copyFile(generated('wordmark-dark@3x.png'), path.join(imageDir, 'logotype-dark@3x.png')),
  copyFile(generated('wordmark-dark@2x.png'), path.join(imageDir, 'logotype@2x.png')),
  copyFile(generated('wordmark-dark@3x.png'), path.join(imageDir, 'logotype@3x.png')),
  copyFile(generated('wordmark-light.png'), path.join(imageDir, 'logotype-light.png')),
  copyFile(generated('wordmark-light@2x.png'), path.join(imageDir, 'logotype-light@2x.png')),
  copyFile(generated('wordmark-light@3x.png'), path.join(imageDir, 'logotype-light@3x.png')),
  copyFile(generated('app-icon-1024.png'), path.join(imageDir, 'splash-android-light.png')),
  copyFile(generated('app-icon-1024.png'), path.join(imageDir, 'splash-android-dark.png')),
  copyFile(generated('app-icon-1024.png'), path.join(publicDir, 'favicon.png')),
  copyFile(generated('favicon-active-1024.png'), path.join(publicDir, 'favicon-active.png')),
]);

const densities = {
  mdpi: { launcher: 48, foreground: 108, notification: 24, splash: 288 },
  hdpi: { launcher: 72, foreground: 162, notification: 36, splash: 432 },
  xhdpi: { launcher: 96, foreground: 216, notification: 48, splash: 576 },
  xxhdpi: { launcher: 144, foreground: 324, notification: 72, splash: 864 },
  xxxhdpi: { launcher: 192, foreground: 432, notification: 96, splash: 1152 },
};

for (const [density, sizes] of Object.entries(densities)) {
  const mipmap = path.join(androidResDir, `mipmap-${density}`);
  const drawable = path.join(androidResDir, `drawable-${density}`);
  const drawableNight = path.join(androidResDir, `drawable-night-${density}`);

  await Promise.all([
    sharp(mark, { density: 384 }).resize(sizes.launcher, sizes.launcher).webp({ lossless: true }).toFile(path.join(mipmap, 'ic_launcher.webp')),
    sharp(mark, { density: 384 }).resize(sizes.launcher, sizes.launcher).webp({ lossless: true }).toFile(path.join(mipmap, 'ic_launcher_round.webp')),
    sharp(foreground, { density: 384 }).resize(sizes.foreground, sizes.foreground).webp({ lossless: true }).toFile(path.join(mipmap, 'ic_launcher_foreground.webp')),
    sharp(monochromeForeground, { density: 384 }).resize(sizes.foreground, sizes.foreground).webp({ lossless: true }).toFile(path.join(mipmap, 'ic_launcher_monochrome.webp')),
    sharp(monochrome, { density: 384 }).resize(sizes.notification, sizes.notification).png({ compressionLevel: 9 }).toFile(path.join(drawable, 'notification_icon.png')),
    sharp(mark, { density: 384 }).resize(sizes.splash, sizes.splash).png({ compressionLevel: 9 }).toFile(path.join(drawable, 'splashscreen_logo.png')),
    sharp(mark, { density: 384 }).resize(sizes.splash, sizes.splash).png({ compressionLevel: 9 }).toFile(path.join(drawableNight, 'splashscreen_logo.png')),
  ]);
}

console.log(`Generated and applied Agentic Messenger assets from ${outputDir}`);
