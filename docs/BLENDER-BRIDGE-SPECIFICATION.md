# LIA FORGE — ESPECIFICAÇÃO DO BLENDER BRIDGE

> **Estado:** `PROPOSED` — especificação para aprovação humana. **Nenhum código foi escrito, nenhum add-on foi instalado ou executado.**
> **Data:** 2026-11-13 UTC | **Branch:** `arena/7c135d59-lia-forge`
> **Base:** Evolução do [`electron/blender-adapter.cjs`](../electron/blender-adapter.cjs) existente (que é específico para spritesheet)
> **Documentos relacionados:** [`ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md`](ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md), [`BLENDER-ADDONS-MATRICES.md`](BLENDER-ADDONS-MATRICES.md), [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md), [`T9-EXECUTION-BACKEND-ARCHITECTURE.md`](T9-EXECUTION-BACKEND-ARCHITECTURE.md)

---

## 0. O que este documento é e não é

**Este documento é:** uma proposta de arquitetura para a evolução do Blender Adapter existente em um componente mais geral capaz de orquestrar add-ons Blender em modo headless.

**Este documento não é:**
- Código implementado ou aprovado
- Autorização para escrever código
- Garantia de que os add-ons funcionam em headless
- Substituição do Tool Provider Hub existente

---

## 1. Contexto: o que já existe

### 1.1 Blender Adapter atual (`electron/blender-adapter.cjs`)

O adapter existente já implementa:

| Função | O que faz | Limitação |
|---|---|---|
| `spawnBlender(exec, args)` | Spawns `blender --background --python <script> -- <args>` | Específico para spritesheet |
| `buildBlenderSpritesheetArgs()` | Constrói args para `scripts/blender_spritesheet.py` | Um único script fixo |
| `runProcess(child, { signal, onProgress })` | Monitora stdout (`LIA_FORGE_PROGRESS`), stderr, abort via SIGTERM | Genérico, reutilizável |
| `validateSpritesheetFiles()` | Valida PNG RGBA + manifesto JSON | Apenas PNG |
| `candidateModelPaths()` | Encontra modelo 3D de entrada nos stages 2-3 | Genérico, reutilizável |

### 1.2 Script Python existente (`scripts/blender_spritesheet.py`)

Render de spritesheet com câmera ortográfica `LiaForge_Camera`, 8 frames por ação, `BLENDER_EEVEE_NEXT` com fallback, resolução validada 16–512 px.

### 1.3 Tool Provider Hub

O Hub já descobre Blender por PATH + locais conhecidos, com estados `ready`/`missing`/`blocked`. Essa descoberta **não precisa mudar** — o Bridge é um componente abaixo do Hub que usa o path descoberto.

---

## 2. Arquitetura proposta

### 2.1 Diagrama

