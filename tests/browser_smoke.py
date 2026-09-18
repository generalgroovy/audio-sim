"""Optional Chromium integration checks; pip install playwright==1.57.0.

Normal mode uses the real HTTP app, ES modules and module worker. SIM_IN_MEMORY=1
is an explicit restricted-environment fallback: inline the same local source and
mock storage. It does NOT validate HTTP loading, native module loading or storage.
No browser policy is disabled. SIM_BROWSER optionally selects an executable.
"""
from contextlib import contextmanager
from pathlib import Path
import json
import os
import re
import subprocess
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get("SIM_RESULTS", str(ROOT / "test-results")))
IN_MEMORY = os.environ.get("SIM_IN_MEMORY") == "1"
PORT = int(os.environ.get("SIM_TEST_PORT", "8792"))
BASE = os.environ.get("SIM_TEST_BASE", "/")
TEST_URL = f"http://127.0.0.1:{PORT}{BASE}"


@contextmanager
def server():
    process = None
    try:
        if not IN_MEMORY:
            process = subprocess.Popen(["node", "scripts/serve.mjs"], cwd=ROOT,
                                       env={**os.environ, "PORT": str(PORT), "BASE_PATH": BASE},
                                       stdout=subprocess.DEVNULL)
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError("Test HTTP server exited; choose another SIM_TEST_PORT.")
                try:
                    with urllib.request.urlopen(TEST_URL, timeout=1) as reply:
                        if reply.status == 200:
                            break
                except OSError:
                    time.sleep(.05)
            else:
                raise RuntimeError("Test HTTP server did not become ready.")
        yield
    finally:
        if process:
            process.terminate()
            process.wait(timeout=5)


def strip_module(text):
    return re.sub(r"^import .*?;\n", "", text, flags=re.M).replace("export ", "")


def boot(page):
    if IN_MEMORY:
        names = ["model", "acoustics", "audio", "projection", "visual", "view", "field-controller", "analysis", "inspection", "app"]
        source = "\n".join(strip_module((ROOT / "src" / f"{n}.js").read_text()) for n in names)
        worker = "\n".join(strip_module((ROOT / "src" / f"{n}.js").read_text())
                           for n in ["model", "acoustics", "field-worker"])
        source = source.replace("new URL('./field-worker.js', import.meta.url)", "window.__testWorkerURL")
        html = re.sub(r"<script.*?</script>", "", (ROOT / "index.html").read_text(), flags=re.S)
        html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*>', "", html)
        page.set_content(html)
        page.add_style_tag(content=(ROOT / "style.css").read_text())
        page.evaluate("""code => {
          // Explicit test-only storage shim; this is not a native persistence test.
          const store = new Map();
          Object.defineProperty(window, 'localStorage', { configurable:true,
            value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});
          window.__testWorkerURL=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
        }""", worker)
        page.add_script_tag(content=source + "\nwindow.__diagnostics = getDiagnostics;")
    else:
        page.goto(TEST_URL, wait_until="networkidle")
        page.evaluate("async () => { window.__diagnostics = (await import('./src/app.js')).getDiagnostics; }")
    settle(page)


def settle(page):
    page.wait_for_function("window.__diagnostics && !window.__diagnostics().field.busy")
    page.wait_for_timeout(100)


def diagnostics(page):
    return page.evaluate("window.__diagnostics()")


def choose_preset(page, name="reference"):
    page.select_option("#preset", name)
    settle(page)


def edit_number(page, selector, value):
    page.fill(selector, str(value))
    page.locator(selector).blur()
    settle(page)


def drag_object(page, identifier, dx=35, dy=20):
    point = diagnostics(page)["screen"][identifier]
    box = page.locator("#scene").bounding_box()
    x, y = box["x"] + point["x"], box["y"] + point["y"]
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx, y + dy, steps=6)
    page.mouse.up()
    settle(page)


