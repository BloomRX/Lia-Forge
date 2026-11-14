# Relatório individual dos add-ons

Versões e mínimos vêm do manifesto ou de bl_info. As listas de imports e operadores são sinais de API e dependências. Headless, versão máxima, execução, qualidade e compatibilidade efetiva com Blender 5.3.0 exigem teste. Os rótulos de decisão são PROPOSED. Reúso aqui descreve o candidato e seu modo de integração.

## 3D Onion Skinning

**MANUAL** · Ghosting temporal no viewport. Usar como revisão manual de poses e clipes.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| ab231a1360fb | 0.21.3 / 4.4.0 | [0, 21, 3] / [4, 5, 0] | 7 / 7 | wm.onionskin_add_constrained, wm.onionskin_animation_cancel_handler, wm.onionskin_clear_cache, wm.onionskin_decimate_object, wm.onionskin_edit_keymap, wm.onionskin_link_selected | handlers, timers |
| d553d8cd02ab | 0.15.1 / 4.4.0 | [0, 15, 1] / [4, 5, 0] | 6 / 6 | wm.onionskin_animation_cancel_handler, wm.onionskin_clear_cache, wm.onionskin_edit_keymap, wm.onionskin_link_selected, wm.onionskin_select_object, wm.onionskin_settings_popup | handlers, timers |
| 8e27f2004263 | 0.20.5 / 4.4.0 | [0, 20, 5] / [4, 5, 0] | 6 / 6 | wm.onionskin_add_constrained, wm.onionskin_animation_cancel_handler, wm.onionskin_clear_cache, wm.onionskin_decimate_object, wm.onionskin_edit_keymap, wm.onionskin_link_selected | handlers, timers |

## Animation Snapper Pro

**ADAPT** · Bake e snap de objetos e movimento. Manter variantes para 4.x e 5.x distintas. Medir diferença entre transform original e baked.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 7a2b655e9d09 | 1.0.0 / 3.2.0 | [1, 0, 0] / [3, 2, 0] | 1 / 1 | object.baked_to_element_snap, object.create_baked_empty, object.create_empty_for_each, object.create_empty_snap_parent, object.helper_to_element_snap, snap_tool.batch_backward | area, modal_handler_add, temp_override, window |
| 9f4e11b7ce2c | 1.1.0 / 3.2.0 | [1, 1, 0] / [3, 2, 0] | 1 / 1 | object.baked_to_element_snap, object.create_baked_empty, object.create_empty_for_each, object.create_empty_snap_parent, object.helper_to_element_snap, snap_tool.batch_backward | area, modal_handler_add, temp_override, window |
| fc3415dbefea | 2.0.0 / 3.2.0 | [2, 0, 0] / [3, 2, 0] | 1 / 1 | object.baked_to_element_snap, object.create_baked_empty, object.create_empty_for_each, object.create_empty_snap_parent, object.helper_to_element_snap, snap_tool.batch_backward | area, modal_handler_add, temp_override, window |
| 3b23919c4dc1 | 2.0.0 / 3.2.0 | [2, 0, 0] / [3, 2, 0] | 1 / 1 | object.baked_to_element_snap, object.create_baked_empty, object.create_empty_for_each, object.create_empty_snap_parent, object.helper_to_element_snap, snap_tool.batch_backward | area, modal_handler_add, temp_override, window |
| ab696a3d3a10 | 2.1.0 / 5.0.0 | [2, 1, 0] / [5, 0, 0] | 1 / 1 | object.baked_to_element_snap, object.create_baked_empty, object.create_empty_for_each, object.create_empty_snap_parent, object.helper_to_element_snap, snap_tool.batch_backward | area, modal_handler_add, temp_override, window |

## AnimSnapPro Switcher

