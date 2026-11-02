# Teste real do renderer no Windows

**Preparação, não validação:** o renderer ainda não foi executado com estes personagens. Nenhum asset foi baixado. Os termos atuais e a disponibilidade do menu Mixamo não foram verificados aqui; o manifesto mantém esses bloqueios pendentes.

## Pastas

Todos os caminhos abaixo são relativos a este diretório `local-renderer-test/`:

```text
assets/
├── mixamo-male/combined.blend
├── mixamo-female/combined.blend
├── unreal-manny/combined.blend       # opcional
├── unreal-quinn/combined.blend       # opcional
└── custom/<slug>/combined.blend
output/                               # resultados locais, criados a cada execução
manifests/source-license-manifest.json
scripts/
├── check-source-license.cjs
├── prepare-folders.ps1
├── run-render.cjs
├── runner-smoke.cjs
└── verify-output.cjs
run-render.ps1
README.md
```

`assets/` e `output/` estão no `.gitignore` local. Modelos, texturas, FBX, blends e renders não entram no Git. O manifesto de referência, scripts e documentação continuam versionados. Não coloque senhas, cookies, API keys ou tokens no manifesto.

## 1. Criar as pastas e colocar os modelos

Abra PowerShell na raiz do checkout do Lia Forge e crie as pastas vazias:

```powershell
.\local-renderer-test\scripts\prepare-folders.ps1
```

O comando não baixa, move, renomeia nem apaga arquivos existentes. Coloque **uma** entrada por personagem nestes caminhos exatos:

```text
local-renderer-test/assets/mixamo-male/combined.blend
local-renderer-test/assets/mixamo-female/combined.blend
```

O ensaio opcional Unreal usa `assets/unreal-manny/combined.blend` ou `assets/unreal-quinn/combined.blend`. Para outro personagem, use um slug simples, por exemplo `RoboV2`: `prepare-folders.ps1 -CustomName RoboV2` cria `assets/custom/RoboV2/`; o arquivo fica `combined.blend` nessa pasta. Depois, cadastre o sujeito como `custom-RoboV2` no manifesto. Não é necessário alterar o código para acrescentar outro nome.

Para manter a procedência, preserve os arquivos originais em subpastas locais do mesmo sujeito, por exemplo `source/character.fbx` e `source/actions/<nome-original>.fbx`. Eles e o `combined.blend` permanecem fora do Git.

## 2. Preparar cada `combined.blend`

O renderer atual recebe **um único arquivo**. Ele não combina FBX separados. Prepare uma cópia de trabalho no Blender:

1. Importe o FBX do personagem com mesh/skin e esqueleto; este será o armature principal.
2. Importe os FBX das três ações reais escolhidas. Confira que os clips têm o movimento esperado e que os ossos/rest pose são compatíveis com o rig principal.
3. No Dope Sheet/Action Editor, associe cada Action ao armature principal e teste-a. Preserve os datablocks de Action antes de remover rigs auxiliares (Fake User pode ajudar a mantê-los no arquivo). Não deixe o renderer selecionar um armature duplicado por engano; ele usa o primeiro armature encontrado.
4. Salve o arquivo final como `assets/<sujeito>/combined.blend`. Não sobrescreva os FBX originais.

O arquivo precisa conter os meshes necessários, um armature principal e as três Actions reais, acessíveis em `bpy.data.actions`. O renderer solicita os identificadores `idle`, `walk` e `run` e reconhece sequências de tokens completas no nome da Action. Registre no manifesto o **título real do clip de origem**, o **nome real da Action no Blender** e o arquivo de origem. Se precisar renomear uma Action para corresponder ao contrato, faça isso somente após confirmar seu conteúdo e preserve ambos os nomes no mapeamento. Não crie ou declare uma ação ausente.

Para cada Mixamo, a rota planejada usa um FBX do personagem e um arquivo por ação, se a interface atual oferecer essa forma de download. A disponibilidade de formatos e clips não foi confirmada nesta preparação. Se `FBX Binary` aparecer, pode ser escolhido e registrado; não presuma que esteja disponível. Personagem: opção com mesh/skin; clips: opção sem skin se oferecida. Anote o que a interface realmente mostrou e o formato escolhido.

## 3. Registrar origem, versão, licença e animações

Edite `manifests/source-license-manifest.json` para cada sujeito testado:

- preencha a origem exata (`sourceUrl`), título/listagem e `sourceVersion`; se a fonte não publicar versão, escreva `not supplied by source` em vez de inventar uma;
- registre formato real, data e paths relativos dos arquivos em `files`; marque o `consolidated-blend` como `provided` quando ele existir. Se souber o tamanho/hash do arquivo, preencha `sizeBytes`/`sha256`; o runner os confere quando informados e sempre grava o hash de entrada no relatório de cada run;
- para cada `idle`, `walk` e `run`, preencha `sourceClipTitle`, `sourceFilePath`, `blenderActionName` com o nome visto no Blender e `confirmedByUser: true` só depois de inspecionar o clip;
- revise os termos atuais aplicáveis. Para Mixamo/Epic/Fab/Unreal, o runner exige `termsReview.status: reviewed_by_user` e `currentOfficialTermsVerified: true`; no sujeito, `licenseRecord.status: reviewed_by_user`, `localRenderingConfirmed: true`, URL exata dos termos e data da revisão;
- registre uso comercial e redistribuição separadamente. Não marque redistribuição permitida sem evidência; essa permissão não é necessária para o teste local.

