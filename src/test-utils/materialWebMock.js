// Test-only stub for @material/web custom-element side-effect imports.
//
// @material/web ships untranspiled ESM (it imports from "tslib"/"lit"), which CRA's jest
// transform leaves alone, so any test that transitively imports a Material Web element
// (e.g. via MaterialSwitch) crashes with "Cannot use import statement outside a module".
//
// MaterialSwitch only imports `@material/web/switch/switch.js` for its side effect of
// registering the <md-switch> custom element. Under jsdom we don't need the real element —
// the component still renders an <md-switch> tag and tests query it by label/role — so we
// map the whole package to this no-op. Mapped via the `jest.moduleNameMapper` key in
// package.json: "^@material/web/(.*)$".
module.exports = {};