**ADAPT** · Troca de constraints e bake. A escolha dos alvos e a limpeza alteram o estado da cena. Use fixture temporária em teste futuro.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 197e1a5f9d31 | 1.2.0 / 5.0.0 | [1, 2, 0] / [5, 0, 0] | 1 / 1 | dynconst.bake_all_scene, dynconst.bake_current, dynconst.create_markers, dynconst.delete_all_addon_data, dynconst.delete_all_markers, dynconst.delete_constraint_entry | area, modal_handler_add, temp_override, window |
| b3669bf5a67c | 1.2.0 / 4.0.0 | [1, 2, 0] / [4, 0, 0] | 1 / 1 | dynconst.bake_all, dynconst.create_markers, dynconst.delete_all_addon_data, dynconst.delete_all_markers, dynconst.delete_constraint_entry, dynconst.follow_set_item | area, modal_handler_add, temp_override, window |
| 043a937469b4 | 1.2.0 / 5.0.0 | [1, 2, 0] / [5, 0, 0] | 1 / 1 | dynconst.bake_all, dynconst.create_markers, dynconst.delete_all_addon_data, dynconst.delete_all_markers, dynconst.delete_constraint_entry, dynconst.follow_set_item | area, modal_handler_add, temp_override, window |
| 9fab420e91c2 | 1.0.0 / 5.0.0 | [1, 0, 0] / [5, 0, 0] | 1 / 1 | dynconst.bake_all, dynconst.create_markers, dynconst.delete_all_addon_data, dynconst.delete_all_markers, dynconst.delete_constraint_entry, dynconst.follow_set_item | area, modal_handler_add, temp_override, window |

## Auto Unwrap

**BLOCKED_PENDING_LICENSE_REVIEW** · UV, unwrap e bake. Há builds por plataforma. Confirmar binários, licença e critérios de UV.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| bd6759b04dfc | — | [1, 3, 3] / [4, 2, 0]; [1, 6, 0] / [3, 6, 0] | 16 / 16 | autounwrap.bake, autounwrap.cancel_job, autounwrap.card, autounwrap.from_uv, autounwrap.garment_seams, autounwrap.merge_parts | Popen, area, draw_handler_add, handlers, modal_handler_add, region, temp_override, timers, window |
| de1854ba69f3 | — | [1, 3, 3] / [4, 2, 0]; [1, 6, 0] / [3, 6, 0] | 16 / 16 | autounwrap.bake, autounwrap.cancel_job, autounwrap.card, autounwrap.from_uv, autounwrap.garment_seams, autounwrap.merge_parts | Popen, area, draw_handler_add, handlers, modal_handler_add, region, temp_override, timers, window |
| e879e1c9e79d | — | [1, 3, 3] / [4, 2, 0]; [1, 6, 0] / [3, 6, 0] | 16 / 16 | autounwrap.bake, autounwrap.cancel_job, autounwrap.card, autounwrap.from_uv, autounwrap.garment_seams, autounwrap.merge_parts | Popen, area, draw_handler_add, handlers, modal_handler_add, region, temp_override, timers, window |

## Auto-Rig Pro

**BLOCKED_PENDING_LICENSE_REVIEW** · Auto-rig, retarget e exportação. Direitos mistos e requisitos por release. Conferir mapeamento, rig de saída e perfis.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 23bbec7eefb9 | 3.76.43 / 2.8.0 | [3, 76, 43] / [4, 2, 0] | 67 / 68 | arp.actions_linker, arp.actions_linker_add, arp.actions_linker_add_action, arp.actions_linker_remove, arp.actions_linker_remove_action, arp.actions_list_add | area, draw_handler_add, eval, exec, handlers, modal_handler_add, region |

## Auto-Rig Pro Tools

**ADAPT** · Root motion e operações de rig. Validar contexto de bone, constraint e Action.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| baec4eee4a5f | 3.76.31 / 2.8.0 | [3, 76, 31] / [2, 80, 0] | 6 / 6 | arp.childof_keyer, arp.childof_switcher, arp.clear_root_motion, arp.convert_rot_mode, arp.delete_bone_collec, arp.extract_root_motion | area, handlers |

## Auto-Rig Pro: Quick Rig