A checagem é uma barreira contra manifesto incompleto, **não** uma decisão jurídica nem uma consulta à web. Os links candidatos do manifesto não foram verificados ao vivo. A autorização para render local deve vir da revisão do usuário; se faltar procedência, versão ou revisão de termos, a execução é bloqueada.

## 4. Verificar o Blender

O runner usa o helper existente `electron/external-tools.cjs`, que procura o Blender pelo PATH e locais conhecidos, incluindo instalações Steam no Windows. Não há caminho fixo nem instalação automática.

Primeiro faça um diagnóstico sem render:

```powershell
.\local-renderer-test\run-render.ps1 -Subject mixamo-male -CheckOnly
```

Ele informa o path/versão do Blender se detectado, os paths dos modelos e todos os bloqueios atuais de manifesto. Não altera o manifesto e não renderiza. Também é possível consultar diretamente o helper, a partir da raiz do checkout:

```powershell
$Blender = node -e "const p=require('./electron/external-tools.cjs').findExternalTool('blender'); if(!p) process.exit(3); process.stdout.write(p)"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Blender)) { throw 'Blender não detectado pelo helper' }
& $Blender --version
if ($LASTEXITCODE -ne 0) { throw 'Blender --version falhou' }
```

Se não for encontrado, pare e confira a instalação existente/Steam e o PATH. O teste não instala nem procura uma pasta presumida.

Para testar o planejador de caminhos, a passagem de argumentos, o bloqueio do manifesto e a criação de pastas de saída sem precisar de modelo/Blender, rode:

```powershell
node .\local-renderer-test\scripts\runner-smoke.cjs
.\local-renderer-test\run-render.ps1 -Subject mixamo-male -CheckOnly
```

O primeiro é um smoke/unit test local e **não** renderiza nem prova compatibilidade do Blender. O segundo consulta o ambiente real e lista os bloqueios; `BLOQUEADO` é esperado enquanto assets/licença/Blender faltarem.

## 5. Executar os dois personagens Mixamo

Depois de preparar **os dois** `combined.blend` e preencher/aprovar os dados de origem e licença de cada sujeito, rode na raiz do checkout:

```powershell
.\local-renderer-test\run-render.ps1 -Subject mixamo-male
.\local-renderer-test\run-render.ps1 -Subject mixamo-female
```

Cada execução cria uma pasta exclusiva em `local-renderer-test/output/` com timestamp e sufixo único. Uma repetição não reutiliza nem sobrescreve resultados anteriores. Para os casos opcionais:

```powershell
.\local-renderer-test\run-render.ps1 -Subject unreal-manny
.\local-renderer-test\run-render.ps1 -Subject unreal-quinn
# Exemplo custom (precisa de registro custom-RoboV2 no manifesto):
.\local-renderer-test\run-render.ps1 -Subject RoboV2
```

O runner usa `shell: false` e argumentos separados para iniciar o Blender; paths com espaços, acentos e caracteres Unicode são passados como argumentos, não montados como uma linha de comando shell. O slug do sujeito é limitado a letras/números/ponto/hífen/sublinhado para impedir traversal de diretório. O caminho do checkout e dos arquivos pode conter espaços ou acentos.

## 6. Encontrar e interpretar os resultados

Cada execução contém, quando aplicável:

- `spritesheet.png` e `spritesheet.json` — o atlas e o manifesto produzidos pelo renderer atual;
- `validation-report.json` e `validation.log` — integridade/estrutura, pixels com alpha por célula, hashes e medida de variação de `walk`/`run`;
- `run-provenance.json` — sujeito, origem, versão, decisão de licença declarada, nomes/arquivos de animação e hash do `combined.blend` usado;
- `blender-version.txt` e `blender.log` — versão e log do processo.

O ensaio solicita 48×48 pixels, oito frames por ação, ordem `idle`, `walk`, `run`: espera grade 8×3 e atlas 384×144. É uma expectativa do contrato, não resultado validado.

`checks_passed_visual_review_required` significa somente que os checks automatizados passaram; **não** valida o renderer por si só. `checks_blocked` ou erro do runner requer análise do log. Mesmo com checks aprovados, abra o PNG e inspecione as 24 células: corpo inteiro, recorte, pés/pivô, consistência de escala, deformação, poses e diferença semântica entre as três ações. A variação de pixels não prova que `walk` seja caminhada nem que o rig esteja correto. Só registre validação depois da inspeção visual humana dos dois personagens.

## 7. Compartilhar para avaliação

Se a licença permitir, compartilhe para cada personagem o `spritesheet.png`, `spritesheet.json`, `validation-report.json`, `run-provenance.json`, `validation.log`, `blender.log` e `blender-version.txt`. Esses arquivos dão evidência do resultado e do ambiente. Não envie FBX/BLEND/texturas ou outros assets brutos se a licença não permitir; não inclua resultados locais em Git. Se algum dado de procedência for privado, remova-o da cópia compartilhada sem alterar o manifesto local.

**Estado atual:** preparação apenas. Não há modelo real, manifesto aprovado, render, PNG, atlas ou revisão visual neste checkout. A compatibilidade do Blender/FBX e os termos atuais ainda precisam ser confirmados no seu Windows.
