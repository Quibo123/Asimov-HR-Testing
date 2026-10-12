import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Textarea } from '@heroui/react'
import { dayLabel } from '../lib/dayLabel'
import { formatBytes } from '../people/profileLogic'
import { compressImage } from './compress'
import { readNote, writeNote } from './drafts'
import { fileSizeProblem, fileTypeProblem, type FileProblem } from './logic'
import { useAcknowledge, useUploadDocument } from './queries'
import type { JoinerTask, JoinerView } from './types'

type Props = {
  token: string
  task: JoinerTask
  index: number
  total: number
  onSaved: (title: string, view: JoinerView) => void
}

const big = 'min-h-14 w-full text-lg'
const pick =
  'inline-flex min-h-14 w-full cursor-pointer items-center justify-center rounded-xl border-2 px-4 text-lg font-medium peer-focus-visible:outline-4'

export default function StepScreen({ token, task, index, total, onSaved }: Props) {
  const { t } = useTranslation('joiner')
  // What was typed is read back, so a reload does not lose it
  const [note, setNote] = useState(() => readNote(token, task.id))
  const [file, setFile] = useState<File | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState<FileProblem | null>(null)
  const [inputKey, setInputKey] = useState(0) // changing the key empties the file inputs
  const [progress, setProgress] = useState(0)
  const ack = useAcknowledge(token)
  const upload = useUploadDocument(token, setProgress)

  const isDoc = task.requirement === 'document'
  const busy = ack.isPending || upload.isPending
  const failed = ack.isError || upload.isError

  function changeNote(value: string) {
    setNote(value)
    writeNote(token, task.id, value)
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    setInputKey(k => k + 1) // so the same photo can be chosen again
    if (!picked) return
    upload.reset()

    const typeProblem = fileTypeProblem(picked)
    if (typeProblem) {
      setProblem(typeProblem)
      setFile(null)
      return
    }
    setProblem(null)
    setPreparing(true)
    const prepared = await compressImage(picked) // made smaller before it is sent
    setPreparing(false)

    const sizeProblem = fileSizeProblem(prepared)
    if (sizeProblem) {
      setProblem(sizeProblem)
      setFile(null)
      return
    }
    setFile(prepared)
  }

  async function send() {
    if (isDoc && !file) return
    setProgress(0)
    try {
      const body = { taskId: task.id, note: note.trim() }
      const view = isDoc && file ? await upload.mutateAsync({ ...body, file }) : await ack.mutateAsync(body)
      writeNote(token, task.id, '')
      onSaved(task.title, view)
    } catch {
      // The button below turns into "Not sent — tap to retry". Nothing typed or chosen is cleared.
    }
  }

  const label = busy
    ? isDoc
      ? t('step.uploading', { n: progress })
      : t('step.sending')
    : failed
      ? t('step.notSent')
      : isDoc
        ? t('step.send')
        : t('step.ackButton')

  const percent = Math.round(((index - 1) / total) * 100)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium">{t('step.of', { n: index, total })}</p>
        <div
          role="progressbar"
          aria-label={t('step.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 w-full overflow-hidden rounded bg-black/10"
        >
          <div className="h-full bg-(--brand)" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <h1 className="text-2xl font-semibold wrap-break-word">{task.title}</h1>
      {task.description && <p className="whitespace-pre-line wrap-break-word">{task.description}</p>}
      <p className="text-base opacity-80">{t('step.due', { date: dayLabel(task.dueDate) })}</p>

      {isDoc && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            <input
              key={`cam-${inputKey}`}
              id="take-photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => void onPick(e)}
              disabled={busy || preparing}
              className="peer sr-only"
            />
            <label htmlFor="take-photo" className={pick}>{t('step.takePhoto')}</label>
          </div>
          <div className="flex flex-col">
            <input
              key={`file-${inputKey}`}
              id="choose-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={e => void onPick(e)}
              disabled={busy || preparing}
              className="peer sr-only"
            />
            <label htmlFor="choose-file" className={pick}>{t('step.chooseFile')}</label>
          </div>
          <p className="text-base opacity-80">{t('step.docHint')}</p>
          {preparing && <p role="status">{t('step.preparing')}</p>}
          {file && !preparing && (
            <p role="status" className="wrap-break-word font-medium">
              {t('step.ready', { name: file.name, size: formatBytes(file.size) })}
            </p>
          )}
          {problem && <p role="alert" className="text-red-600">{t(`step.fileErrors.${problem}`)}</p>}
        </div>
      )}

      <Textarea
        label={t('step.noteLabel')}
        value={note}
        onValueChange={changeNote}
        maxLength={500}
        isDisabled={busy}
      />

      {upload.isPending && (
        <div
          role="progressbar"
          aria-label={t('step.sending')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-3 w-full overflow-hidden rounded bg-black/10"
        >
          <div className="h-full bg-(--brand)" style={{ width: `${progress}%` }} />
        </div>
      )}

      {failed && <p role="alert" className="text-red-600">{t('step.kept')}</p>}

      <Button
        color={failed ? 'danger' : 'primary'}
        className={big}
        isLoading={busy}
        isDisabled={(isDoc && !file) || preparing}
        onPress={() => void send()}
      >
        {label}
      </Button>
    </div>
  )
}