**BLOCKED_PENDING_LICENSE_REVIEW** · Adaptação de rigs e mapeamento. Verificar dependência do ARP principal e os perfis de rigs.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| ad7ba19b3589 | 1.26.46 / 2.8.0 | [1, 26, 46] / [2, 80, 0] | 35 / 35 | arp.quick_add_limb, arp.quick_check_for_update, arp.quick_export_mapping, arp.quick_export_preset, arp.quick_freeze_armature, arp.quick_import_mapping | — |

## Bloom Agent

**REFERENCE** · Painel de agente e ponte local. Comparar handoff e jobs existentes. Código indica bridge local e clientes remotos. Preservar limites de autorização e usar a arquitetura Forge existente.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 0f76d09b2700 | 0.4.2 / 4.2.0 | [0, 4, 2] / [4, 0, 0] | 11 / 11 | bloom.add_key, bloom.bridge_refresh, bloom.bridge_toggle, bloom.clear_log, bloom.collect_job, bloom.copy_log | exec, temp_override, timers, urlopen |

## Cloth NeXt

**BLOCKED_PENDING_LICENSE_REVIEW** · Tecido, pinning e colisões. Manifesto GPL para código, pacote Windows com executável. Rever termos e teste de cache.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 863786ef7006 | 2.4.0 / 5.0.0 | — | 126 / 126 | clothnext.add_advanced_pin_target, clothnext.add_friction_region, clothnext.add_motion_override, clothnext.add_physics, clothnext.add_soft_constraint, clothnext.addon_open_extensions | Popen, area, draw_handler_add, handlers, modal_handler_add, region, socket, temp_override, timers, urlopen |

## CTools Braids

**REFERENCE** · Tranças por Geometry Nodes. Handoff para orientação, guias e edição manual. Validar malha derivada e instâncias.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 9785e7ab47d2 | — | [5, 1, 1] / [3, 0, 3] | 1 / 1 | sna.add_braids_dc824, sna.convert_uv_attr_2f19d, sna.convertattribute_0c40b, sna.open_link_53ce0, sna.realizeobject_002d8 | eval, exec |

## Dovetail Key

**MANUAL** · Cortes e encaixes geométricos. Prever seleção, desenho e revisão manual.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 472fe3adabf0 | 5.0.1 / 4.2.0 | [5, 0, 1] / [3, 0, 0] | 1 / 1 | mk.clear_cuts, mk.explode, mk.explode_reset, mk.line_slice, mk.recessed_seam, mk.section_dovetail | area, draw_handler_add, modal_handler_add, region, temp_override, window |

## glTF 2.0 legado

**ADAPT** · Importação e exportação GLB/glTF. Cópias legadas nos bundles de rig. Preferir a versão do exportador que acompanha o Blender selecionado.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 6786dcbb8f1a | — | [3, 6, 28] / [3, 5, 0] | 116 / 116 | export_scene.gltf, import_scene.gltf, node.gltf_settings_node_operator, scene.gltf2_animation_apply, scene.gltf2_assign_as_original, scene.gltf2_assign_to_variant | window |
| 3fbdc639d635 | — | [4, 0, 44] / [4, 0, 0] | 115 / 115 | export_scene.gltf, import_scene.gltf, node.gltf_settings_node_operator, scene.gltf2_animation_apply, scene.gltf2_assign_as_original, scene.gltf2_assign_to_variant | window |
| 261e4df0da3c | — | [4, 1, 63] / [4, 1, 0] | 113 / 113 | export_scene.gltf, import_scene.gltf, node.gltf_settings_node_operator, scene.gltf2_action_filter_refresh, scene.gltf2_animation_apply, scene.gltf2_assign_as_original | socket, window |

## Goo Physics

**REFERENCE** · Física de tecido e Geometry Nodes. Registrar operadores de colisão e conferir viabilidade de bake.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 8893ae03b3ce | — | [1, 0, 0] / [4, 1, 0] | 5 / 5 | goophys.add_cloth_physics_to_selected, goophys.add_collider, goophys.add_geonodes_physics_to_selected, goophys.add_jiggle_physics_to_selected, goophys.add_preset, goophys.add_soft_physics_to_selected | — |

