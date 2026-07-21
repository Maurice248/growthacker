import fs from 'fs';
import path from 'path';

const root = path.resolve('src');

const map = new Map([
  ['#2563EB', '#003049'],
  ['#2563eb', '#003049'],
  ['#1D4ED8', '#1A4A66'],
  ['#1d4ed8', '#1A4A66'],
  ['#1E40AF', '#00263A'],
  ['#1e40af', '#00263A'],
  ['#1E3A8A', '#00263A'],
  ['#1e3a8a', '#00263A'],
  ['#3B82F6', '#669BBC'],
  ['#3b82f6', '#669BBC'],
  ['#60A5FA', '#669BBC'],
  ['#60a5fa', '#669BBC'],
  ['#93C5FD', '#669BBC'],
  ['#93c5fd', '#669BBC'],
  ['#BFDBFE', '#C2D6E2'],
  ['#bfdbfe', '#C2D6E2'],
  ['#DBEAFE', '#C2D6E2'],
  ['#dbeafe', '#C2D6E2'],
  ['#EFF6FF', '#E7F0F6'],
  ['#eff6ff', '#E7F0F6'],
  ['#DC2626', '#C1121F'],
  ['#dc2626', '#C1121F'],
  ['#EF4444', '#C1121F'],
  ['#ef4444', '#C1121F'],
  ['#B91C1C', '#780000'],
  ['#b91c1c', '#780000'],
  ['#991B1B', '#780000'],
  ['#991b1b', '#780000'],
  ['#FEF2F2', '#F9E3E0'],
  ['#fef2f2', '#F9E3E0'],
  ['#F8FAFC', '#FDF6E3'],
  ['#f8fafc', '#FDF6E3'],
  ['#F1F5F9', '#FDF0D5'],
  ['#f1f5f9', '#FDF0D5'],
  ['#E2E8F0', '#E8DCC2'],
  ['#e2e8f0', '#E8DCC2'],
  ['#CBD5E1', '#C2B79A'],
  ['#cbd5e1', '#C2B79A'],
  ['#0F172A', '#003049'],
  ['#0f172a', '#003049'],
  ['#1E293B', '#23394A'],
  ['#1e293b', '#23394A'],
  ['#334155', '#23394A'],
  ['#475569', '#4A5A64'],
  ['#64748B', '#8C8474'],
  ['#64748b', '#8C8474'],
  ['#94A3B8', '#9FA8A3'],
  ['#94a3b8', '#9FA8A3'],
  ['#0891B2', '#669BBC'],
  ['#0891b2', '#669BBC'],
  ['#0E7490', '#2C5A77'],
  ['#0e7490', '#2C5A77'],
  ['#ECFEFF', '#E7F0F6'],
  ['#ecfeff', '#E7F0F6'],
  ['#0284C7', '#003049'],
  ['#0284c7', '#003049'],
  ['#0369A1', '#1A4A66'],
  ['#0369a1', '#1A4A66'],
  ['#0D9488', '#669BBC'],
  ['#0d9488', '#669BBC'],
  ['#7C3AED', '#669BBC'],
  ['#7c3aed', '#669BBC'],
  ['#F5F3FF', '#E7F0F6'],
  ['#f5f3ff', '#E7F0F6'],
  ['#6D28D9', '#2C5A77'],
  ['#6d28d9', '#2C5A77'],
  ['#0077b6', '#003049'],
  ['#005f8f', '#1A4A66'],
  ['#1a1c2e', '#003049'],
  ['rgba(37,99,235', 'rgba(0,48,73'],
  ['rgba(37, 99, 235', 'rgba(0, 48, 73'],
]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, acc);
    } else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(root);
let updatedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of map) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    updatedCount += 1;
    console.log('updated:', path.relative(root, file));
  }
}

console.log(`Done. Updated ${updatedCount} files.`);
