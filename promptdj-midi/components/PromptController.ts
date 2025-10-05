/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import './WeightKnob';
import type { WeightKnob } from './WeightKnob';

import type { MidiDispatcher } from '../utils/MidiDispatcher';
import type { Prompt, ControlChange } from '../types';

/** A single prompt input associated with a MIDI CC. */
@customElement('prompt-controller')
export class PromptController extends LitElement {
  static override styles = css`
    .prompt {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    weight-knob {
      width: 70%;
      flex-shrink: 0;
    }
    #midi {
      font-family: monospace;
      text-align: center;
      font-size: 1.5vmin;
      border: 0.2vmin solid #fff;
      border-radius: 0.5vmin;
      padding: 2px 5px;
      color: #fff;
      background: #0006;
      cursor: pointer;
      visibility: hidden;
      user-select: none;
      margin-top: 0.75vmin;
      .learn-mode & {
        color: orange;
        border-color: orange;
      }
      .show-cc & {
        visibility: visible;
      }
    }

    /* New wrapper for text display and editing */
    .text-wrapper {
      position: relative;
      width: 17vmin;
      height: 6vmin;
      margin-top: -5vmin; /* Pull arch closer to the knob */
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* SVG for displaying curved text */
    #text-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      cursor: pointer;
      user-select: none;
    }
    
    #text-svg text {
      font-weight: 500;
      font-size: 2.2vmin; /* Increased font size */
      fill: #fff;
      text-anchor: middle;
      -webkit-font-smoothing: antialiased;
      text-shadow: 0 0 0.8vmin #000, 0 0 0.2vmin #000;
    }
    
    /* The editable span, now positioned for in-place editing */
    #text {
      font-weight: 500;
      font-size: 2.2vmin; /* Match SVG font size */
      text-shadow: 0 0 0.8vmin #000, 0 0 0.2vmin #000;
      max-width: 17vmin;
      min-width: 2vmin;
      padding: 0.1em 0.3em;
      flex-shrink: 0;
      border-radius: 0.25vmin;
      text-align: center;
      white-space: pre;
      overflow: hidden;
      border: none;
      outline: none;
      -webkit-font-smoothing: antialiased;
      background: #000;
      color: #fff;
      position: absolute; /* Position over the SVG space */
      visibility: hidden; /* Hidden by default */
      z-index: 2; /* Ensure it's on top when visible */
      
      &:not(:focus) {
        text-overflow: ellipsis;
      }
    }
    
    /* Logic to show/hide elements based on editing state */
    .is-editing #text-svg {
      visibility: hidden;
    }
    .is-editing #text {
      visibility: visible;
    }

    /* Filtered state now applies to the wrapper */
    :host([filtered]) {
      weight-knob { 
        opacity: 0.5;
      }
      .text-wrapper {
        background: #da2000;
        border-radius: 0.25vmin;
        z-index: 1;
      }
      /* Make input background transparent to see wrapper color */
      #text {
        background: transparent;
      }
    }

    @media only screen and (max-width: 600px) {
      #text, #text-svg text {
        font-size: 2.8vmin; /* Increased responsive font size */
      }
      weight-knob {
        width: 60%;
      }
    }
  `;

  @property({ type: String }) promptId = '';
  @property({ type: String }) text = '';
  @property({ type: Number }) weight = 0;
  @property({ type: String }) color = '';
  @property({ type: Boolean, reflect: true }) filtered = false;

  @property({ type: Number }) cc = 0;
  @property({ type: Number }) channel = 0; // Not currently used

  @property({ type: Boolean }) learnMode = false;
  @property({ type: Boolean }) showCC = false;

  @query('weight-knob') private weightInput!: WeightKnob;
  @query('#text') private textInput!: HTMLSpanElement;

  @property({ type: Object })
  midiDispatcher: MidiDispatcher | null = null;

  @property({ type: Number }) audioLevel = 0;
  
  @state() private isEditing = false;

  private lastValidText!: string;

  override connectedCallback() {
    super.connectedCallback();
    this.midiDispatcher?.addEventListener('cc-message', (e: Event) => {
      const customEvent = e as CustomEvent<ControlChange>;
      const { channel, cc, value } = customEvent.detail;
      if (this.learnMode) {
        this.cc = cc;
        this.channel = channel;
        this.learnMode = false;
        this.dispatchPromptChange();
      } else if (cc === this.cc) {
        this.weight = (value / 127) * 2;
        this.dispatchPromptChange();
      }
    });
  }

  override firstUpdated() {
    this.textInput.setAttribute('contenteditable', 'plaintext-only');
    this.textInput.textContent = this.text;
    this.lastValidText = this.text;
  }

  override update(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('showCC') && !this.showCC) {
      this.learnMode = false;
    }
    if (changedProperties.has('text') && this.textInput) {
      this.textInput.textContent = this.text;
    }
    super.update(changedProperties);
  }

  private dispatchPromptChange() {
    this.dispatchEvent(
      new CustomEvent<Prompt>('prompt-changed', {
        detail: {
          promptId: this.promptId,
          text: this.text,
          weight: this.weight,
          cc: this.cc,
          color: this.color,
        },
      }),
    );
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.textInput.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.resetText();
      this.textInput.blur();
    }
  }

  private resetText() {
    this.text = this.lastValidText;
    this.textInput.textContent = this.lastValidText;
  }

  private async stopEditing() {
    this.isEditing = false;
    const newText = this.textInput.textContent?.trim();
    if (!newText) {
      this.resetText();
    } else {
      this.text = newText;
      this.lastValidText = newText;
    }
    this.dispatchPromptChange();
    this.textInput.scrollLeft = 0;
  }

  private onFocus() {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(this.textInput);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private startEditing() {
    if (this.isEditing) return;
    this.isEditing = true;
    // Wait for the DOM to update, then focus the input and select text
    this.updateComplete.then(() => {
        this.textInput.focus();
        this.onFocus();
    });
  }

  private updateWeight() {
    this.weight = this.weightInput.value;
    this.dispatchPromptChange();
  }

  private toggleLearnMode() {
    this.learnMode = !this.learnMode;
  }

  override render() {
    const promptClasses = classMap({
      'prompt': true,
      'learn-mode': this.learnMode,
      'show-cc': this.showCC,
    });
    
    const textWrapperClasses = classMap({
        'text-wrapper': true,
        'is-editing': this.isEditing,
    });

    return html`<div class=${promptClasses}>
      <weight-knob
        id="weight"
        value=${this.weight}
        color=${this.filtered ? '#888' : this.color}
        audioLevel=${this.filtered ? 0 : this.audioLevel}
        @input=${this.updateWeight}></weight-knob>
      
      <div class=${textWrapperClasses} @click=${this.startEditing}>
        <svg id="text-svg" viewBox="0 0 100 25">
          <path
            id="text-arc-path"
            d="M 5,20 A 50,40 0 0,0 95,20"
            fill="none"
            stroke="none"
          ></path>
          <text>
            <textPath href="#text-arc-path" startOffset="50%">
              ${this.text}
            </textPath>
          </text>
        </svg>
        <span
          id="text"
          spellcheck="false"
          @focus=${this.onFocus}
          @keydown=${this.onKeyDown}
          @blur=${this.stopEditing}></span>
      </div>

      <div id="midi" @click=${this.toggleLearnMode}>
        ${this.learnMode ? 'Learn' : `CC:${this.cc}`}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-controller': PromptController;
  }
}