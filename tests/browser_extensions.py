"""Regression and feature checks for the 2.1 iteration.

Full HTTP mode additionally verifies actual JSON/CSV/PNG downloads. In-memory
mode intentionally makes no claim about native downloads or browser persistence.
"""
import csv
import io
import json


def extended_checks(page, check, require, diagnostics, settle, choose_preset,
                    edit_number, drag_object, in_memory, output):
    def slider(selector, value):
        page.eval_on_selector(selector, """(element,value) => {
          element.value=value; element.dispatchEvent(new Event('input', {bubbles:true}));
          element.dispatchEvent(new Event('change', {bubbles:true}));
        }""", str(value))
        settle(page)

    choose_preset(page)
    before = diagnostics(page)["field"]["jobs"]
    page.eval_on_selector("#frequency", """e => {
      for(let i=100;i<150;i++) { e.value=i; e.dispatchEvent(new Event('input',{bubbles:true})); }
      e.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    settle(page)
    check("50 synchronous source edits coalesce into one field request", lambda: require(
        diagnostics(page)["field"]["jobs"] == before + 1))
    before = diagnostics(page)
    slider("#phase", 90)
    check("energy-mode phase edits reuse the field and exact probe cache", lambda: require(
        diagnostics(page)["field"]["jobs"] == before["field"]["jobs"] and
        diagnostics(page)["probeComputations"] == before["probeComputations"]))

    choose_preset(page, "immersive")
    page.click("#mode-3d")
    page.click('.source-row[data-id="9"]')
    settle(page)
    check("7.1.4 layout contains twelve sources with four downward-aimed height speakers", lambda: require(
        len(diagnostics(page)["scene"]["speakers"]) == 12 and
        len([s for s in diagnostics(page)["scene"]["speakers"] if s["y"] > 2 and s["pitch"] < 0]) == 4))
    before = diagnostics(page)["field"]["jobs"]
    slider("#pitch", -60)
    check("source tilt updates the three-dimensional acoustic field", lambda: require(
        diagnostics(page)["scene"]["speakers"][8]["pitch"] == -60 and
        diagnostics(page)["field"]["jobs"] == before + 1))
    page.click("#solo")
    page.click("#audio-toggle")
    page.wait_for_function("window.__diagnostics().audio.state === 'running'")
    settle(page)
    check("solo applies consistently to active audio voices", lambda: require(
        diagnostics(page)["audio"]["voices"] == 1 and diagnostics(page)["scene"]["speakers"][8]["solo"]))
    page.click("#mute")
    page.wait_for_timeout(150)
    settle(page)
    check("mute overrides solo without making excluded sources audible", lambda: require(
        diagnostics(page)["audio"]["voices"] == 0 and "∞" in page.inner_text("#listener-reading")))
    page.click("#mute")
    page.click("#solo")
    settle(page)
    check("clearing solo restores the twelve-source layout", lambda: require(diagnostics(page)["audio"]["voices"] == 12))
    page.click("#select-listener")
    settle(page)
    before = diagnostics(page)
    slider("#pitch", 45)
    check("listener head tilt updates audio without recomputing scalar acoustics", lambda: require(
        diagnostics(page)["audio"]["parameterWrites"] > before["audio"]["parameterWrites"] and
        diagnostics(page)["field"]["jobs"] == before["field"]["jobs"] and
        diagnostics(page)["probeComputations"] == before["probeComputations"]))
    page.click("#audio-toggle")
    page.wait_for_function("window.__diagnostics().audio.state === 'suspended'")

    page.click("#path-inspector > summary")
    settle(page)
    check("all-source arrival table is capped with an explicit full-export count", lambda: require(
        page.locator("#path-table tbody tr").count() == 48 and
        "48 of 84" in page.inner_text("#path-inspector [data-path-count]")))
    page.click('.source-row[data-id="9"]')
    settle(page)
    check("selected-source arrivals contain exact sorted direct and reflection paths", lambda: require(
        page.locator("#path-table tbody tr").count() == 7 and
        "Top LF" in page.inner_text("#path-inspector [data-summary]")))
    page.screenshot(path=str(output / "height-layout-3d.png"), full_page=True)
    before = diagnostics(page)
    box = page.locator("#scene").bounding_box()
    page.mouse.move(box["x"] + 30, box["y"] + box["height"] - 90)
    page.mouse.down()
    page.mouse.move(box["x"] + 90, box["y"] + box["height"] - 60, steps=6)
    page.mouse.up()
    settle(page)
    check("orbit preserves listener report cache and schedules no audio writes", lambda: require(
        diagnostics(page)["probeComputations"] == before["probeComputations"] and
        diagnostics(page)["audio"]["parameterWrites"] == before["audio"]["parameterWrites"]))

    choose_preset(page)
    page.select_option("#snap-grid", "0.5")
    drag_object(page, "1", 31, 18)
    target = diagnostics(page)["scene"]["speakers"][0]
    check("plan pointer dragging snaps X and Z without changing height", lambda: require(
        abs(target["x"] / .5 - round(target["x"] / .5)) < 1e-8 and
        abs(target["z"] / .5 - round(target["z"] / .5)) < 1e-8 and target["y"] == 1.2))
    page.click("#mode-3d")
    settle(page)
    before = diagnostics(page)["scene"]["speakers"][0]
    page.keyboard.down("Alt")
    drag_object(page, "1", 25, -35)
    page.keyboard.up("Alt")
    after = diagnostics(page)["scene"]["speakers"][0]
    check("Alt-drag in 3D adjusts only height and respects snapping", lambda: require(
        after["x"] == before["x"] and after["z"] == before["z"] and after["y"] > before["y"] and
        abs(after["y"] / .5 - round(after["y"] / .5)) < 1e-8))
    before = after
    page.locator("#scene").focus()
    page.keyboard.down("PageDown")
    page.wait_for_timeout(130)
    page.keyboard.up("PageDown")
    settle(page)
    check("Page Down moves the selected source vertically", lambda: require(
        diagnostics(page)["scene"]["speakers"][0]["y"] < before["y"]))

    choose_preset(page)
    page.check("#edit-room")
    settle(page)
    corner = diagnostics(page)["corners"][0]
    box = page.locator("#scene").bounding_box()
    page.mouse.move(box["x"] + corner["x"], box["y"] + corner["y"])
    page.mouse.down()
    page.mouse.move(box["x"] + corner["x"] + 35, box["y"] + corner["y"] + 25, steps=5)
    page.wait_for_timeout(80)
    during = diagnostics(page)["corners"][0]
    check("room-corner drag keeps projection fixed under the pointer", lambda: require(
        abs(during["x"] - corner["x"] - 35) < 1.1 and abs(during["y"] - corner["y"] - 25) < 1.1))
    page.mouse.up()
    settle(page)

    # A slow File.text completion must not undo a newer preset/load decision.
    payload = json.dumps(diagnostics(page)["scene"])
    page.evaluate("""() => {
      window.__originalFileText = File.prototype.text;
      File.prototype.text = function() {
        if(this.name==='slow.json') return new Promise(resolve => window.__finishSlowImport = resolve);
        return window.__originalFileText.call(this);
      };
    }""")
    page.set_input_files("#import-file", {"name": "slow.json", "mimeType": "application/json", "buffer": payload.encode()})
    page.wait_for_function("typeof window.__finishSlowImport === 'function'")
    choose_preset(page, "empty")
    page.evaluate("payload => { window.__finishSlowImport(payload); File.prototype.text=window.__originalFileText; }", payload)
    settle(page)
    check("a stale asynchronous import cannot overwrite a newer preset", lambda: require(
        len(diagnostics(page)["scene"]["speakers"]) == 0))
    before = diagnostics(page)["scene"]
    page.set_input_files("#import-file", {"name": "large.json", "mimeType": "application/json", "buffer": b" " * (129 * 1024)})
    page.wait_for_timeout(100)
    check("oversized imports are rejected without modifying the current scene", lambda: require(
        diagnostics(page)["scene"] == before and "128 KiB" in page.inner_text("#toast")))

    # Check actual oscillator output at staggered start times and with a non-180°
    # source phase plus propagation delay, not just the trivial inverted pair.
    rendered = page.evaluate("""async inMemory => {
      const Engine = inMemory ? AudioEngine : (await import('./src/audio.js')).AudioEngine;
      async function render(sources) {
        const ctx=new OfflineAudioContext(1,48000,48000), engine=new Engine(); engine.context=ctx;
        for(const [phase,start,delay] of sources) {
          const input=ctx.createGain(), d=ctx.createDelay(); input.gain.value=.25; d.delayTime.value=delay;
          input.connect(d).connect(ctx.destination); engine.makeOscillator({input},{frequency:440,phase},start);
        }
        const data=(await ctx.startRendering()).getChannelData(0);
        let sum=0; for(let i=24000;i<48000;i++) sum+=data[i]**2; return Math.sqrt(sum/24000);
      }
      return {single:await render([[0,.015,0]]),staggered:await render([[0,.015,0],[0,.127,0]]),
              delayed:await render([[0,.015,.01],[90,.127,.011]])};
    }""", in_memory)
    import math
    expected = math.sqrt(2 + 2 * math.cos(math.pi / 2 - 2 * math.pi * 440 * .001))
    check("native offline oscillators stay coherent when introduced at different times", lambda: require(
        abs(rendered["staggered"] / rendered["single"] - 2) < .002))
    check("native nontrivial phase plus delay matches the analytical pressure sum", lambda: require(
        abs(rendered["delayed"] / rendered_single(rendered) - expected) < .005))

    choose_preset(page)
    if not in_memory:
        with page.expect_download() as info:
            page.click("#export")
        download = info.value
        json_path = output / "exported-scene.json"
        download.save_as(str(json_path))
        scene = json.loads(json_path.read_text())
        check("native JSON export preserves the validated scene schema", lambda: require(
            scene["version"] == 2 and len(scene["speakers"]) == 4 and "pitch" in scene["speakers"][0]))
        # The section remains open after the previous arrival tests.
        if not page.locator("#path-inspector").evaluate("e=>e.open"):
            page.click("#path-inspector > summary")
        settle(page)
        with page.expect_download() as info:
            page.click("#export-paths")
        csv_path = output / "exported-arrivals.csv"
        info.value.save_as(str(csv_path))
        rows = list(csv.DictReader(io.StringIO(csv_path.read_text())))
        check("native CSV download contains all seven selected-source arrivals", lambda: require(
            len(rows) == 7 and all(float(row["arrival_ms"]) > 0 for row in rows)))
        with page.expect_download() as info:
            page.click("#snapshot")
        png_path = output / "exported-view.png"
        info.value.save_as(str(png_path))
        check("native PNG snapshot download has a valid image signature", lambda: require(
            png_path.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"))


def rendered_single(rendered):
    """Keep division assertions explicit and report a zero-render failure clearly."""
    if rendered["single"] <= 0:
        raise AssertionError("Native oscillator produced no samples")
    return rendered["single"]