## HairCard Studio

**BLOCKED_PENDING_LICENSE_REVIEW** · Hair cards, materiais e atlas. Versões de embalagem 1.0, 1.1 e 1.5 declaram internamente 1.0. Testar alfa e UV com assets próprios.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 20349c50f787 | 1.0.0 / 4.2.0 | [1, 0] / [4, 0, 0] | 2 / 2 | hairecard.open_haircards_file, hairecard.set_modification_mode, hairecard.set_render_percentage_and_render | handlers, timers |
| 6bd0c9913cd8 | 1.0.0 / 4.2.0 | [1, 0] / [4, 0, 0] | 2 / 2 | hairecard.open_haircards_file, hairecard.set_modification_mode, hairecard.set_render_percentage_and_render | handlers, timers |
| 766d1aee9cb5 | 1.0.0 / 4.2.0 | [1, 0] / [4, 0, 0] | 2 / 2 | hairecard.delete_preset, hairecard.load_preset, hairecard.open_haircards_file, hairecard.render_image, hairecard.save_preset, hairecard.set_modification_mode | handlers, timers |

## JiggleGen

**ADAPT** · Movimento secundário de ossos. Distinguir configuração de cadeia e bake. Verificar fixture de ossos.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 77da8574c59d | 2.0.0 / 3.2.0 | [2, 0, 0] / [3, 2, 0] | 24 / 24 | jigglegen.add_curve_tools, jigglegen.bake_all, jigglegen.batch_add, jigglegen.batch_remove, jigglegen.clear_bakes, jigglegen.clear_report | Popen, area, temp_override |

## JiggleMaker

**ADAPT** · Simulação secundária de malha. Comparar 2.0.0 e 2.2.2. Colisores e grupos de vértices são entradas.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 1d19ec88bc85 | 2.0.0 / 4.0.0 | [2, 0, 0] / [4, 0, 0] | 27 / 27 | object.add_collision, object.add_preset_object, object.select_vertex_group, wm.bind_proxy, wm.boob_magic, wm.boobabig | handlers, modal_handler_add, temp_override, window |
| 3905b80117a1 | 2.2.2 / 4.0.0 | [2, 2, 2] / [4, 0, 0] | 27 / 27 | object.add_collision, object.add_preset_object, object.select_vertex_group, wm.bind_proxy, wm.boob_magic, wm.boobabig | handlers, modal_handler_add, temp_override, window |

## Magic Bone UE5 Rig Creator Pro

**BLOCKED_PENDING_LICENSE_REVIEW** · Rig para Unreal. Verificar esqueleto, eixos, ferramentas e licença da release.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| b1bb4f01dcc8 | — | [3, 0, 9] / [4, 0, 0] | 22 / 22 | addonname.myop_operator, addonname.myop_operator2, adjustment.myop_operator, adjustmentsaver.myop_operator, animposeo.m_operator, animrigin.myop_operator | region |

## MMD Tools

**ADAPT** · Conversão PMD/PMX, VMD e VPD. Verificar wheel, Joints, morphs e materiais. Direitos do modelo são independentes.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 2b8805ab766e | 4.5.14 / 4.2.0 | — | 81 / 81 | mmd_tools.apply_additional_transform, mmd_tools.apply_bone_morph, mmd_tools.apply_bone_morph_offset, mmd_tools.apply_material_morph_offset, mmd_tools.apply_uv_morph, mmd_tools.assemble_all | area, handlers, region, temp_override, window |

## MPFB

**ADAPT** · Autoria de humanoides e rigs. Usar API explícita em fixture de parâmetros e IDs. Conferir dados core CC0 e termos de complementos.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 5818a08493af | 2.0.15 / 4.2.0 | — | 505 / 505 | mpfb.add_corrective_smooth, mpfb.add_custom_rig, mpfb.add_helpers, mpfb.add_rigify_rig, mpfb.add_standard_rig, mpfb.apply_fur_operator | area, region, temp_override, timers |

