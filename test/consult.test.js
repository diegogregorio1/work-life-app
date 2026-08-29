import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

const DATE = '2026-08-30';

test('收入状态可切换且咨询摘要正确', () => {
  const s = dc.ensureData(null);
  const cl = dc.upsert(s.consult.clients, { name: '王先生', contact: 'wx' });
  const inc = dc.upsert(s.consult.incomes, { date: DATE, clientId: cl.id, amount: 500, status: 'unpaid' });
  inc.status = 'paid';
  assert.equal(inc.status, 'paid');
  s.consult.appointments.push({ id: dc.uid(), date: DATE, clientId: cl.id, topic: '面谈' });
  const sum = dc.consultSummary(s, DATE);
  assert.equal(sum.appointmentsToday, 1);
  assert.equal(sum.unpaid, 0);
  inc.status = 'unpaid';
  assert.equal(dc.consultSummary(s, DATE).unpaid, 1);
});

test('咨询工作完整流程经 API 持久化', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-consult-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    const cl = dc.upsert(s.consult.clients, { name: '李女士', contact: '138xxxx', source: '朋友介绍' });
    s.consult.appointments.push({ id: dc.uid(), date: DATE, time: '14:00', clientId: cl.id, topic: '职业咨询' });
    s.consult.records.push({ id: dc.uid(), date: DATE, clientId: cl.id, topic: '职业咨询', duration: 60, note: '建议转行' });
    const inc = dc.upsert(s.consult.incomes, { date: DATE, clientId: cl.id, amount: 800, status: 'unpaid', note: '' });
    inc.status = 'paid';

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.consult.clients.length, 1);
    assert.equal(loaded.consult.clients[0].name, '李女士');
    assert.equal(loaded.consult.appointments.length, 1);
    assert.equal(loaded.consult.records[0].duration, 60);
    assert.equal(loaded.consult.incomes[0].status, 'paid');
    const sum = dc.consultSummary(loaded, DATE);
    assert.equal(sum.appointmentsToday, 1);
    assert.equal(sum.unpaid, 0);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});