```
┌──────────────────────────────────────────────────────────────┐
│  Lia Forge — Electron Main Process                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Tool Provider Hub (existente)                          │ │
│  │  → descobre Blender path → estado ready/missing/blocked │ │
│  └─────────────────────┬───────────────────────────────────┘ │
│                        │ path do Blender                     │
│  ┌─────────────────────▼───────────────────────────────────┐ │
│  │  Blender Bridge (proposto)                              │ │
│  │  ┌─────────────────────────────────────────────────┐    │ │
│  │  │  Job Planner                                    │    │ │
│  │  │  - recebe capability + inputs + config          │    │ │
│  │  │  - seleciona script Python do catálogo          │    │ │
│  │  │  - monta args (add-ons, input, output, params)  │    │ │
│  │  └──────────────────────┬──────────────────────────┘    │ │
│  │                         │                               │ │
│  │  ┌──────────────────────▼──────────────────────────┐    │ │
│  │  │  Process Runner (reúso de runProcess)           │    │ │
│  │  │  - spawn blender --background --factory-startup │    │ │
│  │  │  - monitora stdout/stderr                       │    │ │
│  │  │  - abort via SIGTERM                            │    │ │
│  │  └──────────────────────┬──────────────────────────┘    │ │
│  │                         │                               │ │
│  │  ┌──────────────────────▼──────────────────────────┐    │ │
│  │  │  Output Validator                               │    │ │
│  │  │  - valida GLB (via shared/model3d/glb.mjs)      │    │ │
│  │  │  - valida PNG (via png-validation.cjs)          │    │ │
│  │  │  - valida JSON manifesto                        │    │ │
│  │  └─────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│  Blender 4.x/5.x (--background --factory-startup)           │
│  --disable-autoexec                                         │
│  --python scripts/lia_bridge_runner.py                      │
│  -- { job_json }                                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  lia_bridge_runner.py                               │    │
│  │  1. Parse job JSON                                  │    │
│  │  2. Habilita add-ons necessários (via addon_utils)  │    │
│  │  3. Carrega input (.blend, .glb, .fbx)              │    │
│  │  4. Executa operation (bake, unwrap, export, etc.)  │    │
│  │  5. Escreve output + manifesto JSON                 │    │
│  │  6. Reporta progresso via stdout                    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Separação de responsabilidades

| Componente | Responsabilidade | Não faz |
|---|---|---|
| **Provider Hub** (existente) | Descobrir Blender, reportar estado | Escolher add-ons, executar jobs |
| **Job Planner** (novo) | Mapear capability → script + args + add-ons | Spawns processos |
| **Process Runner** (reúso) | Spawn, monitorar, abortar | Validar outputs |
| **Output Validator** (extensão) | Validar GLB/PNG/JSON | Decidir o que produzir |
| **lia_bridge_runner.py** (novo) | Executar job dentro do Blender | Descobrir add-ons, decidir capabilities |

---

## 3. Descoberta de add-ons

### 3.1 Onde os add-ons vivem

Os add-ons **não são empacotados pelo Lia Forge**. O usuário os instala no próprio Blender (via Extensions, `.zip` install, ou clone em `scripts/addons/`). O Bridge apenas **descobre e habilita** os add-ons disponíveis.

**Justificativa:**
- Redistribuir add-ons GPL-3.0 exige compliance (fornecer fonte, mesma licença)
- Redistribuir add-ons sem licença declarada é bloqueado
- O Blender já tem mecanismos próprios de instalação e atualização
- Separação de responsabilidades: o Lia Forge invoca, não distribui

### 3.2 Descoberta em runtime

O script Python `lia_bridge_runner.py` descobre add-ons disponíveis via:

```python
import addon_utils

def discover_addons():
    """Lista add-ons instalados com bl_info/blender_manifest."""
    available = {}
    for mod in addon_utils.modules():
        info = addon_utils.module_bl_info(mod)
        if info and info.get('name'):
            available[info['category'] + '.' + mod.__name__] = {
                'name': info['name'],
                'version': info.get('version'),
                'blender': info.get('blender'),
                'module': mod.__name__,
            }
    return available
```

Para extensões modernas (`blender_manifest.toml`, Blender 4.2+):

```python
import bpy

def discover_extensions():
    """Lista extensões instaladas via blender_manifest.toml."""
    extensions = []
    for repo in bpy.context.preferences.extensions.repos:
        if repo.enabled:
            for ext in repo.module_names:
                extensions.append(ext)
    return extensions
