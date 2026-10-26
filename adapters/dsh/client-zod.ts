// Keep Typert's string codecs and named-input parser without retaining every Zod export.
import { string, strictObject } from 'zod';
import { config } from 'zod/v4/core';
import en from 'zod/v4/locales/en.js';

config(en());
export const z = { string, strictObject };
