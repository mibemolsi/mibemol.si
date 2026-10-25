import { t } from './i18n'
import { NumberStepper } from './NumberStepper'
import {
  MANUAL_LATENCY_MAX_MS,
  MANUAL_LATENCY_MIN_MS,
  MANUAL_LATENCY_RESET_MS,
  MANUAL_LATENCY_STEP_MS,
  clampLatencyMs,
  formatLatencyMs,
  parseLatencyMs
} from './recordLatency'

interface RecordLatencyPanelProps {
  autoMs: number
  calibratedMs: number | null
  manualMs: number
  appliedMs: number
  calibrating: boolean
  onManualMs: (ms: number) => void
  onCalibrate: () => void
  onClose: () => void
}

export function RecordLatencyPanel({
  autoMs,
  calibratedMs,
  manualMs,
  appliedMs,
  calibrating,
  onManualMs,
  onCalibrate,
  onClose
}: RecordLatencyPanelProps) {
  return (
    <div className="record-latency-panel" data-testid="record-latency-panel" role="dialog" aria-label={t("Latencia de grabación")}>
      <div className="record-latency-row">
        <span>{t("Auto (E/S)")}</span>
        <strong>{Math.round(autoMs)} {t("ms")}</strong>
      </div>
      <div className="record-latency-row">
        <span>{t("Calibrado")}</span>
        <strong>{calibratedMs == null ? '—' : `${Math.round(calibratedMs)} ms`}</strong>
      </div>
      <div className="record-latency-row">
        <span>{t("Ajuste")}</span>
        <NumberStepper
          value={manualMs}
          min={MANUAL_LATENCY_MIN_MS}
          max={MANUAL_LATENCY_MAX_MS}
          step={MANUAL_LATENCY_STEP_MS}
          resetValue={MANUAL_LATENCY_RESET_MS}
          format={formatLatencyMs}
          parse={parseLatencyMs}
          clamp={clampLatencyMs}
          onChange={onManualMs}
          ariaLabel="Ajuste manual de latencia en milisegundos"
          testId="latency-stepper"
        />
      </div>
      <div className="record-latency-row">
        <span>{t("Aplicado")}</span>
        <strong data-testid="record-latency-applied">{Math.round(appliedMs)} {t("ms")}</strong>
      </div>
      <p className="record-latency-hint">
        {t("Los clics salen por los altavoces y vuelven por el micrófono. El ajuste se guarda por dispositivo.")}
      </p>
      <div className="record-latency-actions">
        <button
          type="button"
          className="modal-button modal-button-primary"
          data-testid="calibrate-latency"
          disabled={calibrating}
          onClick={onCalibrate}
        >
          {calibrating ? 'Calibrando…' : 'Calibrar latencia'}
        </button>
        <button type="button" className="modal-button modal-button-secondary" onClick={onClose}>
          {t("Cerrar")}
        </button>
      </div>
    </div>
  )
}

interface ClipLatencyDialogProps {
  valueMs: number
  onChangeMs: (ms: number) => void
  onApply: () => void
  onCancel: () => void
}

export function ClipLatencyDialog({ valueMs, onChangeMs, onApply, onCancel }: ClipLatencyDialogProps) {
  return (
    <div className="confirm-modal" data-testid="clip-latency-dialog">
      <div className="modal-content" style={{ maxWidth: 360 }}>
        <h2 className="modal-title">{t("Ajustar latencia")}</h2>
        <p className="modal-description">
          {t("Un valor positivo adelanta el clip (compensa una grabación tarde). Negativo lo retrasa.")}
        </p>
        <div className="record-latency-row">
          <span>{t("Desplazamiento")}</span>
          <NumberStepper
            value={valueMs}
            min={MANUAL_LATENCY_MIN_MS}
            max={MANUAL_LATENCY_MAX_MS}
            step={MANUAL_LATENCY_STEP_MS}
            resetValue={MANUAL_LATENCY_RESET_MS}
            format={formatLatencyMs}
            parse={parseLatencyMs}
            clamp={clampLatencyMs}
            onChange={onChangeMs}
            ariaLabel="Desplazar clip en milisegundos"
            testId="clip-latency-stepper"
          />
        </div>
        <div className="modal-buttons">
          <button type="button" className="modal-button modal-button-primary" onClick={onApply}>
            {t("Aplicar")}
          </button>
          <button type="button" className="modal-button modal-button-secondary" onClick={onCancel}>
            {t("Cancelar")}
          </button>
        </div>
      </div>
    </div>
  )
}