## PaletteGrid

**MANUAL** · Paletas e organização de cor. Fluxo manual com UI e clipboard.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 9ddadd2f70b9 | 1.3.0 / 4.2.0 | — | 41 / 41 | bgui.enable_interaction, palette.eyedrop, palette_grid.copy_strip, palette_grid.drag_stop, palette_grid.export_palette, palette_grid.import_palette | area, draw_handler_add, handlers, modal_handler_add, region, temp_override, timers, window |

## Professional Hair Suite

**BLOCKED_PENDING_LICENSE_REVIEW** · Conversão de cards e direção dos fios. Três módulos, com requisitos Blender distintos. Conferir topologia, UV e transparência.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 7dc22b3e3467 | — | [1, 0] / [4, 1, 0]; [1, 0] / [4, 0, 0]; [1, 0] / [4, 0, 0] | 3 / 3 | hairdir.align, object.haircards_to_lines | — |

## Projection modeling

**MANUAL** · Modelagem por projeção. Verificar câmera, seleção e contexto dos operadores.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| b5fa9722076d | — | [1, 1, 4] / [3, 6, 0] | 1 / 1 | sna.add__objects_projection1_a4336, sna.apply_6bcbb, sna.bevel_control_projection_98a23, sna.bevel_curve_14cd3, sna.blender_market_link_c384f, sna.boosty_ff383 | eval, exec |

## Proxy Picker

**MANUAL** · Seleção e interface de controles de rig. Usar como operação manual.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 36ddc671ae0a | 1.1.10 / 2.8.0 | [1, 1, 10] / [2, 80, 0] | 2 / 2 | pp.add_button, pp.auto_proxy, pp.delete_proxy | exec, handlers |

## RetopoFlow

**MANUAL** · Retopologia interativa. Usar handoff manual de topologia e validar malha após a edição.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 655980638622 | 4.0.2 / 4.2.0 | [4, 0, 2] / [4, 2, 0] | 213 / 213 | cgcookie.retopoflow, cgcookie.retopoflow_cleardebugging, cgcookie.retopoflow_continue_active, cgcookie.retopoflow_disabledebugging, cgcookie.retopoflow_enabledebugging, cgcookie.retopoflow_end_background_check | area, draw_handler_add, eval, exec, handlers, modal_handler_add, region, socket, temp_override, timers, urlopen, window |

## RLX Auto Fit

**BLOCKED_PENDING_LICENSE_REVIEW** · Ajuste de roupas e modificadores. Há três variantes de Blender. Verificar interseção e deformação em pose.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 3d5838b93561 | — | [1, 6, 0] / [3, 6, 19]; [1, 6, 0] / [4, 2, 5]; [1, 6, 0] / [4, 3, 2] | 3 / 3 | object.rlx_apply_fitting_modifiers, object.rlx_apply_modifiers_to_selected, object.rlx_create_array, object.rlx_join_objects, object.rlx_join_objects_per_body, object.rlx_perform_data_transfer | — |

## Sanctus-Library

**BLOCKED_PENDING_LICENSE_REVIEW** · Biblioteca de materiais procedurais. Registrar direitos por recurso, dependências de biblioteca e bake PBR.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 1d32a4acaa1d | — | [3, 2, 1] / [4, 0, 0] | 240 / 240 | — | area, draw_handler_add, eval, handlers, modal_handler_add, region, temp_override, timers, window |

## Seamless CAD

