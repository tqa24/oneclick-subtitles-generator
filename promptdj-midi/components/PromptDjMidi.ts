/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseMorphWrapper';
import type { PlaybackState, Prompt } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      position: relative;
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: #111;
    }
    /* Main layout: grid on the left, controls on the right */
    #content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12vmin;
      margin-top: 8vmin;
    }
    #grid {
      width: 80vmin;
      height: 80vmin;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5vmin;
    }
    prompt-controller {
      width: 100%;
    }
    #sideControls {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 80vmin;
    }
    play-pause-morph {
      width: 23vmin;
      height: 23vmin;
      display: inline-block;
    }
    #buttons {
      position: absolute;
      top: 0;
      left: 0;
      padding: 5px;
      display: flex;
      gap: 5px;
    }
    button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: #0002;
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid #fff;
      border-radius: 4px;
      user-select: none;
      padding: 3px 6px;
    }
    button.active { background-color: #fff; color: #000; }
    select {
      font: inherit;
      padding: 5px;
      background: #fff;
      color: #000;
      border-radius: 4px;
      border: none;
      outline: none;
      cursor: pointer;
    }
  `;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;

  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @property({ type: String }) public lang: string = 'en';
  @state() public audioLevel = 0;
  private lastUserAction: 'play' | 'pause' | null = null;

  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private optimisticLoading: boolean = false;
  @state() private optimisticPlaying: boolean | null = null; // null = follow real state
  private clickCooldownUntil: number = 0; // epoch ms; during this window, ignore extra toggles


  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  constructor(
    initialPrompts: Map<string, Prompt>,
  ) {
    super();
    this.prompts = initialPrompts;
    this.midiDispatcher = new MidiDispatcher();
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const { promptId, text, weight, cc } = e.detail;
    const prompt = this.prompts.get(promptId);

    if (!prompt) {
      console.error('prompt not found', promptId);
      return;
    }

    prompt.text = text;
    prompt.weight = weight;
    prompt.cc = cc;

    const newPrompts = new Map(this.prompts);
    newPrompts.set(promptId, prompt);

    this.prompts = newPrompts;
    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
  }

  /** Generates radial gradients for each prompt based on weight and color. */
  private readonly makeBackground = throttle(
    () => {
      const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

      const MAX_WEIGHT = 0.5;
      const MAX_ALPHA = 0.6;

      const bg: string[] = [];

      [...this.prompts.values()].forEach((p, i) => {
        const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
        const alpha = Math.round(alphaPct * 0xff)
          .toString(16)
          .padStart(2, '0');

        const stop = p.weight / 2;
        const x = (i % 4) / 3;
        const y = Math.floor(i / 4) / 3;
        const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`;

        bg.push(s);
      });

      return bg.join(', ');
    },
    30, // don't re-render more than once every XXms
  );

  private toggleShowMidi() {
    return this.setShowMidi(!this.showMidi);
  }

  private tr(key: 'midi' | 'noDevices') {
    const dict: Record<string, Record<'midi' | 'noDevices', string>> = {
      en: { midi: 'MIDI', noDevices: 'No devices found' },
      ko: { midi: 'MIDI', noDevices: '장치를 찾을 수 없습니다' },
      vi: { midi: 'MIDI', noDevices: 'Không tìm thấy thiết bị' },
    };
    const lang = (this.lang || 'en').toLowerCase();
    return (dict[lang] || dict.en)[key];
  }

  public async setShowMidi(show: boolean) {
    this.showMidi = show;
    if (!this.showMidi) return;
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e) {
      this.showMidi = false;
      this.dispatchEvent(new CustomEvent('error', {detail: (e as any).message}));
    }
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private playPause(e: Event) {
    // Prevent the bubbling play-pause event from also reaching outer listeners
    e.stopPropagation();

    // Debounce rapid clicks to avoid double toggles
    const now = Date.now();
    if (now < this.clickCooldownUntil) return;
    this.clickCooldownUntil = now + 500;

    const morphEl = this.renderRoot?.querySelector('play-pause-morph') as HTMLElement | null;

    // If currently playing or loading: this click means STOP
    if (this.playbackState === 'playing' || this.playbackState === 'loading') {
      this.lastUserAction = 'pause';
      this.optimisticPlaying = false; // pause -> play morph immediately
      this.optimisticLoading = false; // ensure spinner is off
      morphEl?.removeAttribute('loading');
      morphEl?.setAttribute('playing', 'false');
      this.dispatchEvent(new CustomEvent('pause', { bubbles: true })); // explicit pause/stop
      return;
    }

    // If paused/stopped: this click means PLAY
    this.lastUserAction = 'play';
    this.optimisticLoading = true; // show spinner immediately
    this.optimisticPlaying = null; // follow real state for icon
    morphEl?.setAttribute('loading', '');
    this.dispatchEvent(new CustomEvent('play', { bubbles: true }));
  }

  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  public setPromptLabels(labels: string[]) {
    const updated = new Map<string, Prompt>();
    let i = 0;
    for (const [key, p] of this.prompts.entries()) {
      const newText = labels[i] ?? p.text;
      updated.set(key, { ...p, text: newText });
      i++;
    }
    this.prompts = updated;
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
  }

  public getPrompts(): Map<string, Prompt> {
    return new Map(this.prompts);
  }

  protected updated(changedProps: Map<string, any>) {
    if (changedProps.has('playbackState')) {
      const state = this.playbackState;
      // Apply rules based on last user action to avoid flicker and ensure immediate UX
      if (this.lastUserAction === 'play') {
        if (state === 'playing') {
          // Real play started: clear spinner and reset
          this.optimisticLoading = false;
          this.optimisticPlaying = null;
          this.lastUserAction = null;
        } else if (state === 'loading') {
          // Keep spinner on
          this.optimisticLoading = true;
        } else if (state === 'paused' || state === 'stopped') {
          // Transient stopped/paused after play click: keep spinner until real loading/playing
          this.optimisticLoading = true;
        }
      } else if (this.lastUserAction === 'pause') {
        // Force pause morph, never show spinner
        this.optimisticLoading = false;
        this.optimisticPlaying = false;
        if (state === 'paused' || state === 'stopped') {
          this.lastUserAction = null;
        }
      } else {
        // No recent action: follow real state
        this.optimisticLoading = (state === 'loading');
        this.optimisticPlaying = null;
      }
    }
  }

  override render() {
    const bg = styleMap({
      backgroundImage: this.makeBackground(),
    });
    const playingProp = this.optimisticPlaying !== null
      ? this.optimisticPlaying
      : (this.playbackState === 'playing');
    const loadingProp = this.optimisticLoading || this.playbackState === 'loading';

    return html`<div id="background" style=${bg}></div>
      <div id="buttons">
        <button
          @click=${this.toggleShowMidi}
          class=${this.showMidi ? 'active' : ''}
          >${this.tr('midi')}</button
        >
        <select
          @change=${this.handleMidiInputChange}
          .value=${this.activeMidiInputId || ''}
          style=${this.showMidi ? '' : 'visibility: hidden'}>
          ${this.midiInputIds.length > 0
        ? this.midiInputIds.map(
          (id) =>
            html`<option value=${id}>
                    ${this.midiDispatcher.getDeviceName(id)}
                  </option>`,
        )
        : html`<option value="">${this.tr('noDevices')}</option>`}
        </select>
      </div>
      <div id="content">
        <div id="grid">${this.renderPrompts()}</div>
        <div id="sideControls">
          <play-pause-morph
            ?playing=${playingProp}
            ?loading=${loadingProp}
            @play-pause=${this.playPause}
          ></play-pause-morph>
        </div>
      </div>`;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}
