// Písma webu (Manrope, Newsreader, IBM Plex Mono) – servírované z vlastného servera, bez Google Fonts.
// Súbor generuje build/upravy_webu.py zo súborov v priečinku fonts/.
import css from './fonts/fonts.css';
import f0 from './fonts/ibm-plex-mono-cyrillic-500-normal.woff2';
import f1 from './fonts/ibm-plex-mono-latin-500-normal.woff2';
import f2 from './fonts/ibm-plex-mono-latin-ext-500-normal.woff2';
import f3 from './fonts/manrope-cyrillic-500-normal.woff2';
import f4 from './fonts/manrope-cyrillic-600-normal.woff2';
import f5 from './fonts/manrope-cyrillic-700-normal.woff2';
import f6 from './fonts/manrope-cyrillic-800-normal.woff2';
import f7 from './fonts/manrope-latin-500-normal.woff2';
import f8 from './fonts/manrope-latin-600-normal.woff2';
import f9 from './fonts/manrope-latin-700-normal.woff2';
import f10 from './fonts/manrope-latin-800-normal.woff2';
import f11 from './fonts/manrope-latin-ext-500-normal.woff2';
import f12 from './fonts/manrope-latin-ext-600-normal.woff2';
import f13 from './fonts/manrope-latin-ext-700-normal.woff2';
import f14 from './fonts/manrope-latin-ext-800-normal.woff2';
import f15 from './fonts/newsreader-latin-400-italic.woff2';
import f16 from './fonts/newsreader-latin-500-italic.woff2';
import f17 from './fonts/newsreader-latin-ext-400-italic.woff2';
import f18 from './fonts/newsreader-latin-ext-500-italic.woff2';
export const PISMA = {
  '/fonts/fonts.css': [css, 'text/css; charset=utf-8'],
  '/fonts/ibm-plex-mono-cyrillic-500-normal.woff2': [f0, 'font/woff2'],
  '/fonts/ibm-plex-mono-latin-500-normal.woff2': [f1, 'font/woff2'],
  '/fonts/ibm-plex-mono-latin-ext-500-normal.woff2': [f2, 'font/woff2'],
  '/fonts/manrope-cyrillic-500-normal.woff2': [f3, 'font/woff2'],
  '/fonts/manrope-cyrillic-600-normal.woff2': [f4, 'font/woff2'],
  '/fonts/manrope-cyrillic-700-normal.woff2': [f5, 'font/woff2'],
  '/fonts/manrope-cyrillic-800-normal.woff2': [f6, 'font/woff2'],
  '/fonts/manrope-latin-500-normal.woff2': [f7, 'font/woff2'],
  '/fonts/manrope-latin-600-normal.woff2': [f8, 'font/woff2'],
  '/fonts/manrope-latin-700-normal.woff2': [f9, 'font/woff2'],
  '/fonts/manrope-latin-800-normal.woff2': [f10, 'font/woff2'],
  '/fonts/manrope-latin-ext-500-normal.woff2': [f11, 'font/woff2'],
  '/fonts/manrope-latin-ext-600-normal.woff2': [f12, 'font/woff2'],
  '/fonts/manrope-latin-ext-700-normal.woff2': [f13, 'font/woff2'],
  '/fonts/manrope-latin-ext-800-normal.woff2': [f14, 'font/woff2'],
  '/fonts/newsreader-latin-400-italic.woff2': [f15, 'font/woff2'],
  '/fonts/newsreader-latin-500-italic.woff2': [f16, 'font/woff2'],
  '/fonts/newsreader-latin-ext-400-italic.woff2': [f17, 'font/woff2'],
  '/fonts/newsreader-latin-ext-500-italic.woff2': [f18, 'font/woff2'],
};
