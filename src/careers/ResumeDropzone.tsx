import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { MAX_RESUME_BYTES, type AnswerError } from './validate'

type Props = {
  file: File | null
  error?: string
  onSelect: (file: File) => void
  onReject: (error: AnswerError) => void
}

export default function ResumeDropzone({ file, error, onSelect, onReject }: Props) {
  const { t } = useTranslation('careers')

  // Checked in the browser BEFORE anything is uploaded
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    maxSize: MAX_RESUME_BYTES,
    onDropAccepted: files => onSelect(files[0]),
    onDropRejected: rejections => {
      const tooBig = rejections[0]?.errors.some(e => e.code === 'file-too-large')
      onReject({ key: tooBig ? 'errors.resumeSize' : 'errors.resumeType' })
    },
  })

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">{`${t('apply.resume')} *`}</p>
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center ${
  isDragActive ? 'border-(--brand)' : ''
}`}
      >
        <input {...getInputProps()} aria-label={t('apply.resume')} />
        <p>{isDragActive ? t('apply.dropActive') : t('apply.dropHere')}</p>
        <p className="text-sm opacity-70">{t('apply.resumeHint')}</p>
      </div>
      {file && <p className="text-sm">{t('apply.chosen', { name: file.name })}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}