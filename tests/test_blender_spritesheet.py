import unittest
from types import SimpleNamespace

from pathlib import Path

from scripts.blender_spritesheet import disable_autoexec, import_source, matching_actions


def fake_blender(action_names):
    actions = [SimpleNamespace(name=name) for name in action_names]
    armature = SimpleNamespace(type="ARMATURE")
    return SimpleNamespace(
        data=SimpleNamespace(actions=actions),
        context=SimpleNamespace(scene=SimpleNamespace(objects=[armature])),
    )


class BlenderActionResolutionTest(unittest.TestCase):
    def test_idle_walk_run_accept_case_resolves_case_insensitively(self):
        bpy = fake_blender(["mixamo|Idle", "Walk", "Run"])
        result = matching_actions(bpy, ["idle", "WALK", "run"])
        self.assertEqual([name for name, _action in result], ["idle", "WALK", "run"])
        self.assertEqual([action.name for _name, action in result], ["mixamo|Idle", "Walk", "Run"])

    def test_partial_name_matches_whole_tokens_not_substrings(self):
        bpy = fake_blender(["Mixamo|Walk Forward", "Running"])
        result = matching_actions(bpy, ["walk"])
        self.assertEqual(result[0][1].name, "Mixamo|Walk Forward")
        with self.assertRaisesRegex(RuntimeError, "Não encontrei"):
            matching_actions(bpy, ["run"])

    def test_ambiguous_action_names_are_rejected(self):
        bpy = fake_blender(["Walk Forward", "Walk Backward"])
        with self.assertRaisesRegex(RuntimeError, "ambígua"):
            matching_actions(bpy, ["walk"])

    def test_two_requests_cannot_silently_select_the_same_action(self):
        bpy = fake_blender(["Idle"])
        with self.assertRaisesRegex(RuntimeError, "use nomes únicos"):
            matching_actions(bpy, ["Idle", "idle"])


def fake_bpy_for_file(autorun: bool):
    """bpy mínimo: preferências com Auto Run e um ops que registra chamadas."""
    opened = []
    filepaths = SimpleNamespace(use_file_autorun=autorun)
    ops = SimpleNamespace(wm=SimpleNamespace(open_mainfile=lambda filepath: opened.append(filepath)))
    return (
        SimpleNamespace(
            context=SimpleNamespace(preferences=SimpleNamespace(filepaths=filepaths)),
            ops=ops,
        ),
        filepaths,
        opened,
    )


class BlenderAutoexecGuardTest(unittest.TestCase):
    """Abrir um .blend de origem desconhecida não pode executar código embutido.

    O processo é iniciado com --disable-autoexec (ver
    tests/blender-adapter-smoke.cjs e tests/blender-workflow-plan-smoke.cjs);
    estes testes cobrem a segunda camada, dentro do script.
    """

    def test_opening_blend_disables_autorun_before_reading_the_file(self):
        bpy, filepaths, opened = fake_bpy_for_file(autorun=True)
        import_source(bpy, Path("input/modelo.blend"))
        self.assertFalse(filepaths.use_file_autorun, "Auto Run precisa ficar desligado")
        self.assertEqual(opened, ["input/modelo.blend"], "o arquivo é aberto depois da guarda")

    def test_autorun_already_disabled_still_opens_the_file(self):
        bpy, filepaths, opened = fake_bpy_for_file(autorun=False)
        import_source(bpy, Path("input/modelo.blend"))
        self.assertFalse(filepaths.use_file_autorun)
        self.assertEqual(opened, ["input/modelo.blend"])

    def test_unreadable_preferences_refuse_to_open_the_file(self):
        opened = []
        bpy = SimpleNamespace(
            context=SimpleNamespace(preferences=None),
            ops=SimpleNamespace(wm=SimpleNamespace(open_mainfile=lambda filepath: opened.append(filepath))),
        )
        with self.assertRaisesRegex(RuntimeError, "Não consegui ler as preferências"):
            import_source(bpy, Path("input/modelo.blend"))
        self.assertEqual(opened, [], "nada é aberto quando a guarda não pode conferir")

    def test_readonly_preference_that_stays_on_refuses_to_open_the_file(self):
        opened = []

        class FrozenFilepaths:
            use_file_autorun = True

            def __setattr__(self, name, value):
                raise AttributeError("preferências somente leitura")

        bpy = SimpleNamespace(
            context=SimpleNamespace(preferences=SimpleNamespace(filepaths=FrozenFilepaths())),
            ops=SimpleNamespace(wm=SimpleNamespace(open_mainfile=lambda filepath: opened.append(filepath))),
        )
        with self.assertRaisesRegex(RuntimeError, "não pôde ser desativada"):
            import_source(bpy, Path("input/modelo.blend"))
        self.assertEqual(opened, [], "recusa em vez de abrir com Auto Run ligado")

    def test_preference_that_ignores_the_change_refuses_to_open_the_file(self):
        class StubbornFilepaths:
            use_file_autorun = True

            def __setattr__(self, name, value):
                return None  # aceita a escrita sem mudar nada

        bpy, _filepaths, opened = fake_bpy_for_file(autorun=True)
        bpy.context.preferences.filepaths = StubbornFilepaths()
        with self.assertRaisesRegex(RuntimeError, "continua ligada"):
            import_source(bpy, Path("input/modelo.blend"))
        self.assertEqual(opened, [])

    def test_non_blend_formats_do_not_open_a_mainfile(self):
        bpy, _filepaths, opened = fake_bpy_for_file(autorun=True)
        imported = []
        bpy.ops.import_scene = SimpleNamespace(gltf=lambda filepath: imported.append(filepath))
        import_source(bpy, Path("input/modelo.glb"))
        self.assertEqual(opened, [], "open_mainfile só existe para .blend")
        self.assertEqual(imported, ["input/modelo.glb"])

    def test_disable_autoexec_reports_when_it_had_to_turn_the_preference_off(self):
        bpy, filepaths, _opened = fake_bpy_for_file(autorun=True)
        disable_autoexec(bpy)
        self.assertFalse(filepaths.use_file_autorun)


if __name__ == "__main__":
    unittest.main()
