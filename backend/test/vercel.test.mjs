import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRoute} from '../api/index.js';
test('Vercel adapta /health',()=>assert.equal(normalizeRoute('/api/index?route=health'),'/health'));
test('Vercel adapta /v1 con filtros',()=>assert.equal(normalizeRoute('/api/index?route=v1&kind=arribos&parada=123&linea=98'),'/v1/arribos?parada=123&linea=98'));
test('Vercel conserva rutas originales',()=>assert.equal(normalizeRoute('/v1/lineas'),'/v1/lineas'));
test('Vercel rechaza rutas incorrectas',()=>assert.equal(normalizeRoute('/api/index?route=v1&kind=..'),'/invalid'));
