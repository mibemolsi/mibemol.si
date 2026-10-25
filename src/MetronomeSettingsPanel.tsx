import { t } from './i18n'
import {
  CLICK_DURATION_PRESETS,
  TIME_SIGNATURE_PRESETS,
  formatTimeSignature,
  isCompoundMeter,
  type ClickSound,
  type MetronomeMeter,
  type MetronomeSubdivision
} from './metronomeMeter'
import { formatBpm } from './tempoMath'

const SUB_LABELS: Record<MetronomeSubdivision, string> = {
  none: 'Ninguna',
  eighths: '8vos',
  triplets: 'Tresillos',
  sixteenths: '16vos'
}

const SOUND_LABELS: Record<ClickSound, string> = {
  wood: 'Madera',
  beep: 'Beep',
  rim: 'Aro'
}

interface MetronomeSettingsPanelProps {
  meter: MetronomeMeter
  bpm: number
  hasTempoMap: boolean
  mapUnreliable?: boolean
  localBpm?: number | null
  alignArmed: boolean
  phaseMs: number
  onPatch: (patch: Partial<MetronomeMeter>) => void
  onPhaseMs: (ms: number) => void
  onArmAlign: () => void
  onReanalyze?: () => void
  onReset?: () => void
  onClose: () => void
}

