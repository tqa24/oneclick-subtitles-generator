import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import MaterialSwitch from './react/MaterialSwitch.jsx';
import './react/material-switch.css';

class MaterialSwitchElement extends HTMLElement {
  private _root: Root | null = null;
  private _container: HTMLDivElement | null = null;
  private _checked = false;
  private _disabled = false;
  private _label: string | null = 'MIDI';

  static get observedAttributes() { return ['checked', 'disabled', 'label']; }

  connectedCallback() {
    if (!this._container) {
      this._container = document.createElement('div');
      this.appendChild(this._container);
    }
    if (!this._root) this._root = createRoot(this._container!);
    this._checked = this.getAttribute('checked') !== null && this.getAttribute('checked') !== 'false';
    this._disabled = this.getAttribute('disabled') !== null && this.getAttribute('disabled') !== 'false';
    this._label = this.getAttribute('label');
    this.renderReact();
  }

  attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null) {
    if (name === 'checked') this._checked = newVal !== null && newVal !== 'false';
    if (name === 'disabled') this._disabled = newVal !== null && newVal !== 'false';
    if (name === 'label') this._label = newVal;
    this.renderReact();
  }

  disconnectedCallback() {
    try { this._root?.unmount(); } catch {}
    this._root = null;
    this._container = null;
  }

  private onChange = (e: any) => {
    const checked = !!e?.target?.checked;
    if (checked) this.setAttribute('checked', ''); else this.removeAttribute('checked');
    this.dispatchEvent(new CustomEvent('change', { detail: { checked }, bubbles: true, composed: true }));
  };

  private renderReact() {
    if (!this._root) return;
    const label = this._label || '';
    this._root.render(
      <div className="material-switch-container">
        <MaterialSwitch
          checked={this._checked}
          disabled={this._disabled}
          onChange={this.onChange}
          ariaLabel={label || 'MIDI'}
          id={''}
          ariaLabelledBy={''}
          icons={true}
          showOnlySelectedIcon={false}
          className={''}
          style={undefined}
        />
        {label ? <span className="material-switch-label">{label}</span> : null}
      </div>
    );
  }
}

customElements.define('material-switch-el', MaterialSwitchElement);

