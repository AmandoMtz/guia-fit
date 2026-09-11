const test = require('node:test');
const assert = require('node:assert/strict');
const { accountType } = require('../server/account.cjs');
const QR = require('../server/qr.cjs');
const { createPdf } = require('../server/pdf.cjs');

test('roles institucionales: distingue alumno, docente y administrador por reglas explícitas', () => {
  assert.equal(accountType('a2213332176@alumnos.uat.edu.mx'), 'student');
  assert.equal(accountType('andrea.ortega@uat.edu.mx'), 'teacher');
  assert.equal(accountType('andrea.ortega@docentes.uat.edu.mx'), 'teacher');
  assert.equal(accountType('usuario@gmail.com'), 'other');
  assert.equal(accountType('a2213332176@alumnos.uat.edu.mx', 'admin'), 'admin');
});

test('QR local: produce SVG autocontenido para el token de asistencia', () => {
  const payload = 'https://castoresfit.com/?e=abcdefghijklmnopqrstuv';
  const svg = QR.svg(payload);
  assert.match(svg, /^<svg xmlns=/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /<rect/);
});

test('PDF de eventos: incluye código de validación y no necesita servicio externo', () => {
  const pdf = createPdf({
    title: 'Historial de eventos verificados',
    subtitle: 'Alumno de prueba',
    lines: ['1. Evento de prueba · 10/09/2026 · Auditorio'],
    validationCode: 'FIT-2026-ABCDEF123456',
  });
  assert.equal(pdf.subarray(0, 8).toString('latin1'), '%PDF-1.4');
  assert.match(pdf.toString('latin1'), /FIT-2026-ABCDEF123456/);
  assert.match(pdf.toString('latin1'), /%%EOF/);
});