**BLOCKED_PENDING_LICENSE_REVIEW** · Modelagem por curvas, lofts e superfície. Há pacotes por plataforma e divergência entre rótulo e metadado. Rever dependências e UI.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 1b2ab66d0c58 | — | [8, 1, 5, 4] / [4, 2, 0] | 94 / 94 | seamless.add_curve_point, seamless.add_curve_point_at, seamless.add_dynamic_loft_hole, seamless.add_part, seamless.add_primitive, seamless.bake_mesh | Popen, area, draw_handler_add, handlers, modal_handler_add, region, socket, timers, window |
| 5b6d7813a5ec | — | [8, 1, 5, 3] / [4, 2, 0] | 94 / 94 | seamless.add_curve_point, seamless.add_curve_point_at, seamless.add_dynamic_loft_hole, seamless.add_part, seamless.add_primitive, seamless.bake_mesh | Popen, area, draw_handler_add, handlers, modal_handler_add, region, socket, timers, window |
| 7107e064b77c | — | [8, 1, 5, 1] / [4, 2, 0] | 96 / 96 | seamless.add_curve_point, seamless.add_curve_point_at, seamless.add_dynamic_loft_hole, seamless.add_part, seamless.add_primitive, seamless.bake_mesh | Popen, area, draw_handler_add, handlers, modal_handler_add, region, socket, timers, window |
| 20c917285dba | — | [8, 1, 5, 2] / [4, 2, 0] | 94 / 94 | seamless.add_curve_point, seamless.add_curve_point_at, seamless.add_dynamic_loft_hole, seamless.add_part, seamless.add_primitive, seamless.bake_mesh | Popen, area, draw_handler_add, handlers, modal_handler_add, region, socket, timers, window |
| 1f282f977c7d | — | [8, 1, 5, 4] / [4, 2, 0] | 94 / 94 | seamless.add_curve_point, seamless.add_curve_point_at, seamless.add_dynamic_loft_hole, seamless.add_part, seamless.add_primitive, seamless.bake_mesh | Popen, area, draw_handler_add, handlers, modal_handler_add, region, socket, timers, window |
| 61f92ff62671 | — | [8, 1, 5, 4] / [4, 2, 0] | 94 / 94 | seamless.add_curve_point, seamless.add_curve_point_at, seamless.add_dynamic_loft_hole, seamless.add_part, seamless.add_primitive, seamless.bake_mesh | Popen, area, draw_handler_add, handlers, modal_handler_add, region, socket, timers, window |

## SKkeeper

**ADAPT** · Aplicação de modifiers preservando shape keys. Medir chaves, deltas e triangulação após a operação.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 5191ab471e20 | 1.8.2 / 4.2.0 | [1, 8, 1] / [2, 80, 3] | 1 / 1 | sk.apply_mods_choice_sk, sk.apply_mods_sk, sk.apply_subd_sk | — |

## SpeedSculpt

**MANUAL** · Escultura, brushes e primitivas. Contexto de sculpt e viewport. Medir topologia após handoff.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| e9f3ad6e26f8 | — | [0, 3, 8] / [4, 3, 0] | 18 / 18 | object.activate_brush, object.add_custom_metaballs, object.add_custom_primitives, object.add_extract_mask, object.add_gp_bevel, object.add_lattice | Popen, area, draw_handler_add, handlers, modal_handler_add, region, temp_override, timers, urlopen, window |

## SpringFX

**BLOCKED_PENDING_LICENSE_REVIEW** · Efeitos de mola e animação. Manifesto 8.2.4 e bl_info 8.2.3. Isolar os binários e confirmar o ambiente.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| d99d1bf4c2eb | 8.2.4 / 4.5.0 | [8, 2, 3] / [4, 2, 0] | 9 / 9 | sb.action_to_nla, sb.add_effect_group, sb.add_physics, sb.auto_setup_collisions, sb.auto_tune_length, sb.bake | draw_handler_add, handlers |

## SquishyFX

**ADAPT** · Deformação secundária e bake. Manter 3.3.0 e 3.40.0 distintos, verificar handlers, repetibilidade e colisão.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| a5e0c6a272ea | — | [3, 3, 0] / [4, 2, 0] | 7 / 7 | squishyfx.add_collider_sphere, squishyfx.apply_effect, squishyfx.apply_preset, squishyfx.bake_current_frame, squishyfx.bake_shapekeys, squishyfx.delete_preset | handlers |
| fa286809c720 | 3.40.0 / 4.2.0 | [3, 40, 0] / [4, 2, 0] | 17 / 17 | squishyfx.add_collider, squishyfx.add_collider_sphere, squishyfx.apply_effect, squishyfx.apply_preset, squishyfx.auto_squish, squishyfx.auto_squish_remove | area, handlers, modal_handler_add, region, temp_override, timers, window |