```

### 3.3 Inventário de versões

O Bridge reporta ao Hub:
- Add-on name, version, Blender compatibility
- Se está habilitado ou desabilitado
- Se a licença foi identificada (para auditoria)

---

## 4. Contrato de job

### 4.1 Entrada (Job JSON)

```json
{
  "jobId": "uuid-v4",
  "capability": "model3d.bake-softbody",
  "input": {
    "scenePath": "/path/to/character.blend",
    "objectName": "Character",
    "format": ".blend"
  },
  "params": {
    "addon": "squishyfx",
    "frameStart": 1,
    "frameEnd": 120,
    "frameStep": 4
  },
  "output": {
    "directory": "/path/to/output/",
    "format": "glb",
    "includeMorphTargets": true
  },
  "config": {
    "blenderPath": "/usr/bin/blender",
    "addonsRequired": ["squishyfx", "SKkeeper"],
    "timeout": 600,
    "cyclesDevice": "CPU"
  }
}
```

### 4.2 Saída (Result JSON)

```json
{
  "jobId": "uuid-v4",
  "status": "success",
  "outputs": [
    {
      "path": "/path/to/output/character.glb",
      "format": "glb",
      "sizeBytes": 2048576,
      "morphTargets": 30,
      "vertices": 10240
    }
  ],
  "metadata": {
    "blenderVersion": "4.5.0",
    "addonsUsed": [
      { "name": "SquishyFX", "version": "3.3.0", "module": "squishyfx" },
      { "name": "SKkeeper", "version": "1.8.2", "module": "SKkeeper" }
    ],
    "renderDevice": "CPU",
    "elapsedSeconds": 187
  },
  "provenance": {
    "tool": "blender",
    "toolVersion": "4.5.0",
    "script": "lia_bridge_runner.py",
    "capability": "model3d.bake-softbody"
  }
}
```

### 4.3 Erros

```json
{
  "jobId": "uuid-v4",
  "status": "error",
  "error": {
    "code": "ADDON_NOT_FOUND",
    "message": "Add-on 'squishyfx' não encontrado no Blender.",
    "details": {
      "requiredAddons": ["squishyfx", "SKkeeper"],
      "availableAddons": ["SKkeeper"]
    },
    "recoverable": true,
    "suggestion": "Instale o add-on SquishyFX no Blender via Extensions."
  }
}
```

---

## 5. Execução por scripts Python controlados

### 5.1 Catálogo de scripts

Cada capability tem um script Python associado:

| Capability | Script | Add-ons necessários | Operação principal |
|---|---|---|---|
| `model3d.bake-softbody` | `scripts/lia_jobs/bake_softbody.py` | squishyfx, SKkeeper | `bpy.ops.squishyfx.bake_shapekeys()` + `bpy.ops.sk.apply_subd_sk()` |
| `model3d.bake-spring-bones` | `scripts/lia_jobs/bake_spring_bones.py` | wiggle ou wiggle2 | `bpy.ops.wiggle.bake()` |
| `model3d.bake-bone-physics` | `scripts/lia_jobs/bake_bone_physics.py` | goo_physics | `bpy.ops.goophys.bake_physics()` |
| `model3d.generate-hair-cards` | `scripts/lia_jobs/generate_hair.py` | haircard_studio | `bpy.ops.hairecard.convert_to_mesh()` |
| `model3d.skin-voxel-heat` | `scripts/lia_jobs/skin_voxel_heat.py` | voxel_heat_diffuse (CLI) | `subprocess.run(['vhd', ...])` |
| `model3d.preserve-shapekeys` | `scripts/lia_jobs/preserve_shapekeys.py` | SKkeeper | `bpy.ops.sk.apply_subd_sk()` |
| `model3d.unwrap-uv` | `scripts/lia_jobs/unwrap_uv.py` | xatlas ou textools | `bpy.ops.xatlas.unwrap()` |
| `model3d.bake-textures` | `scripts/lia_jobs/bake_textures.py` | principled_baker | `bpy.ops.principled_baker.bake()` |
| `model3d.export-vrm` | `scripts/lia_jobs/export_vrm.py` | vrm_addon | `bpy.ops.export_scene.vrm()` |
| `model3d.retarget-animation` | `scripts/lia_jobs/retarget_animation.py` | keemap | `bpy.ops.keemap.retarget()` |
| `model3d.render-spritesheet` | `scripts/blender_spritesheet.py` | (nenhum) | Existente |

### 5.2 Padrão de script

Todo script de job segue o mesmo padrão:

```python
"""
lia_jobs/bake_softbody.py
SquishyFX bake → Shape Keys → GLB Morph Targets
"""
import bpy
import json
import sys
import os

def report_progress(percent, message):
    print(f"LIA_FORGE_PROGRESS {percent} {message}", flush=True)

