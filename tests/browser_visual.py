"""Presentation regressions. No scene/solver mutation is used to manufacture results."""
def visual_checks(page, check, require, diagnostics, settle, choose_preset, output):
    choose_preset(page)
    page.click('#mode-3d')
    settle(page)
    before = diagnostics(page)
    page.uncheck('#contours')
    settle(page)
    after = diagnostics(page)
    check('contour switch changes only presentation, not scene, audio, field or probe', lambda: require(
        before['scene'] == after['scene'] and not after['visual']['contours'] and
        before['field']['jobs'] == after['field']['jobs'] and
        before['probeComputations'] == after['probeComputations'] and
        before['audio']['parameterWrites'] == after['audio']['parameterWrites']))
    page.check('#contours')
    page.click('#mode-2d')
    settle(page)
    check('view switching reuses cached contour geometry', lambda: require(
        diagnostics(page)['visual']['contourBuilds'] == before['visual']['contourBuilds'] and
        diagnostics(page)['visual']['contourSegments'] > 0))
    check('large listener readout and list readout use the same model value', lambda: require(
        page.inner_text('#probe-reading') in page.inner_text('#listener-reading')))
    check('logarithmic frequency slider exposes a hertz description', lambda: require(
        page.get_attribute('#frequency','aria-valuetext') == '80 Hz'))
    page.click('#mute')
    settle(page)
    check('excluded sources have text and shape cues, not only faded color', lambda: require(
        'muted' in page.get_attribute('.source-row[data-id="1"]','aria-label') and
        page.locator('.source-row[data-id="1"]').evaluate("e => getComputedStyle(e).borderTopStyle") == 'dashed'))
    page.click('#mute')
    page.select_option('#field-mode','coherent')
    settle(page)
    check('map explanation follows phase mode without confusing it with energy', lambda: require(
        'reinforce or cancel' in page.inner_text('#map-context') and
        'Phase estimate' in page.inner_text('#probe-model')))
    page.select_option('#field-mode','off')
    settle(page)
    check('map-off state hides its key and disables meaningless contour control', lambda: require(
        not page.is_visible('#map-legend') and page.is_disabled('#contours')))
    choose_preset(page)
    page.click('#help')
    check('field guide is named and exposes essentials before optional detail', lambda: require(
        page.get_by_role('dialog',name='Place. Listen. Compare.').is_visible() and
        page.locator('#help-dialog details').count() == 4 and
        page.locator('#help-dialog details[open]').count() == 0))
    page.get_by_text('Keyboard controls',exact=True).click()
    check('guide detail opens with native disclosure semantics', lambda: require(
        page.locator('#help-dialog details[open]').count() == 1))
    page.screenshot(path=str(output/'field-guide.png'),full_page=True)
    page.click('#close-help')
    for width,height in [(320,740),(390,844),(600,900),(768,1000),(900,900),(1024,800),(1440,1000)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(100)
        check(f'{width}px layout has no page overflow and keeps undo and exports accessible', lambda: require(
            page.evaluate('document.documentElement.scrollWidth <= innerWidth') and
            all(page.locator(selector).is_visible() for selector in ['#undo','#redo','#export','#import','#snapshot','#help'])))
    # The selected mode remains readable even while hovered: a former specificity conflict.
    page.hover('#mode-2d')
    colors = page.locator('#mode-2d').evaluate("e => ({text:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})")
    check('hover preserves the light active-mode background and dark label', lambda: require(
        colors['text'] == 'rgb(22, 58, 56)' and colors['bg'] == 'rgb(230, 237, 219)'))
    page.mouse.move(0,0)
    page.wait_for_function("document.getElementById('toast').hidden")
    # Report actual final states with the legend outside the drawing area.
    page.screenshot(path=str(output/'2d-desktop.png'),full_page=True)
    page.click('#mode-3d')
    settle(page)
    page.mouse.move(0,0)
    page.screenshot(path=str(output/'3d-desktop.png'),full_page=True)
    check('legend lies outside the interactive drawing area', lambda: require(
        page.locator('#map-legend').bounding_box()['y'] >=
        page.locator('#scene').bounding_box()['y'] + page.locator('#scene').bounding_box()['height']))
