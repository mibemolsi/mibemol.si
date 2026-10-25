import { t } from './i18n'
import { useState } from 'react'
import './StemSplitDialog.css'
import {
  DEFAULT_STEM_QUALITY,
  STEM_QUALITY_OPTIONS,
  isStemQuality,
  stemQualityOption,
  type StemQuality,
} from './stemQuality'
import { formatElapsed } from './stemProgress'

interface StemSplitDialogProps {
  onConfirm: (quality: StemQuality) => void
  onCancel: () => void
}

export function StemSplitDialog({ onConfirm, onCancel }: StemSplitDialogProps) {
  const [quality, setQuality] = useState<StemQuality>(DEFAULT_STEM_QUALITY)
  const selected = stemQualityOption(quality)

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{t("¿Este audio tiene varios instrumentos?")}</h2>
        <p className="modal-description">
          {t("Se puede separar el audio en pistas individuales con inteligencia artificial\n          en tu navegador. El audio no sale de tu equipo.")}
        </p>

        <label className="quality-label" htmlFor="stem-quality">
          {t("Calidad de separación")}
        </label>
        <select
          id="stem-quality"
          className="quality-select"
          value={quality}
          onChange={(e) => {
            if (isStemQuality(e.target.value)) setQuality(e.target.value)
          }}
        >
          {STEM_QUALITY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="quality-detail">{selected.blurb}</p>

        <p className="modal-note">
          <strong>{t("Básica / Rápida")}</strong> {t("usa Spleeter (4 pistas, ~80 MB, más rápido).")}
          {' '}<strong>{t("Mejor calidad")}</strong> {t("usa HT-Demucs 6 pistas (~136 MB): Voz, Batería, Bajo, Guitarra, Piano y Otros.")}
          {' '}<strong>{t("Guitarra agrupa todas las guitarras")}</strong> {t("(HT-Demucs 6s no las separa).\n          Las pistas casi silenciosas se omiten. La primera vez se descarga el modelo.")}
          <br /><br />
          <strong>{t("Requisitos:")}</strong> {t("navegador moderno y varios GB de RAM.\n          HT-Demucs rinde mejor con WebGPU (Chrome/Edge). En móviles puede fallar.")}
        </p>
        <div className="modal-buttons">
          <button
            className="modal-button modal-button-primary"
            onClick={() => onConfirm(quality)}
          >
            {t("Sí, separar en pistas")}
          </button>
          <button
            className="modal-button modal-button-secondary"
            onClick={onCancel}
          >
            {t("No, una sola pista")}
          </button>
        </div>
      </div>
    </div>
  )
}

interface StemSplitProgressProps {
  progress: number
  stage?: string
  elapsedSeconds?: number
  etaSeconds?: number
  onCancel?: () => void
}

export function StemSplitProgress({
  progress,
  stage,
  elapsedSeconds,
  etaSeconds,
  onCancel,
}: StemSplitProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const stageLabel = stage?.trim() || 'Separando stems…'
  const showEta = etaSeconds != null && Number.isFinite(etaSeconds) && etaSeconds >= 1 && pct < 100

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{t("Separando stems…")}</h2>
        <p className="progress-stage">{stageLabel}</p>
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="progress-text">{pct}%</div>
        </div>
        <p className="progress-meta">
          {elapsedSeconds != null && Number.isFinite(elapsedSeconds)
            ? `Transcurrido: ${formatElapsed(elapsedSeconds)}`
            : 'El porcentaje avanza con la descarga y cada bloque de audio.'}
          {showEta ? ` · Resta aprox. ${formatElapsed(etaSeconds)}` : ''}
        </p>
        <p className="modal-description">
          {t("Este proceso puede tardar varios minutos. No cierres esta ventana.")}
        </p>
        {onCancel && (
          <div className="modal-buttons">
            <button
              className="modal-button modal-button-secondary"
              onClick={onCancel}
            >
              {t("Cancelar")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface StemFallbackDialogProps {
  message: string
  onRetryBasic: () => void
  onSingleTrack: () => void
}

export function StemFallbackDialog({ message, onRetryBasic, onSingleTrack }: StemFallbackDialogProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{t("No se pudo usar Mejor calidad")}</h2>
        <p className="modal-description">{message}</p>
        <p className="modal-note">
          {t("Puedes reintentar con")} <strong>{t("Básica / Rápida")}</strong> {t("(Spleeter) o cargar el audio como una sola pista.")}
        </p>
        <div className="modal-buttons">
          <button className="modal-button modal-button-primary" onClick={onRetryBasic}>
            {t("Reintentar con Básica / Rápida")}
          </button>
          <button className="modal-button modal-button-secondary" onClick={onSingleTrack}>
            {t("Cargar como pista única")}
          </button>
        </div>
      </div>
    </div>
  )
}