## Stylized Asset Suite for Blender

**BLOCKED_PENDING_LICENSE_REVIEW** · Materiais e efeitos estilizados. Embalagem 4.0 Pro e bl_info 1.0. Direitos dos presets e bake por recurso.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 9bc8e0354341 | — | [1, 0] / [4, 1, 1] | 1 / 1 | shaderaddon.addao, shaderaddon.addbluelight, shaderaddon.addbrushstrokes, shaderaddon.addcircularlight, shaderaddon.addcloudstexture, shaderaddon.addcoloredcircularlight | handlers, timers |

## SUPERTABs

**NOT RECOMMENDED** · Organização da interface Blender. Útil na bancada do artista. Sem etapa de produção correspondente no Bridge.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 8b425b0f1eff | — | [1, 3, 0] / [4, 2, 0] | 45 / 45 | st.activate_quick_shortcut, st.add_addon_to_preset, st.add_favorite_preset, st.add_item_to_favorite_preset, st.add_items_to_preset_dialog, st.add_node_to_favorites | area, handlers, region, temp_override, timers, window |

## TrueSKY

**RESEARCH ONLY** · Céu e iluminação de cena. Identidade do add-on Blender confirmada pelo manifesto. Comparar somente materiais com direitos identificados.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 9086dbc8aeb8 | 3.0.3 / 5.1.0 | — | 196 / 196 | true_sky.add_world, true_sky.align_gps_to_body, true_sky.align_local_positioning_to_body, true_sky.apply_positioning_to_body, true_sky.apply_preset, true_sky.apply_settings_all_cameras | Popen, area, draw_handler_add, eval, handlers, modal_handler_add, region, socket, temp_override, timers, window |

## Voxel Heat Diffuse Skinning

**BLOCKED_PENDING_LICENSE_REVIEW** · Pesos por voxels. Exige confirmação dos executáveis auxiliares e seus termos. Testar skin e normalização em fixture própria.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| eb1bff2aa42d | — | [3, 5, 3] / [2, 80, 0] | 8 / 8 | export_voxel.bone, export_voxel.mesh, import_voxel.weight, wm.corrective_smooth_baker, wm.joint_alignment_tool_surface, wm.joint_alignment_tool_volume | exec, modal_handler_add, window |

## VRM format

**REUSE** · Importação e exportação VRM e VRMA. Reutilizar como ferramenta externa após prova de versões e perfil. Validar humanoid, morphs e direitos do avatar.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 5ec972ae3553 | 4.10.2 / 4.2.0 | [4, 10, 2] / [2, 93, 0] | 143 / 143 | export_scene.vrm, export_scene.vrma, icyp.make_basic_armature, import_scene.vrm, import_scene.vrma, vrm.add_khr_xmp_json_ld_packet_dc_creator | handlers, timers |

## Wiggle Bone

**REFERENCE** · Movimento secundário no tutorial estilizado. Namespace e proveniência distintos do Wiggle Bones. Técnica de referência.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 803364884f6a | — | [1, 5, 0] / [2, 80, 0] | 1 / 1 | id.bake_wiggle, id.reset_wiggle, id.select_wiggle | area, handlers |

## Wiggle Bones

**ADAPT** · Movimento secundário de ossos e bake. Comparar clip sem handlers persistentes. Add-on de tutorial com ID próprio é uma família distinta.

| SHA-256 inicial | Manifesto versão / Blender | Versões legadas / Blender | Python lidos / declarados | Exemplos de operadores | Marcadores de UI, subprocesso ou rede |
| --- | --- | --- | --- | --- | --- |
| 0afa23998720 | 1.1.2 / 4.5.0 | — | 6 / 6 | wiggle.bake, wiggle.cleanup, wiggle.copy, wiggle.rebuild, wiggle.reset, wiggle.select | handlers |