def execute_job(job):
    report_progress(0, "Iniciando bake de soft-body")

    # 1. Habilita add-ons
    import addon_utils
    for addon_name in job['config']['addonsRequired']:
        addon_utils.enable(addon_name, default_set=False, persistent=False)
        report_progress(5, f"Add-on {addon_name} habilitado")

    # 2. Carrega cena
    bpy.ops.wm.open_mainfile(filepath=job['input']['scenePath'])
    report_progress(10, "Cena carregada")

    # 3. Configura Cycles para CPU (se necessário)
    if job['config'].get('cyclesDevice') == 'CPU':
        bpy.context.scene.cycles.device = 'CPU'

    # 4. Executa operação
    obj_name = job['input']['objectName']
    bpy.context.view_layer.objects.active = bpy.data.objects[obj_name]

    report_progress(15, "Iniciando bake SquishyFX")
    bpy.ops.squishyfx.bake_shapekeys(
        frame_start=job['params']['frameStart'],
        frame_end=job['params']['frameEnd'],
        frame_step=job['params']['frameStep'],
    )
    report_progress(80, "Bake concluído")

    # 5. Exporta GLB
    output_path = os.path.join(job['output']['directory'], 'output.glb')
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_morph=job['output'].get('includeMorphTargets', True),
        export_morph_animation=True,
    )
    report_progress(95, "GLB exportado")

    # 6. Resultado
    return {
        'status': 'success',
        'outputs': [{'path': output_path, 'format': 'glb'}],
    }

# Entry point
if __name__ == '__main__':
    job_json = sys.argv[sys.argv.index('--') + 1]
    job = json.loads(job_json)
    try:
        result = execute_job(job)
        print(f"LIA_FORGE_RESULT {json.dumps(result)}", flush=True)
    except Exception as e:
        error = {'status': 'error', 'error': {'code': 'JOB_FAILED', 'message': str(e)}}
        print(f"LIA_FORGE_RESULT {json.dumps(error)}", flush=True)
        sys.exit(1)
```

---

## 6. Compatibilidade com Blender headless

### 6.1 Flags de segurança

Todo spawn do Blender deve incluir:

| Flag | Propósito |
|---|---|
| `--background` | Sem GUI, sem viewport |
| `--factory-startup` | Configurações padrão, sem user prefs |
| `--disable-autoexec` | Bloqueia scripts embutidos em `.blend` |
| `--python-exit-code 1` | Erro no script = exit code 1 |

### 6.2 Habilitação de add-ons

Blender 4.x tem dois sistemas de add-ons:

| Sistema | Como habilitar | Add-ons nesta pesquisa |
|---|---|---|
| **Legacy** (`bl_info` em `__init__.py`) | `addon_utils.enable(name, default_set=False, persistent=False)` | SquishyFX (se `bl_info`), HairCard Studio, Braids Generator, etc. |
| **Extensions** (`blender_manifest.toml`) | `bpy.ops.preferences.extension_enable(module=name, repo=repo_name)` | SquishyFX (se instalado como extensão), Wiggle Bones v1.1.2 |

**Risco:** O método de habilitação depende de como o add-on foi instalado. O runner deve tentar ambos e reportar erro se nenhum funcionar.

### 6.3 Contexto e `temp_override`

Alguns operadores Blender exigem contexto de viewport (`area.type = 'VIEW_3D'`). Em `--background`, não há viewport. Mitigação:

```python
# Cria viewport virtual para operadores que exigem contexto
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        with bpy.context.temp_override(area=area):
            bpy.ops.some_operator_that_needs_viewport()
        break
```

Se nenhum `VIEW_3D` area existir (comum em `--background`), criar uma:

```python
# Em último caso, cria screen temporária com VIEW_3D
bpy.ops.screen.new()
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        # usar esta area
        break
