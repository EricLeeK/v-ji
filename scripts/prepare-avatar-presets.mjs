import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "output/avatar-presets");
const destination = path.join(root, "public/avatars/v1");
const direction = JSON.parse(await readFile(path.join(source, "art-direction.json"), "utf8"));
await mkdir(destination, { recursive: true });

const assets = [];
for (const avatar of direction.avatars) {
  const originalPath = path.join(source, "originals", `${avatar.id}.png`);
  const original = await readFile(originalPath);
  const metadata = await sharp(original).metadata();
  if (metadata.width !== metadata.height) throw new Error(`${avatar.id}: expected a square original`);
  // Performance derivatives only: preserve the complete artwork and all originals.
  const webp = await sharp(original).resize(256, 256).webp({ quality: 82, effort: 6 }).toBuffer();
  const filename = `${avatar.id}.webp`;
  const outputPath = path.join(destination, filename);
  const existing = await readFile(outputPath).catch(error => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (existing && !existing.equals(webp)) throw new Error(`${filename}: immutable URL already exists; use a new version directory`);
  if (!existing) await writeFile(outputPath, webp, { flag: "wx" });
  assets.push({
    id: avatar.id,
    label: avatar.label,
    name: avatar.name,
    category: avatar.category,
    corner: avatar.corner,
    originalPath: path.relative(root, originalPath),
    originalDimensions: [metadata.width, metadata.height],
    originalBytes: original.length,
    originalSha256: createHash("sha256").update(original).digest("hex"),
    src: `/avatars/v1/${filename}`,
    dimensions: [256, 256],
    bytes: (await stat(outputPath)).size,
  });
}
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
await writeFile(path.join(source, "assets.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), provider: direction.provider, constraintMode: direction.constraintMode, count: assets.length, totalBytes, assets }, null, 2)}\n`);
console.log(JSON.stringify({ count: assets.length, totalBytes, totalKiB: +(totalBytes / 1024).toFixed(1), largestKiB: +(Math.max(...assets.map(asset => asset.bytes)) / 1024).toFixed(1) }));