export function MetronomeSettingsPanel({
  meter,
  bpm,
  hasTempoMap,
  mapUnreliable = false,
  localBpm,
  alignArmed,
  phaseMs,
  onPatch,
  onPhaseMs,
  onArmAlign,
  onReanalyze,
  onReset,
  onClose
}: MetronomeSettingsPanelProps) {
  const compound = isCompoundMeter(meter.numerator, meter.denominator)
  const presetLabel = formatTimeSignature(meter)
  const isPreset = TIME_SIGNATURE_PRESETS.some(
    (p) => p.numerator === meter.numerator && p.denominator === meter.denominator
  )

  return (
    <div className="metro-settings" data-testid="metronome-settings" role="dialog" aria-label={t("Ajustes del metrónomo")}>
      <div className="metro-settings-head">
        <div>
          <div className="metro-settings-kicker">{t("Metrónomo")}</div>
          <h3>{t("Compás y clic")}</h3>
        </div>
        <button type="button" className="metro-settings-close" onClick={onClose} aria-label={t("Cerrar")}>
          ×
        </button>
      </div>

      <section className="metro-settings-section">
        <div className="metro-settings-label">{t("Modo")}</div>
        <div className="metro-chip-row" role="group" aria-label={t("Modo del metrónomo")}>
          <button
            type="button"
            className={`metro-chip ${meter.followMode === 'fixed' ? 'active' : ''}`}
            data-testid="tempo-mode-fixed"
            aria-pressed={meter.followMode === 'fixed'}
            onClick={() => onPatch({ followMode: 'fixed' })}
          >
            {t("Tempo fijo")}
          </button>
          <button
            type="button"
            className={`metro-chip ${meter.followMode !== 'fixed' ? 'active' : ''}`}
            data-testid="tempo-mode-follow"
            aria-pressed={meter.followMode !== 'fixed'}
            disabled={!hasTempoMap}
            title={hasTempoMap ? 'El clic sigue el mapa de beats de la canción' : 'Cargá audio para crear un mapa de beats'}
            onClick={() => onPatch({ followMode: 'follow' })}
          >
            {t("Seguir la canción")}
          </button>
        </div>
        {(onReset || onReanalyze) && (
          <div className="metro-chip-row metro-tempo-actions" role="group" aria-label={t("Acciones de tempo")}>
            {onReset && (
              <button
                type="button"
                className="metro-chip"
                data-testid="reset-tempo"
                onClick={onReset}
              >
                {t("Resetear tempo")}
              </button>
            )}
            {onReanalyze && (
              <button
                type="button"
                className="metro-chip"
                data-testid="reanalyze-tempo"
                onClick={onReanalyze}
              >
                {t("Reanalizar tempo")}
              </button>
            )}
          </div>
        )}
        {hasTempoMap && localBpm != null && !mapUnreliable && (
          <div className="metro-settings-hint" data-testid="local-bpm-readout">
            {t("Tempo local")} {formatBpm(localBpm)} {t("BPM")}
          </div>
        )}
        {mapUnreliable && (
          <div className="metro-settings-hint" data-testid="tempo-map-fallback-notice">
            {t("Mapa de tempo inestable — usando tempo fijo.")}
          </div>
        )}
      </section>

      <section className="metro-settings-section">
        <div className="metro-settings-label">{t("Duración")}</div>
        <div className="metro-chip-row" role="group" aria-label={t("Duración del clic")}>
          <button
            type="button"
            className={`metro-chip ${meter.clickBars == null ? 'active' : ''}`}
            data-testid="click-duration-always"
            aria-pressed={meter.clickBars == null}
            onClick={() => onPatch({ clickBars: null })}
          >
            {t("Siempre")}
          </button>
          {CLICK_DURATION_PRESETS.map((bars) => (
            <button
              key={bars}
              type="button"
              className={`metro-chip ${meter.clickBars === bars ? 'active' : ''}`}
              data-testid={`click-duration-${bars}`}
              aria-pressed={meter.clickBars === bars}
              onClick={() => onPatch({ clickBars: bars })}
            >
              {bars} {t("compases")}
            </button>
          ))}
        </div>
        <div className="metro-custom-meter">
          <span>{t("Personalizado")}</span>
          <input
            type="number"
            min={1}
            max={99}
            className="metro-nd"
            data-testid="click-duration-custom"
            aria-label={t("Compases de clic")}
            placeholder={t("N")}
            value={meter.clickBars ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                onPatch({ clickBars: null })
                return
              }
              onPatch({ clickBars: Number(raw) })
            }}
          />
        </div>
        {meter.clickBars != null && (
          <label className="metro-toggle metro-loop-repeat">
            <input
              type="checkbox"
              checked={meter.clickRepeatEachLoop}
              data-testid="click-repeat-loop"
              onChange={(e) => onPatch({ clickRepeatEachLoop: e.target.checked })}
            />
            <span>{t("Repetir en cada vuelta del loop")}</span>
          </label>
        )}
      </section>

      <section className="metro-settings-section">
        <div className="metro-settings-label">{t("Compás")}</div>
        <div className="metro-chip-row" role="group" aria-label={t("Compás")}>
          {TIME_SIGNATURE_PRESETS.map((preset) => {
            const active = meter.numerator === preset.numerator && meter.denominator === preset.denominator
            return (
              <button
                key={preset.label}
                type="button"
                className={`metro-chip ${active ? 'active' : ''}`}
                data-testid={`meter-preset-${preset.label.replace('/', '-')}`}
                aria-pressed={active}
                onClick={() => onPatch({ numerator: preset.numerator, denominator: preset.denominator })}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <div className="metro-custom-meter">
          <span>{t("Personalizado")}</span>
          <input
            type="number"
            min={1}
            max={16}
            className="metro-nd"
            data-testid="meter-numerator"
            aria-label={t("Numerador")}
            value={meter.numerator}
            onChange={(e) => onPatch({ numerator: Number(e.target.value) })}
          />
          <span className="metro-nd-slash">/</span>
          <select
            className="metro-nd"
            data-testid="meter-denominator"
            aria-label={t("Denominador")}
            value={meter.denominator}
            onChange={(e) => onPatch({ denominator: Number(e.target.value) })}
          >
            {[1, 2, 4, 8, 16].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span className="metro-settings-hint">{isPreset ? presetLabel : `${presetLabel} · custom`}</span>
        </div>
        {compound && (
          <div className="metro-chip-row" role="group" aria-label={t("Pulso compuesto")}>
            <button
              type="button"
              className={`metro-chip ${meter.compoundPulse === 'dotted-quarter' ? 'active' : ''}`}
              data-testid="compound-dotted"
              aria-pressed={meter.compoundPulse === 'dotted-quarter'}
              onClick={() => onPatch({ compoundPulse: 'dotted-quarter' })}
            >
              {t("Pulso en negra con puntillo")}
            </button>
            <button
              type="button"
              className={`metro-chip ${meter.compoundPulse === 'eighth' ? 'active' : ''}`}
              data-testid="compound-eighth"
              aria-pressed={meter.compoundPulse === 'eighth'}
              onClick={() => onPatch({ compoundPulse: 'eighth' })}
            >
              {t("Pulso en 8vos")}
            </button>
          </div>
        )}
      </section>

      <section className="metro-settings-section">
        <label className="metro-toggle">
          <input
            type="checkbox"
            checked={meter.accentDownbeat}
            data-testid="accent-downbeat"
            onChange={(e) => onPatch({ accentDownbeat: e.target.checked })}
          />
          <span>{t("Acentuar el 1")}</span>
        </label>
      </section>

      <section className="metro-settings-section">
        <div className="metro-settings-label">{t("Subdivisión")}</div>
        <div className="metro-chip-row" role="group" aria-label={t("Subdivisión")}>
          {(['none', 'eighths', 'triplets', 'sixteenths'] as MetronomeSubdivision[]).map((sub) => (
            <button
              key={sub}
              type="button"
              className={`metro-chip ${meter.subdivision === sub ? 'active' : ''}`}
              data-testid={`subdivision-${sub}`}
              aria-pressed={meter.subdivision === sub}
              onClick={() => onPatch({ subdivision: sub })}
            >
              {SUB_LABELS[sub]}
            </button>
          ))}
        </div>
      </section>

      <section className="metro-settings-section">
        <div className="metro-settings-label">{t("Sonido del clic")}</div>
        <div className="metro-chip-row" role="group" aria-label={t("Sonido del clic")}>
          {(['wood', 'beep', 'rim'] as ClickSound[]).map((sound) => (
            <button
              key={sound}
              type="button"
              className={`metro-chip ${meter.clickSound === sound ? 'active' : ''}`}
              data-testid={`click-sound-${sound}`}
              aria-pressed={meter.clickSound === sound}
              onClick={() => onPatch({ clickSound: sound })}
            >
              {SOUND_LABELS[sound]}
            </button>
          ))}
        </div>
      </section>

      <section className="metro-settings-section metro-align-section">
        <div className="metro-settings-label">{t("Alinear metrónomo")}</div>
        <p className="metro-settings-copy">
          {t("Marcá dónde cae el 1 en la canción, o corre el clic en milisegundos. Tempo actual")} {bpm} {t("BPM.")}
        </p>
        <button
          type="button"
          className={`metro-align-btn ${alignArmed ? 'armed' : ''}`}
          data-testid="align-metronome"
          aria-pressed={alignArmed}
          onClick={onArmAlign}
        >
          {alignArmed ? 'Hacé click donde está el 1…' : 'Click donde está el 1'}
        </button>
        <div className="metro-phase-row">
          <span>{t("Fase")}</span>
          <button
            type="button"
            className="metro-phase-nudge"
            data-testid="phase-minus"
            onClick={() => onPhaseMs(phaseMs - 10)}
          >
            {t("−10 ms")}
          </button>
          <input
            type="number"
            className="metro-phase-input"
            data-testid="phase-ms"
            aria-label={t("Fase en milisegundos")}
            value={phaseMs}
            onChange={(e) => onPhaseMs(Number(e.target.value) || 0)}
          />
          <button
            type="button"
            className="metro-phase-nudge"
            data-testid="phase-plus"
            onClick={() => onPhaseMs(phaseMs + 10)}
          >
            {t("+10 ms")}
          </button>
        </div>
      </section>
    </div>
  )
}