```

### 6.4 Cycles em CPU (para RX 580)

```python
# Força Cycles em CPU (HIP/ROCm não suportado em gfx803)
bpy.context.scene.cycles.device = 'CPU'
bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'NONE'
```

---

## 7. Comunicação com o Lia Forge

### 7.1 Protocolo de stdout

| Prefixo | Significado | Formato |
|---|---|---|
| `LIA_FORGE_PROGRESS <0-100> <message>` | Progresso do job | Parseado por `runProcess` |
| `LIA_FORGE_RESULT <json>` | Resultado final | Parseado pelo Bridge |
| `LIA_FORGE_WARNING <message>` | Aviso não fatal | Logado |
| `LIA_FORGE_ERROR <json>` | Erro estruturado | Parseado pelo Bridge |

Qualquer outro output no stdout é ignorado. Stderr é capturado integralmente (limitado a 12 KB pelo `runProcess`).

### 7.2 Fluxo de comunicação

```
Lia Forge (Electron)                    Blender (Bridge)
     │                                       │
     │──── spawn ────────────────────────────>│
     │     (job JSON via argv)               │
     │                                       │
     │<─── LIA_FORGE_PROGRESS 0 ────────────│ Habilitando add-ons
     │<─── LIA_FORGE_PROGRESS 10 ───────────│ Cena carregada
     │<─── LIA_FORGE_PROGRESS 50 ───────────│ Bake 50%
     │<─── LIA_FORGE_PROGRESS 80 ───────────│ Bake concluído
     │<─── LIA_FORGE_PROGRESS 95 ───────────│ GLB exportado
     │<─── LIA_FORGE_RESULT {...} ──────────│ Resultado final
     │                                       │
     │<─── process exit 0 ──────────────────│
     │                                       │
     │──── validate output ─────────────────>│ (Bridge valida GLB)
