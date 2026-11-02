import unittest
from types import SimpleNamespace

from scripts.blender_spritesheet import matching_actions


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


if __name__ == "__main__":
    unittest.main()
