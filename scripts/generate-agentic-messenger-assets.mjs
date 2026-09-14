import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = path.join(root, 'packages', 'happy-app', 'branding', 'agentic-messenger');
const outputDir = path.join(brandDir, 'generated');

await mkdir(outputDir, { recursive: true });

const mark = await readFile(path.join(brandDir, 'agentic-messenger-mark.svg'));
const foreground = await readFile(path.join(brandDir, 'agentic-messenger-foreground.svg'));
const monochrome = await readFile(path.join(brandDir, 'agentic-messenger-monochrome.svg'));
const wordmark = await readFile(path.join(brandDir, 'agentic-messenger-wordmark.svg'));

const png = async (source, filename, width, options = {}) => {
  let pipeline = sharp(source, { density: 384 }).resize(width, width, { fit: 'contain' });
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
  png(monochrome, 'android-monochrome-432.png', 432),
  png(monochrome, 'android-notification-96.png', 96),
]);

await sharp(wordmark, { density: 384 })
  .resize({ width: 2200 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outputDir, 'wordmark-2200.png'));

console.log(`Generated AgenticMessenger assets in ${outputDir}`);