```

---

## 8. Logs, erros e timeouts

### 8.1 Logs

| Nível | Onde | Conteúdo |
|---|---|---|
| **Debug** | Log do Electron (main process) | Job JSON completo, args do spawn, stdout integral |
| **Info** | Log do usuário (UI) | Progresso, outputs, erros |
| **Warning** | Log do usuário | Avisos do Blender (non-fatal) |
| **Error** | Log do usuário + log do Electron | Erro estruturado + stderr (últimas 12 linhas) |

### 8.2 Códigos de erro

| Código | Significado | Recoverable | Ação |
|---|---|---|---|
| `ADDON_NOT_FOUND` | Add-on necessário não instalado | Sim | Sugerir instalação |
| `ADDON_INCOMPATIBLE` | Add-on incompatível com versão do Blender | Não | Sugerir atualização |
| `INPUT_NOT_FOUND` | Arquivo de entrada não existe | Sim | Verificar path |
| `INPUT_INVALID` | Arquivo de entrada corrompido | Não | Verificar arquivo |
| `OPERATION_FAILED` | Operação Blender falhou (exceção) | Depende | Verificar stderr |
| `EXPORT_FAILED` | Export GLB/PNG falhou | Depende | Verificar stderr |
| `TIMEOUT` | Job excedeu timeout | Sim | Retry ou reduzir escopo |
| `CANCELLED` | Usuário cancelou | Sim | Retry |
| `GPU_REQUIRED` | Operação exige GPU não disponível | Não | Sugerir alternativa CPU |
| `LICENSE_BLOCKED` | Add-on com licença não verificada | Não | Verificar licença |

### 8.3 Timeouts

| Tipo | Default | Configurável | Ação no timeout |
|---|---|---|---|
| **Job timeout** | 600s (10 min) | Sim, por job | SIGTERM → SIGKILL após 5s |
| **Spawn timeout** | 30s | Não | Erro imediato |
| **Progress stall** | 120s sem progresso | Sim | Warning + eventual SIGTERM |

---

## 9. Cancelamento de processos

O `runProcess` existente já suporta cancelamento via `AbortSignal`:

```javascript
const controller = new AbortController();
// ... em caso de cancelamento do usuário:
controller.abort();
// → SIGTERM enviado ao processo Blender
// → runProcess rejeita com code 'WORKFLOW_CANCELLED'
```

**Limitação:** `SIGTERM` não garante que o Blender encerrou todos os subprocessos (ex: Voxel Heat Diffuse `vhd.exe`). O Bridge deve:
1. Enviar SIGTERM ao grupo de processos (não apenas ao PID do Blender)
2. Aguardar 5s
3. Se ainda vivo, SIGKILL
4. Verificar se há subprocessos órfãos

---

## 10. Isolamento e permissões

### 10.1 Sandboxing de binários proprietários

Para add-ons com binários proprietários (Voxel Heat Diffuse):

| Medida | Implementação |
|---|---|
| **Tempdir isolado** | Cada job executa em `os.tempdir/lia-forge-<jobId>/` |
| **Arquivos mínimos** | Apenas o necessário para a operação (mesh, bones) |
| **Cleanup** | Tempdir removido após job (sucesso ou erro) |
| **Sem rede** | Binários não devem acessar rede; monitorar via firewall se possível |

### 10.2 Permissões de arquivo

| Arquivo | Permissão | Justificativa |
|---|---|---|
| Input `.blend` | Read-only | Não modificar o arquivo do usuário |
| Output `.glb` | Write | Diretório de output configurado pelo usuário |
| Tempdir | Read+Write | Temporário, removido após job |
| Add-on directory | Read-only | Não modificar add-ons instalados |

### 10.3 `--disable-autoexec`

Sempre usar `--disable-autoexec` para prevenir execução de scripts embutidos em `.blend` de entrada. Add-ons habilitados explicitamente via `addon_utils.enable()` são a exceção controlada.

---

## 11. Validação de artefatos

### 11.1 GLB

Reúso do parser existente em `shared/model3d/glb.mjs`:

| Check | Método | Critério |
|---|---|---|
| **Magic bytes** | `glTF` nos primeiros 4 bytes | Obrigatório |
| **Version** | `version >= 2` | Obrigatório |
| **Meshes** | Pelo menos 1 mesh presente | Obrigatório |
| **Morph Targets** | Se `includeMorphTargets: true`, pelo menos 1 target | Condicional |
| **Animations** | Se job de bake de animação, pelo menos 1 animation | Condicional |
| **Vertex count** | `> 0` e `< limite configurado` | Obrigatório |
| **NaN check** | Sem vértices NaN | Obrigatório |

### 11.2 PNG (spritesheet)

Reúso do `electron/png-validation.cjs`:
- RGBA8 obrigatório
- Dimensões válidas (16–512 por frame)
- CRC válido

### 11.3 JSON Manifesto

Validação via `electron/spritesheet-manifest.cjs` (para spritesheet) ou schema próprio (para outros jobs).

---

## 12. Controle de versões

### 12.1 Versão do Blender

| Versão | Suporte | Notas |
|---|---|---|
| **4.2 LTS** | ✅ Primário | LTS estável; maioria dos add-ons suporta |
| **4.5 LTS** | ✅ Secundário | Wiggle Bones v1.1.2 exige 4.5+ |
| **5.0+** | ⚠️ Monitorar | Cloth NeXt exige 5.0+ (rejeitado); outros podem ter breaking changes |
| **< 4.0** | ❌ Não suportado | APIs incompatíveis |

### 12.2 Versão dos add-ons

O Bridge reporta a versão de cada add-on usado no job (via `bl_info['version']` ou `blender_manifest.toml`). A versão é gravada no manifesto de output como parte da proveniência.

**Não há pin de versão** — o Bridge usa o que o usuário instalou. Se um add-on introduz breaking change, o job falha e o erro é reportado com a versão usada.

---

## 13. Estratégia de fallback

### 13.1 Add-on ausente

| Situação | Fallback |
|---|---|
| SquishyFX ausente | Job falha com `ADDON_NOT_FOUND`; sugerir instalação |
| SKkeeper ausente | Tentar aplicar subdiv sem preservar shape keys (com aviso de perda) |
| xatlas ausente | Tentar `bpy.ops.uv.smart_project()` (UV nativo do Blender, qualidade inferior) |
| Wiggle ausente | Job falha com `ADDON_NOT_FOUND`; sugerir Wiggle 2 ou Wiggle Bones |
| Voxel Heat Diffuse ausente | Tentar `bpy.ops.paint.weight_from_bones()` (auto-weight nativo) |

### 13.2 Blender ausente

O Provider Hub já reporta `missing` quando Blender não é encontrado. O Bridge não é invocado neste caso.

### 13.3 GPU ausente (RX 580 sem HIP/ROCm)

Para operações que usariam GPU:
- Cycles: forçar `device = 'CPU'`
- EEVEE: funciona com OpenGL (RX 580 suporta)
- Add-ons CUDA-only: rejeitar com `GPU_REQUIRED`

### 13.4 RAM insuficiente

Para jobs que excedem RAM disponível:
- Estimar RAM necessária antes de executar (baseado em vertex count)
- Se estimativa > 80% da RAM disponível, warn + pedir confirmação
- Se > 100%, bloquear com `INSUFFICIENT_RESOURCES`

---

## 14. O que é automatizável vs manual

### 14.1 Automatizável (Bridge executa)

| Operação | Add-on | Método |
|---|---|---|
| Bake de soft-body → Shape Keys | SquishyFX | Script Python headless |
| Bake de spring bones → keyframes | Wiggle 2, Wiggle Bones, Goo Physics | Script Python headless |
| Preservar Shape Keys + subdiv | SKkeeper | Script Python headless |
| Auto-unwrap UV | xatlas | Script Python headless |
| Bake de texturas PBR | Principled Baker | Script Python headless |
| Export GLB/GLTF | glTF-Blender-IO | Script Python headless |
| Export VRM | VRM Add-on | Script Python headless |
| Voxel Heat Diffuse skinning | VHD CLI | Subprocess |
| Render spritesheet | (nativo) | Script Python existente |

### 14.2 Manual (artista no Blender)

| Operação | Add-on | Motivo |
|---|---|---|
| Retopologia | RetopoFlow | Drawing strokes interativos |
| Sculpt | SpeedSculpt | Ferramentas de viewport |
| Modelagem mesh | Dovetail Key, Projection Modeling | Modal operators com mouse |
| Animação curves | Animaide | Curves editor interativo |
| Pintura | Ucupaint | Paint strokes interativos |
| Mocap streaming | Rokoko Studio Live | Requer hardware + software Rokoko |

### 14.3 Misto (Bridge + revisão humana)

| Operação | Add-on | Bridge faz | Humano revisa |
|---|---|---|---|
| Hair cards | HairCard Studio | Geração procedural | Qualidade visual, UV cleanup |
| Braids | Braids Generator | Geração procedural | Posicionamento, estilo |
| Rig | BlenRig | Auto-rig | Ajuste de pesos, pose |
| Retargeting | Keemap | Transferência de animação | Cleanup de keyframes |

---

## 15. Relação com o produto

### 15.1 Onde o Bridge se encaixa

```
Studio (UI)
  → Workflow Engine (orquestra steps)
    → Provider Hub (descobre Blender)
      → Blender Bridge (executa capability)
        → Blender --background + add-ons
          → Output (GLB, PNG, VRM)
            → Asset Manager (gerencia artefatos)
              → QA (valida qualidade)