def run():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = []
    with server(), sync_playwright() as playwright:
        launch = {"headless": True}
        if os.environ.get("SIM_BROWSER"):
            launch["executable_path"] = os.environ["SIM_BROWSER"]
        browser = playwright.chromium.launch(**launch)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        boot(page)

        def check(name, assertion):
            assertion()
            results.append(name)
            print(f"PASS {name}", flush=True)

        def require(condition, message="Assertion failed"):
            if not condition:
                raise AssertionError(message)

        check("no audio context or autoplay on startup", lambda: require(
            diagnostics(page)["audio"]["state"] == "not started" and len(diagnostics(page)["scene"]["speakers"]) == 4))
        before = diagnostics(page)
        page.wait_for_timeout(350)
        check("idle scene schedules no more draws, field jobs or audio writes", lambda: require(
            all(diagnostics(page)[k] == before[k] for k in ["draws", "field", "audio"])))
        page.screenshot(path=str(OUTPUT / "2d-desktop.png"), full_page=True)

        before = diagnostics(page)
        page.click("#mode-3d")
        settle(page)
        check("2D to 3D preserves acoustic state without recomputing the map", lambda: require(
            diagnostics(page)["scene"]["speakers"] == before["scene"]["speakers"] and
            diagnostics(page)["field"]["jobs"] == before["field"]["jobs"]))
        page.screenshot(path=str(OUTPUT / "3d-desktop.png"), full_page=True)
        before = diagnostics(page)
        box = page.locator("#scene").bounding_box()
        page.mouse.move(box["x"] + 70, box["y"] + box["height"] - 100)
        page.mouse.down()
        page.mouse.move(box["x"] + 170, box["y"] + box["height"] - 130, steps=6)
        page.mouse.up()
        settle(page)
        after = diagnostics(page)
        check("3D camera orbit leaves listener and cached acoustics unchanged", lambda: require(
            after["scene"]["view"]["yaw"] != before["scene"]["view"]["yaw"] and
            after["scene"]["listener"] == before["scene"]["listener"] and
            after["field"]["jobs"] == before["field"]["jobs"]))

        before = diagnostics(page)["scene"]["speakers"][0]
        drag_object(page, "1")
        after = diagnostics(page)["scene"]["speakers"][0]
        check("3D speaker dragging changes X/Z but preserves height", lambda: require(
            after["y"] == before["y"] and (after["x"], after["z"]) != (before["x"], before["z"])))
        page.click("#mode-2d")
        settle(page)
        before = diagnostics(page)
        drag_object(page, "listener", 20, -15)
        check("2D listener dragging does not recompute the receiver-independent map", lambda: require(
            diagnostics(page)["scene"]["listener"] != before["scene"]["listener"] and
            diagnostics(page)["field"]["jobs"] == before["field"]["jobs"]))
        page.click('.source-row[data-id="2"]')
        settle(page)
        check("selection refreshes source inspector", lambda: require(
            page.input_value("#frequency-number") == "1000" and page.input_value("#speaker-name") == "Mid"))
        edit_number(page, "#frequency-number", 1234)
        check("frequency control updates selected source only", lambda: require(
            diagnostics(page)["scene"]["speakers"][1]["frequency"] == 1234 and
            diagnostics(page)["scene"]["speakers"][0]["frequency"] == 80))
        page.click("#undo")
        settle(page)
        check("undo restores source edit", lambda: require(diagnostics(page)["scene"]["speakers"][1]["frequency"] == 1000))
        page.click("#redo")
        settle(page)
        check("redo restores source edit", lambda: require(diagnostics(page)["scene"]["speakers"][1]["frequency"] == 1234))

        page.click("#speaker-name")
        before = diagnostics(page)["scene"]["listener"]
        page.keyboard.type("wasd23")
        page.locator("#speaker-name").blur()
        settle(page)
        check("text editing does not invoke movement or mode shortcuts", lambda: require(
            diagnostics(page)["scene"]["listener"] == before and diagnostics(page)["scene"]["settings"]["mode"] == "2d"))
        before = diagnostics(page)
        page.locator("#scene").focus()
        page.keyboard.down("w")
        page.wait_for_timeout(180)
        page.keyboard.up("w")
        settle(page)
        check("WASD moves listener with no field recalculation", lambda: require(
            diagnostics(page)["scene"]["listener"]["z"] < before["scene"]["listener"]["z"] and
            diagnostics(page)["field"]["jobs"] == before["field"]["jobs"]))

        choose_preset(page)
        page.click("#audio-toggle")
        page.wait_for_function("window.__diagnostics().audio.state === 'running'")
        page.wait_for_timeout(150)
        check("explicit user gesture starts four voices with direct plus six reflection paths", lambda: require(
            diagnostics(page)["audio"]["voices"] == 4 and diagnostics(page)["audio"]["paths"] == 28))
        offline = page.evaluate("""async inMemory => {
          const Engine = inMemory ? AudioEngine : (await import('./src/audio.js')).AudioEngine;
          async function render(phases) {
            const ctx = new OfflineAudioContext(1, 16000, 32000), engine = new Engine();
            engine.context = ctx;
            for (const phase of phases) {
              const input = ctx.createGain(); input.gain.value = .25; input.connect(ctx.destination);
              engine.makeOscillator({input}, {frequency:440,phase}, .015);
            }
            const data = (await ctx.startRendering()).getChannelData(0);
            let energy = 0, count = 0;
            for(let i=3200;i<data.length;i++) { energy += data[i]*data[i]; count++; }
            return Math.sqrt(energy / count);
          }
          return {single:await render([0]),aligned:await render([0,0]),opposed:await render([0,180])};
        }""", IN_MEMORY)
        check("native offline audio preserves phase and cancels opposed oscillators", lambda: require(
            offline["single"] > .1 and abs(offline["aligned"] / offline["single"] - 2) < .001 and offline["opposed"] < 1e-6))
        before = diagnostics(page)["audio"]["parameterWrites"]
        page.click("#mode-3d")
        settle(page)
        check("view-only changes schedule zero audio parameter writes", lambda: require(
            diagnostics(page)["audio"]["parameterWrites"] == before))
        page.click("#mute")
        page.wait_for_timeout(180)
        check("muting stops and cleans up a voice", lambda: require(
            diagnostics(page)["audio"]["voices"] == 3 and diagnostics(page)["audio"]["retired"] == 0))
        page.click("#mute")
        page.click("#duplicate")
        settle(page)
        check("duplicate creates a distinct source and audio voice", lambda: require(
            len(diagnostics(page)["scene"]["speakers"]) == 5 and diagnostics(page)["audio"]["voices"] == 5))
        page.click("#remove")
        page.wait_for_timeout(180)
        check("delete cleans up source and graph", lambda: require(
            len(diagnostics(page)["scene"]["speakers"]) == 4 and diagnostics(page)["audio"]["voices"] == 4 and
            diagnostics(page)["audio"]["retired"] == 0))
        page.click("#audio-toggle")
        page.wait_for_function("window.__diagnostics().audio.state === 'suspended'")
        check("pause suspends audio context", lambda: require(not diagnostics(page)["audio"]["enabled"]))

        choose_preset(page, "interference")
        check("opposed equal-frequency sources cancel at symmetric receiver", lambda: require(
            "∞" in page.inner_text("#listener-reading")))
        page.select_option("#field-mode", "energy")
        settle(page)
        check("energy mode does not incorrectly cancel out-of-phase sources", lambda: require(
            "∞" not in page.inner_text("#listener-reading")))
        page.select_option("#field-mode", "coherent")
        edit_number(page, "#frequency-number", 16000)
        check("undersampled phase map displays an explicit warning", lambda: require(page.is_visible("#sampling-warning")))
        page.select_option("#field-mode", "off")
        settle(page)
        before = diagnostics(page)["field"]["jobs"]
        edit_number(page, "#frequency-number", 440)
        check("map off avoids field jobs", lambda: require(diagnostics(page)["field"]["jobs"] == before))

        choose_preset(page)
        page.check("#edit-room")
        settle(page)
        before = diagnostics(page)["scene"]["room"]["vertices"]
        # Plan bounds are fitted symmetrically; corner projection is computed from the
        # same published projection module, not by mutating application state.
        corner = page.evaluate("""async inMemory => {
          const d=window.__diagnostics(), canvas=document.querySelector('#scene');
          const project = inMemory ? projection : (await import('./src/projection.js')).projection;
          const p=project(d.scene,canvas.clientWidth,canvas.clientHeight);
          return p.project({...d.scene.room.vertices[0],y:0});
        }""", IN_MEMORY)
        box = page.locator("#scene").bounding_box()
        page.mouse.move(box["x"] + corner["x"], box["y"] + corner["y"])
        page.mouse.down()
        page.mouse.move(box["x"] + corner["x"] + 20, box["y"] + corner["y"] + 15, steps=5)
        page.mouse.up()
        settle(page)
        check("plan room corners are draggable while maintaining valid geometry", lambda: require(
            diagnostics(page)["scene"]["room"]["vertices"] != before))
        edit_number(page, "#room-height", 1)
        check("room shrink clamps source, listener and slice heights", lambda: require(
            all(p["y"] <= .9 for p in diagnostics(page)["scene"]["speakers"] + [diagnostics(page)["scene"]["listener"]]) and
            diagnostics(page)["scene"]["settings"]["slice"] <= .9))
        choose_preset(page)
        page.select_option("#field-mode", "off")
        for _ in range(12):
            page.click("#add")
        settle(page)
        check("16-source limit disables add and duplicate", lambda: require(
            len(diagnostics(page)["scene"]["speakers"]) == 16 and page.is_disabled("#add") and page.is_disabled("#duplicate")))

        before = diagnostics(page)["scene"]
        page.set_input_files("#import-file", {"name": "bad.json", "mimeType": "application/json", "buffer": b'{"version":2}'})
        page.wait_for_timeout(100)
        check("invalid import is rejected atomically", lambda: require(
            diagnostics(page)["scene"] == before and "Import rejected" in page.inner_text("#toast")))
        payload = json.loads(json.dumps(before))
        payload["speakers"][0]["name"] = '<img src=x onerror="window.__xss=1">'
        page.set_input_files("#import-file", {"name": "scene.json", "mimeType": "application/json", "buffer": json.dumps(payload).encode()})
        settle(page)
        check("imported names stay plain text, never HTML", lambda: require(
            page.locator("#source-list img").count() == 0 and page.evaluate("window.__xss === undefined")))
        page.wait_for_timeout(400)
        check("scene saves through guarded storage adapter", lambda: require(page.inner_text("#save-status") == "Saved locally"))
        if not IN_MEMORY:
            # The in-memory mode intentionally does not claim native persistence coverage.
            page.reload(wait_until="networkidle")
            page.evaluate("async () => { window.__diagnostics = (await import('./src/app.js')).getDiagnostics; }")
            settle(page)
            check("native localStorage survives a full reload", lambda: require(len(diagnostics(page)["scene"]["speakers"]) == 16))

        from browser_extensions import extended_checks
        extended_checks(page, check, require, diagnostics, settle, choose_preset,
                        edit_number, drag_object, IN_MEMORY, OUTPUT)

        from browser_visual import visual_checks
        visual_checks(page, check, require, diagnostics, settle, choose_preset, OUTPUT)

        choose_preset(page)
        page.wait_for_timeout(5600)
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(200)
        check("mobile layout has no horizontal page overflow", lambda: require(page.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth")))
        page.screenshot(path=str(OUTPUT / "2d-mobile.png"), full_page=True)
        page.click("#mode-3d")
        settle(page)
        page.screenshot(path=str(OUTPUT / "3d-mobile.png"), full_page=True)
        check("mobile scene canvas keeps a usable drawing area", lambda: require(
            page.locator("#scene").bounding_box()["width"] >= 300 and page.locator("#scene").bounding_box()["height"] >= 250))
        page.click("#help")
        check("model documentation opens in an accessible modal dialog", lambda: require(page.locator("#help-dialog").is_visible()))
        page.click("#close-help")
        check("no uncaught browser errors", lambda: require(not errors, str(errors)))
        worker = diagnostics(page)["field"]["worker"]
        if not IN_MEMORY:
            check("native module worker is active", lambda: require(worker))
        report = {"mode": "in-memory (storage shim, no HTTP/module-loading coverage)" if IN_MEMORY else "HTTP / native ESM",
                  "url_path": BASE if not IN_MEMORY else None, "browser": browser.version, "worker_active": worker, "passed": len(results), "checks": results, "page_errors": errors}
        (OUTPUT / "browser-report.json").write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report, indent=2))
        browser.close()


if __name__ == "__main__":
    run()
