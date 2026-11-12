/**
 * Smoke do Capability Registry (F1).
 * Verifica integridade do catálogo e as regras de honestidade da T12:
 * capacidade proposta não pode aparecer como implementada, requisito
 * desconhecido permanece null e nenhuma dependência aponta para o vazio.
 */

import assert from 'node:assert/strict';
import {
  BASE_CAPABILITIES,
  CAPABILITY_STATUSES,
  FAMILIES,
  createCapabilityRegistry,
  validateCapability,
} from '../shared/capabilities/registry.mjs';

const registry = createCapabilityRegistry();
const capabilities = registry.list();

assert.ok(capabilities.length >= 40, `esperado catálogo robusto, obtido ${capabilities.length}`);
assert.equal(new Set(capabilities.map((item) => item.id)).size, capabilities.length, 'ids duplicados no catálogo');

for (const capability of capabilities) {
  assert.ok(FAMILIES.includes(capability.family), `${capability.id}: família inválida`);
  assert.ok(CAPABILITY_STATUSES.includes(capability.status), `${capability.id}: status fora do vocabulário`);
  assert.equal(capability.schemaVersion, 1);
  assert.ok(capability.title.trim().length >= 2, `${capability.id}: título vazio`);
  for (const dependency of capability.dependencies) {
    assert.ok(registry.has(dependency), `${capability.id}: dependência desconhecida ${dependency}`);
  }
  for (const field of ['vramMb', 'ramMb', 'diskMb']) {
    const value = capability.requirements[field];
    assert.ok(value === null || (Number.isFinite(value) && value >= 0), `${capability.id}: ${field} inválido`);
  }
  // capacidade proposta/planejada nunca afirma execução
  if (capability.status === 'proposed' || capability.status === 'planned') {
    assert.equal(capability.evidence.includes('VERIFIED'), false, `${capability.id}: evidência afirma verificação indevida`);
  }
  if (capability.status === 'implemented') {
    assert.ok(capability.evidence.trim().length > 0, `${capability.id}: implementado sem apontar evidência`);
  }
}

// famílias cobertas (requisito §7: nenhuma família pode ficar sem capacidades)
for (const family of FAMILIES) {
  assert.ok(registry.byFamily(family).length > 0, `família ${family} sem capacidades`);
}

// contrato 3D→2D preservado: capacidade nuclear com validadores de conteúdo
const spritesheet = registry.get('render3d.to2d');
assert.ok(spritesheet, 'capacidade render3d.to2d ausente');
assert.deepEqual([...spritesheet.validators].sort(), ['png-content', 'png-structural', 'spritesheet-manifest']);
assert.ok(spritesheet.providers.includes('blender-spritesheet'));

// impacto de mudança (dependentsOf) funciona nos dois sentidos
assert.ok(registry.dependentsOf('image2d.decompose-layers').includes('image2d.scenario'));
assert.ok(registry.get('image2d.scenario').dependencies.includes('image2d.decompose-layers'));

// validação rejeita entradas inválidas (fail-closed)
assert.throws(() => validateCapability({ ...BASE_CAPABILITIES[0], id: 'ID MAIÚSCULO' }), /stable id|must match/);
assert.throws(() => validateCapability({ ...BASE_CAPABILITIES[0], family: '4d' }), /family/);
assert.throws(() => validateCapability({ ...BASE_CAPABILITIES[0], status: 'done' }), /status/);
assert.throws(() => validateCapability({ ...BASE_CAPABILITIES[0], requirements: { vramMb: -1 } }), /vramMb/);
assert.throws(() => createCapabilityRegistry([...BASE_CAPABILITIES, BASE_CAPABILITIES[0]]), /duplicate/);
assert.throws(
  () => createCapabilityRegistry([{ ...BASE_CAPABILITIES[0], id: 'x.y', dependencies: ['inexistente'] }]),
  /unknown/,
);

// o catálogo é imutável
assert.throws(() => { capabilities.push({}); }, TypeError);
assert.equal(registry.get('nao-existe'), null);
assert.equal(registry.has('nao-existe'), false);

console.log(`Capability registry smoke test passed (${capabilities.length} capacidades, ${FAMILIES.length} famílias).`);