```

### 15.2 O que o Bridge NÃO altera

- **Domain Contracts:** Os contratos de input/output permanecem os mesmos
- **Capability Registry:** Novas capabilities são candidatas, não registradas
- **Workflow Engine:** O engine não sabe que o Bridge existe; ele invoca capabilities
- **Asset Manager:** Os formatos de output já são suportados
- **QA:** As validações existentes são suficientes

### 15.3 Integração com Three.js

Os outputs do Bridge são GLB/PNG/VRM — formatos que o Three.js consome nativamente:

| Output | Three.js consumer |
|---|---|
| GLB com Morph Targets | `GLTFLoader` → `mesh.morphTargetInfluences[]` |
| GLB com Skeletal Animation | `GLTFLoader` → `AnimationMixer` → `clipAction()` |
| GLB com Hair Cards | `GLTFLoader` + `material.alphaTest = 0.5` + `DoubleSide` |
| PNG spritesheet | `TextureLoader` → `SpriteMaterial` |
| VRM | `VRMLoader` (three-vrm) |

---

## 16. O que este documento não faz

- Não autoriza implementação
- Não cria código
- Não instala add-ons
- Não executa Blender
- Não altera contratos existentes
- Não registra capabilities novas
- Não substitui o Tool Provider Hub
- Stars do GitHub não são usados como evidência
- Tempos de performance não são benchmarks
