/**
 * Script to extract all 5-letter Spanish words from an-array-of-spanish-words
 * and generate a JS file for the Wordle game.
 */
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const allWords = require('an-array-of-spanish-words');

// Normalize: remove accents for length check but keep original
function normalizeForLength(w) {
  return w.toLowerCase()
    .replace(/ñ/g, '\uFFFF')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uFFFF/g, 'ñ');
}

// Filter: exactly 5 letters, only a-z + ñ + accented vowels
const validPattern = /^[a-záéíóúüñ]{5}$/i;

const fiveLetterWords = allWords.filter(w => {
  const lower = w.toLowerCase();
  if (!validPattern.test(lower)) return false;
  // Double check normalized length is 5
  const norm = normalizeForLength(lower);
  return norm.length === 5;
});

// Deduplicate
const unique = [...new Set(fiveLetterWords.map(w => w.toLowerCase()))];

console.log(`Total 5-letter Spanish words found: ${unique.length}`);

// Generate JS file
const output = `/**
 * Auto-generated Spanish 5-letter word list
 * Source: an-array-of-spanish-words (npm)
 * Total words: ${unique.length}
 * Generated: ${new Date().toISOString()}
 */
const SPANISH_WORDS_5 = ${JSON.stringify(unique)};
`;

writeFileSync(join(__dirname, 'spanish_words.js'), output, 'utf-8');
console.log('Written to spanish_words.js');
