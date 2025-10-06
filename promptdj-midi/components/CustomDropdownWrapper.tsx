import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import CustomDropdown from './react/CustomDropdown.jsx';
import './react/CustomDropdown.css';

// Web Component wrapper for the app's CustomDropdown (React)
class CustomDropdownElement extends HTMLElement {
  private _root: Root | null = null;
  private _container: HTMLDivElement | null = null;

  private _value: string = '';
  private _options: Array<{ value: string; label: any; disabled?: boolean }>= [];
  private _placeholder: string = 'Select option...';
  private _disabled: boolean = false;

  static get observedAttributes() {
    // Keep attributes minimal; prefer property assignment from Lit
    return ['value', 'placeholder', 'disabled'];
  }

  set value(v: string) { this._value = v ?? ''; this.renderReact(); }
  get value() { return this._value; }

  set options(v: Array<{ value: string; label: any; disabled?: boolean }>) { this._options = v || []; this.renderReact(); }
  get options() { return this._options; }

  set placeholder(v: string) { this._placeholder = v ?? 'Select option...'; this.renderReact(); }
  get placeholder() { return this._placeholder; }

  set disabled(v: boolean) { this._disabled = !!v; this.renderReact(); }
  get disabled() { return this._disabled; }

  connectedCallback() {
    if (!this._container) {
      this._container = document.createElement('div');
      this.appendChild(this._container);
    }
    if (!this._root) this._root = createRoot(this._container!);
    // initialize from attributes
    this._value = this.getAttribute('value') || '';
    if (this.hasAttribute('placeholder')) this._placeholder = this.getAttribute('placeholder') || this._placeholder;
    this._disabled = this.getAttribute('disabled') !== null && this.getAttribute('disabled') !== 'false';
    this.renderReact();
  }

  attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null) {
    if (name === 'value') this._value = newVal || '';
    if (name === 'placeholder') this._placeholder = newVal || 'Select option...';
    if (name === 'disabled') this._disabled = newVal !== null && newVal !== 'false';
    this.renderReact();
  }

  disconnectedCallback() {
    try { this._root?.unmount(); } catch {}
    this._root = null;
    this._container = null;
  }

  private onChange = (nextValue: string) => {
    this._value = nextValue;
    this.dispatchEvent(new CustomEvent('change', { detail: { value: nextValue }, bubbles: true, composed: true }));
  };

  private renderReact() {
    if (!this._root) return;
    this._root.render(
      <CustomDropdown
        value={this._value}
        onChange={this.onChange}
        options={this._options}
        placeholder={this._placeholder}
        disabled={this._disabled}
        className={''}
        style={undefined}
      />
    );
  }
}

customElements.define('custom-dropdown-el', CustomDropdownElement);

