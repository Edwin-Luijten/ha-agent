from ha_agent.tools.ui import UIBuffer, make_ui_tools


def test_render_ui_appends_component() -> None:
    buf = UIBuffer()
    tools = make_ui_tools(buf)
    result = tools.render_ui("entity_card", {"entity_id": "light.hallway"})
    assert result["status"] == "ok"
    assert len(buf.components) == 1
    assert buf.components[0].kind == "entity_card"
    assert buf.components[0].props == {"entity_id": "light.hallway"}


def test_render_ui_rejects_unknown_kind() -> None:
    buf = UIBuffer()
    tools = make_ui_tools(buf)
    result = tools.render_ui("laser_cannon", {})
    assert result["status"] == "error"


def test_render_ui_validates_confirmation_props() -> None:
    buf = UIBuffer()
    tools = make_ui_tools(buf)
    ok = tools.render_ui("confirmation", {"prompt": "zal ik?", "action_id": "x"})
    assert ok["status"] == "ok"
    missing = tools.render_ui("confirmation", {"prompt": "zal ik?"})
    assert missing["status"] == "error"
