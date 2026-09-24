const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../web/dist/js/schedule-core.js');
test('carga docente: columnas administrativas, encabezado multinivel y horas partidas',()=>{
 const parsed=S.parse(S.rowsFromOcr(require('./fixtures/teacher-ocr-boxes.json')));
 assert.equal(parsed.classes.length,20);
 const expected=[['07:00','08:00','B-213'],['10:00','11:00','D-405'],['09:00','10:00','D-406'],['14:00','15:00','C-308'],['17:00','18:00','D-406']];
 for(const [start,end,room] of expected){const rows=parsed.classes.filter(c=>c.start===start);assert.equal(rows.length,4);assert.deepEqual(rows.map(c=>c.day),[1,2,3,4]);assert.ok(rows.every(c=>c.end===end&&c.classroom===room&&/CALCULO|METODOS/.test(c.subject)));}
});
